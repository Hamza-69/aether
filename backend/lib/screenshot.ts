import { getSandbox, publish as publishFunction } from "./utils"
import { uploadScreenshot } from "./storage"
import { prisma } from "./prisma"

export async function captureProjectScreenshot(
  projectId: string,
  sandboxId: string,
  channel: string,
  streamId: string,
  publishCallback: Function
) {
  await publishFunction(
    publishCallback,
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
      `  let retries = 5;`,
      `  while (retries > 0) {`,
      `    try {`,
      `      await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 15000 });`,
      `      break;`,
      `    } catch (e) {`,
      `      retries--;`,
      `      if (retries === 0) throw e;`,
      `      await new Promise(r => setTimeout(r, 2000));`,
      `    }`,
      `  }`,
      `  try { await page.waitForSelector('#root', { timeout: 10000 }); } catch (_) {}`,
      `  await new Promise(r => setTimeout(r, 3000));`,
      `  await page.screenshot({ path: '/tmp/screenshot.png', fullPage: false });`,
      `  await browser.close();`,
      `})();`,
    ].join(" ")

    const result = await sandbox.commands.run(
      `NODE_PATH=/usr/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/ms-playwright node -e '${playwrightScript.replace(/'/g, "'\\''")}' 2>&1`,
      { timeoutMs: 90_000 },
    )

    if (result.exitCode !== 0) {
      console.warn(`[capture-screenshot] Playwright failed (exit ${result.exitCode}): ${result.stderr}\\n${result.stdout}`)
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
      publishCallback,
      channel,
      "preview",
      { screenshotUrl },
      streamId,
    )
  } catch (err) {
    // Non-fatal — the preview itself still succeeds
    console.warn("[capture-screenshot] Failed:", err)
  }
}
