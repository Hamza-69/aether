import { openai, createAgent, createNetwork, createState } from "@inngest/agent-kit"
import {Sandbox} from 'e2b'
import { inngest } from "../client"
import { getSandbox } from "../../../lib/utils"
import { FRAGMENT_TITLE_PROMPT } from "../prompts"
import { prisma } from "../../../lib/prisma"
import { codeAgent } from "../agents/agent"
import {AgentState} from "../agents/agent"

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent", triggers: [{ event: "code-agent/run" }] },
  async ({ event, step }) => {
    const SandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("coding-preview")
      await sandbox.setTimeout(60_000 * 10 * 3) // 30 mins
      return sandbox.sandboxId
    })
    
    await step.run("setup-sandbox", async () => {
      const sandbox = await getSandbox(SandboxId)
      const frontendResult = await sandbox.commands.run("cd /home/user && /app/setup-frontend.sh", { timeoutMs: 300_000 })
      if (frontendResult.exitCode !== 0) {
        throw new Error(`setup-frontend.sh failed (exit ${frontendResult.exitCode}):\n${frontendResult.stderr}`)
      }
      const backendResult = await sandbox.commands.run("cd /home/user && /app/setup-backend.sh", { timeoutMs: 300_000 })
      if (backendResult.exitCode !== 0) {
        throw new Error(`setup-backend.sh failed (exit ${backendResult.exitCode}):\n${backendResult.stderr}`)
      }
    })

    const state = createState<AgentState>(
      {
        summary: "",
        error: "",
        SandboxId
      }
    )

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 25,
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary
        const error = network.state.data.error

        if (summary || error) {
          return
        }

        return codeAgent
      }
    })

    const result = await network.run(event.data.value, {state})

    const fragmentTitleGenerator = createAgent({
      name:"fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
        model: "gpt-5.4"
      })
    })

    const {output: fragmentTitleOutput} = (await fragmentTitleGenerator.run(result.state.data.summary)) as any

    const generateFragmentTitle = () => {
      if (fragmentTitleOutput[0].type !== "text") {
        return "Here you go."
      }

      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt: any)=> txt).join("")
      } else {
        return fragmentTitleOutput[0].content
      }
    }

    const isError = 
      !result.state.data.summary && result.state.data.error
    
    const generateResponse = () => {
      if (isError) {
        return result.state.data.error.replace("<error>", "").replace("</error>", "")
      } else {
        return result.state.data.summary.replace("<task_summary>", "").replace("</task_summary>", "")
      }
    }
    
    const sandboxUrl = await step.run("run-project-and-get-sandbox-url", async () => {
      const sandbox = await getSandbox(SandboxId)
      await sandbox.commands.run("cd /home/user/frontend && npm install && npm run dev", {
        background: true
      })
      await sandbox.commands.run("cd /home/user/backend && npm install && npm run dev", {
        background: true
      })
      const host = sandbox.getHost(8081)
      return `https://${host}`
    })

    await step.run("save-result", async () =>{

      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: generateResponse(),
            role: "ASSISTANT",
            type: "ERROR"
          }
        })
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: "SUCCESS",
        }
      })
    })

    return {
      url: sandboxUrl,
      title: "Fragment",
      summary: result.state.data.summary
    }
  },
)
