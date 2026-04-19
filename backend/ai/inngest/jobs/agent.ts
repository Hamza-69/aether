import { openai, createAgent, createNetwork, createState } from "@inngest/agent-kit"
import { Sandbox } from 'e2b'
import { inngest } from "../client"
import { getSandbox } from "../../../lib/utils"
import { FRAGMENT_TITLE_PROMPT } from "../prompts"
import { prisma } from "../../../lib/prisma"
import { codeAgent } from "../agents/agent"
import { AgentState } from "../agents/agent"
import {
  uploadState,
  getStateDownloadUrl,
  ZERO_STATE_FRONTEND_KEY,
  ZERO_STATE_BACKEND_KEY,
} from "../../../lib/storage"

export const codeAgentFunction = inngest.createFunction(
  {id: "code-agent"},
  { event: "code-agent/run" },
  async ({ event, step }) => {

    // Find the latest fragment with tar keys from a previous agent run on this project
    const latestFragment = await step.run("get-latest-fragment", async () => {
      const latestMessage = await prisma.message.findFirst({
        where: {
          projectId: event.data.projectId,
          role: "ASSISTANT",
          fragment: {
            frontendTarKey: { not: null },
            backendTarKey: { not: null },
          },
        },
        orderBy: { createdAt: "desc" },
        include: { fragment: true },
      })
      return latestMessage?.fragment ?? null
    })

    const SandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("coding-preview")
      await sandbox.setTimeout(60_000 * 10 * 3) // 30 mins
      return sandbox.sandboxId
    })

    await step.run("setup-or-restore-sandbox", async () => {
      const sandbox = await getSandbox(SandboxId)

      const frontendKey = latestFragment?.frontendTarKey ?? ZERO_STATE_FRONTEND_KEY
      const backendKey = latestFragment?.backendTarKey ?? ZERO_STATE_BACKEND_KEY

      const frontendUrl = await getStateDownloadUrl(frontendKey)
      const backendUrl = await getStateDownloadUrl(backendKey)

      const frontendResult = await sandbox.commands.run(
        `mkdir -p /home/user/frontend && curl -sL -o /tmp/frontend.tar.gz "${frontendUrl}" && tar -xzf /tmp/frontend.tar.gz -C /home/user/frontend && rm /tmp/frontend.tar.gz && cd /home/user/frontend && npm install`,
        { timeoutMs: 300_000 }
      )
      if (frontendResult.exitCode !== 0) {
        throw new Error(`Frontend restore failed (exit ${frontendResult.exitCode}):\n${frontendResult.stderr}`)
      }

      const backendResult = await sandbox.commands.run(
        `mkdir -p /home/user/backend && curl -sL -o /tmp/backend.tar.gz "${backendUrl}" && tar -xzf /tmp/backend.tar.gz -C /home/user/backend && rm /tmp/backend.tar.gz && cd /home/user/backend && npm install && npx prisma generate`,
        { timeoutMs: 300_000 }
      )
      if (backendResult.exitCode !== 0) {
        throw new Error(`Backend restore failed (exit ${backendResult.exitCode}):\n${backendResult.stderr}`)
      }
    })

    const state = createState<AgentState>({
      summary: "",
      error: "",
      SandboxId,
    })

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 25,
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary
        const error = network.state.data.error
        if (summary || error) return
        return codeAgent
      },
    })

    const result = await network.run(event.data.value, { state })

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({ model: "gpt-5.4" }),
    })

    const { output: fragmentTitleOutput } = (await fragmentTitleGenerator.run(result.state.data.summary)) as any

    const generateFragmentTitle = () => {
      if (fragmentTitleOutput[0].type !== "text") return "Here you go."
      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt: any) => txt).join("")
      }
      return fragmentTitleOutput[0].content
    }

    const isError = !result.state.data.summary && result.state.data.error

    const generateResponse = () => {
      if (isError) {
        return result.state.data.error.replace("<error>", "").replace("</error>", "")
      }
      return result.state.data.summary.replace("<task_summary>", "").replace("</task_summary>", "")
    }

    // Always tar and upload both dirs, whether the run succeeded or errored
    const fragmentId = await step.run("tar-and-upload", async () => {
      const sandbox = await getSandbox(SandboxId)

      const tarFrontend = await sandbox.commands.run(
        `cd /home/user/frontend && git init -q && git ls-files --cached --others --exclude-standard | tar -czf /tmp/frontend.tar.gz -T -`,
        { timeoutMs: 120_000 }
      )
      if (tarFrontend.exitCode !== 0) {
        throw new Error(`Frontend tar failed (exit ${tarFrontend.exitCode}):\n${tarFrontend.stderr}`)
      }

      const tarBackend = await sandbox.commands.run(
        `cd /home/user/backend && git init -q && git ls-files --cached --others --exclude-standard | tar -czf /tmp/backend.tar.gz -T -`,
        { timeoutMs: 120_000 }
      )
      if (tarBackend.exitCode !== 0) {
        throw new Error(`Backend tar failed (exit ${tarBackend.exitCode}):\n${tarBackend.stderr}`)
      }

      // Create the Fragment record first to obtain its ID for the Tigris keys
      const fragment = await prisma.fragment.create({
        data: { content: generateResponse() },
      })

      const [frontendBuffer, backendBuffer] = await Promise.all([
        sandbox.files.read("/tmp/frontend.tar.gz", { format: "bytes" }),
        sandbox.files.read("/tmp/backend.tar.gz", { format: "bytes" }),
      ])

      const [frontendKey, backendKey] = await Promise.all([
        uploadState(`workspaces/${fragment.id}_frontend.tar.gz`, frontendBuffer),
        uploadState(`workspaces/${fragment.id}_backend.tar.gz`, backendBuffer),
      ])

      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { frontendTarKey: frontendKey, backendTarKey: backendKey },
      })

      return fragment.id
    })

    const sandboxUrl = await step.run("run-project-and-get-sandbox-url", async () => {
      const sandbox = await getSandbox(SandboxId)
      const frontendUrl = `https://${sandbox.getHost(8081)}`
      const backendUrl = `https://${sandbox.getHost(3000)}`

      await sandbox.commands.run(
        `cd /home/user/backend && touch .env && (grep -v '^PREVIEW_CORS_ORIGIN=' .env || true) > .env.tmp && printf 'PREVIEW_CORS_ORIGIN=%s\\n' '${frontendUrl}' >> .env.tmp && mv .env.tmp .env`
      )
      await sandbox.commands.run("cd /home/user/backend && npm run dev", {
        background: true,
        requestTimeoutMs: 60_000*10*3,
        timeoutMs: 60_000*10*3
      })
      await sandbox.commands.run(
        `cd /home/user/frontend && touch .env && (grep -v '^EXPO_PUBLIC_API_URL=' .env || true) > .env.tmp && printf 'EXPO_PUBLIC_API_URL=%s\\n' '${backendUrl}' >> .env.tmp && mv .env.tmp .env`
      )
      await sandbox.commands.run("cd /home/user/frontend && npm run dev", {
        background: true,
        requestTimeoutMs: 60_000*10*3,
        timeoutMs: 60_000*10*3
      })
      return frontendUrl
    })

    await step.run("mark-preview-running", async () => {
      await prisma.project.update({
        where: { id: event.data.projectId },
        data: {
          previewUrl: sandboxUrl,
          previewStatus: "RUNNING",
          previewStartedAt: new Date(),
        },
      })
    })

    await step.run("save-result", async () => {
      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: isError ? "ERROR" : "SUCCESS",
          fragmentId,
        },
      })
    })

    return {
      url: sandboxUrl,
      title: generateFragmentTitle(),
      summary: result.state.data.summary,
    }
  },
)
