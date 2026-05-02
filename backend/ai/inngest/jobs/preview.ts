import { inngest } from "../client"
import { prisma } from "../../../lib/prisma"
import { getSandbox, publish as publishFunction } from "../../../lib/utils"
import { getStateDownloadUrl, uploadScreenshot } from "../../../lib/storage"
import { resolveBackendSecretsFromExample, stringifyEnv } from "../../../lib/projectSecrets"

export const previewProjectFunction = inngest.createFunction(
  { id: "preview-project" },
  { event: "preview-project/run" },
  async ({ event, step, publish }: { event: any, step: any, publish: Function }) => {
    const { projectId, sandboxId } = event.data as { projectId: string; sandboxId: string }

    // Resolve the project owner so channels are scoped per user
    const projectOwner = await step.run("resolve-project-owner", async () => {
      return prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { userId: true },
      })
    })
    const channel = "project_preview:" + projectOwner.userId + ":" + projectId

    const { previewId, streamId } = await step.run("create-incomplete-preview", async () => {
      // Previews are an array per project; the most recent one is the "live"
      // preview. Frontend looks up the latest Preview by projectId, then
      // follows preview.stream to subscribe to this run.
      const preview = await prisma.preview.create({
        data: { projectId, completed: false },
      })

      const stream = await prisma.stream.create({
        data: { previewId: preview.id },
      })

      const initialPreview = await prisma.preview.findUnique({
        where: { id: preview.id },
        include: { stream: true },
      })

      await publishFunction(
        publish,
        channel,
        "preview",
        initialPreview as any,
        stream.id,
      )

      return { previewId: preview.id, streamId: stream.id }
    })

    const fragment = await step.run("get-latest-fragment", async () => {
      await publishFunction(
        publish,
        channel,
        "preview",
        { message: "Looking up the latest fragment..." },
        streamId,
      )
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
          data: { previewStatus: "IDLE", previewStartedAt: null },
        })

        await prisma.preview.update({
          where: { id: previewId },
          data: { completed: true },
        })

        await publishFunction(
          publish,
          channel,
          "preview",
          { message: "No runnable fragment for project.", error: true, done: true },
          streamId,
        )
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
      await publishFunction(
        publish,
        channel,
        "preview",
        { message: "Restoring the frontend state..." },
        streamId,
      )
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
      await publishFunction(
        publish,
        channel,
        "preview",
        { message: "Restoring the backend state..." },
        streamId,
      )
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

      const projectSecrets = await resolveBackendSecretsFromExample(sandbox, projectId)
      await sandbox.files.write(
        "/home/user/backend/.env",
        stringifyEnv({ ...projectSecrets, PREVIEW_CORS_ORIGIN: frontendUrl }),
      )
      await sandbox.files.write(
        "/home/user/frontend/.env",
        stringifyEnv({ EXPO_PUBLIC_API_URL: backendUrl }),
      )
      return { frontendUrl, backendUrl }
    })

    await step.run("start-backend", async () => {
      await publishFunction(
        publish,
        channel,
        "preview",
        { message: "Starting the backend server..." },
        streamId,
      )
      const sandbox = await getSandbox(sandboxId)
      await sandbox.commands.run("cd /home/user/backend && npm run dev", {
        background: true,
        requestTimeoutMs: 60_000 * 10 * 3,
        timeoutMs: 60_000 * 10 * 3,
      })
    })

    await step.run("start-frontend", async () => {
      await publishFunction(
        publish,
        channel,
        "preview",
        { message: "Starting the frontend server..." },
        streamId,
      )
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

      const finalPreview = await prisma.preview.update({
        where: { id: previewId },
        data: { url: frontendUrl, completed: true },
        include: { stream: true },
      })

      await publishFunction(
        publish,
        channel,
        "preview",
        { preview: finalPreview as any, done: true },
        streamId,
      )
    })

    await step.run("capture-screenshot", async () => {
      await publishFunction(
        publish,
        channel,
        "preview",
        { message: "Capturing screenshot..." },
        streamId,
      )

      try {
        const sandbox = await getSandbox(sandboxId)

        // Playwright script runs inside the sandbox where the app is on localhost:8081
        const playwrightScript = [
          `const { chromium } = require('playwright');`,
          `(async () => {`,
          `  const browser = await chromium.launch({ headless: true });`,
          `  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });`,
          `  await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 30000 });`,
          `  try { await page.waitForSelector('#root', { timeout: 10000 }); } catch (_) {}`,
          `  await new Promise(r => setTimeout(r, 3000));`,
          `  await page.screenshot({ path: '/tmp/screenshot.png', fullPage: false });`,
          `  await browser.close();`,
          `})();`,
        ].join(" ")

        const result = await sandbox.commands.run(
          `node -e '${playwrightScript.replace(/'/g, "'\\''")}' 2>&1`,
          { timeoutMs: 60_000 },
        )

        if (result.exitCode !== 0) {
          console.warn(`[capture-screenshot] Playwright failed (exit ${result.exitCode}): ${result.stderr}`)
          return
        }

        const pngBytes = (await sandbox.files.read("/tmp/screenshot.png", {
          format: "bytes",
        })) as Uint8Array

        const screenshotUrl = await uploadScreenshot(projectId, pngBytes)

        await prisma.project.update({
          where: { id: projectId },
          data: { screenshotUrl },
        })

        await publishFunction(
          publish,
          channel,
          "preview",
          { screenshotUrl },
          streamId,
        )
      } catch (err) {
        // Non-fatal — the preview itself still succeeds
        console.warn("[capture-screenshot] Failed:", err)
      }
    })

    return { ok: true, frontendUrl, backendUrl }
  },
)
