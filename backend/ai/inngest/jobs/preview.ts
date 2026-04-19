import { inngest } from "../client"
import { prisma } from "../../../lib/prisma"
import { getSandbox } from "../../../lib/utils"
import { getStateDownloadUrl } from "../../../lib/storage"

const stringifyEnv = (env: Record<string, string>) => {
  const lines = Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  return `${lines.join("\n")}\n`
}

export const previewProjectFunction = inngest.createFunction(
  { id: "preview-project" },
  { event: "preview-project/run" },
  async ({ event, step }) => {
    const { projectId, sandboxId } = event.data as { projectId: string; sandboxId: string }

    const fragment = await step.run("get-latest-fragment", async () => {
      const latest = await prisma.message.findFirst({
        where: {
          projectId,
          role: "ASSISTANT",
          fragment: {
            frontendTarKey: { not: null },
            backendTarKey: { not: null },
          },
        },
        orderBy: { createdAt: "desc" },
        include: { fragment: true },
      })
      return latest?.fragment ?? null
    })

    if (!fragment?.frontendTarKey || !fragment?.backendTarKey) {
      await step.run("mark-idle-no-fragment", async () => {
        await prisma.project.update({
          where: { id: projectId },
          data: { previewStatus: "IDLE", previewUrl: null, previewStartedAt: null },
        })
      })
      throw new Error("No runnable fragment for project")
    }

    const { frontendStateUrl, backendStateUrl } = await step.run("get-state-urls", async () => {
      return {
        frontendStateUrl: await getStateDownloadUrl(fragment.frontendTarKey!),
        backendStateUrl: await getStateDownloadUrl(fragment.backendTarKey!),
      }
    })

    await step.run("restore-frontend", async () => {
      const sandbox = await getSandbox(sandboxId)
      const result = await sandbox.commands.run(
        `mkdir -p /home/user/frontend && curl -sL -o /tmp/frontend.tar.gz "${frontendStateUrl}" && tar -xzf /tmp/frontend.tar.gz -C /home/user/frontend && rm /tmp/frontend.tar.gz && cd /home/user/frontend && npm i`,
        { timeoutMs: 300_000 },
      )
      if (result.exitCode !== 0) {
        throw new Error(`Frontend restore failed (exit ${result.exitCode}):\n${result.stderr}`)
      }
    })

    await step.run("restore-backend", async () => {
      const sandbox = await getSandbox(sandboxId)
      const result = await sandbox.commands.run(
        `mkdir -p /home/user/backend && curl -sL -o /tmp/backend.tar.gz "${backendStateUrl}" && tar -xzf /tmp/backend.tar.gz -C /home/user/backend && rm /tmp/backend.tar.gz && cd /home/user/backend && npm i && npx prisma generate && npx prisma db push`,
        { timeoutMs: 300_000 },
      )
      if (result.exitCode !== 0) {
        throw new Error(`Backend restore failed (exit ${result.exitCode}):\n${result.stderr}`)
      }
    })

    const { frontendUrl, backendUrl } = await step.run("write-env", async () => {
      const sandbox = await getSandbox(sandboxId)
      const frontendUrl = `https://${sandbox.getHost(8081)}`
      const backendUrl = `https://${sandbox.getHost(3000)}`

      await sandbox.files.write(
        "/home/user/backend/.env",
        stringifyEnv({ PREVIEW_CORS_ORIGIN: frontendUrl }),
      )
      await sandbox.files.write(
        "/home/user/frontend/.env",
        stringifyEnv({ EXPO_PUBLIC_API_URL: backendUrl }),
      )
      return { frontendUrl, backendUrl }
    })

    await step.run("start-backend", async () => {
      const sandbox = await getSandbox(sandboxId)
      await sandbox.commands.run("cd /home/user/backend && npm run dev", {
        background: true,
        requestTimeoutMs: 60_000 * 10 * 3,
        timeoutMs: 60_000 * 10 * 3,
      })
    })

    await step.run("start-frontend", async () => {
      const sandbox = await getSandbox(sandboxId)
      await sandbox.commands.run("cd /home/user/frontend && npm run dev", {
        background: true,
        requestTimeoutMs: 60_000 * 10 * 3,
        timeoutMs: 60_000 * 10 * 3,
      })
    })

    await step.run("mark-running", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { previewStatus: "RUNNING" },
      })
    })

    return { ok: true, frontendUrl, backendUrl }
  },
)
