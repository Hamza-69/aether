import { Sandbox } from "e2b"
import { inngest } from "../client"
import { prisma } from "../../../lib/prisma"
import { getSandbox } from "../../../lib/utils"
import { getStateDownloadUrl, uploadState } from "../../../lib/storage"
import { decrypt } from "../../../lib/encryption"
import { stringifyEnv } from "../../../lib/projectSecrets"

const FRONTEND_DIR = "/home/user/frontend"
export const EXPO_SECRET_NAME = "EXPO_TOKEN"

const shellSingleQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`

const asCommandResult = (e: unknown): { stdout: string; stderr: string; exitCode: number } => {
  const err = e as { stdout?: string; stderr?: string; exitCode?: number; message?: string }
  return {
    stdout: err?.stdout ?? "",
    stderr: err?.stderr ?? err?.message ?? String(e),
    exitCode: typeof err?.exitCode === "number" ? err.exitCode : 1,
  }
}

const scrub = (output: string, ...tokens: string[]): string => {
  let out = output
  for (const t of tokens) {
    if (!t) continue
    out = out.split(t).join("[REDACTED]")
  }
  return out
}

// Load + decrypt inline. Never returned from a step — Inngest persists step
// return values in run logs, so plaintext must never cross a step boundary.
const loadExpoToken = async (projectId: string): Promise<string> => {
  const row = await prisma.secret.findUnique({
    where: { projectId_name: { projectId, name: EXPO_SECRET_NAME } },
    select: { encryptedValue: true },
  })
  if (!row) throw new Error(`${EXPO_SECRET_NAME} not set for project`)
  return decrypt(Buffer.from(row.encryptedValue)).toString("utf8")
}

const loadKeystorePassword = async (projectId: string): Promise<string> => {
  const row = await prisma.keyStore.findUnique({
    where: { projectId },
    select: { password: true },
  })
  if (!row) throw new Error("Keystore not found for project")
  return decrypt(Buffer.from(row.password)).toString("utf8")
}

// Parse the final JSON object out of `eas build --json` stdout. EAS sometimes
// prints progress lines before the JSON; the last JSON object in the stream
// is the build result.
const extractBuildJson = (stdout: string): { artifacts?: { applicationArchiveUrl?: string }; id?: string; status?: string } => {
  // `eas init` and node deprecation warnings print before the JSON, so we
  // can't JSON.parse the whole stdout. Find the first '[' or '{' at line
  // start and parse from there to EOF — JSON.parse tolerates trailing
  // whitespace but not trailing text, so we must trim from the end too.
  const lines = stdout.split("\n")
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i]?.[0]
    if (first === "[" || first === "{") {
      startIdx = i
      break
    }
  }
  if (startIdx < 0) {
    throw new Error(`Failed to locate JSON in EAS build stdout:\n${stdout}`)
  }
  const candidate = lines.slice(startIdx).join("\n").trim()
  try {
    const parsed = JSON.parse(candidate)
    return Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed
  } catch (e) {
    throw new Error(`Failed to parse EAS build JSON: ${String(e)}\n${candidate.slice(0, 500)}`)
  }
}

export const exportApkFunction = inngest.createFunction(
  {
    id: "export-apk",
    concurrency: [{ key: "event.data.projectId", limit: 1 }],
  },
  { event: "export-apk/run" },
  async ({ event, step, publish }: { event: any, step: any, publish: Function }) => {
    const { projectId } = event.data as { projectId: string }

    await step.run("mark-apk-running", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          apkStatus: "RUNNING",
          apkStartedAt: new Date(),
        },
      })
    })

    try {
      return await runExportApkPipeline(projectId, step)
    } finally {
      await step.run("release-apk-lock", async () => {
        await prisma.project.update({
          where: { id: projectId },
          data: { apkStatus: "IDLE" },
        })
      })
    }
  },
)

const runExportApkPipeline = async (
  projectId: string,
  step: Parameters<Parameters<typeof inngest.createFunction>[2]>[0]["step"],
) => {
  const fragment = await step.run("get-latest-fragment", async () => {
    const latest = await prisma.message.findFirst({
      where: {
        projectId,
        role: "ASSISTANT",
        fragment: { frontendTarKey: { not: null } },
      },
      orderBy: { createdAt: "desc" },
      include: { fragment: true },
    })
    return latest?.fragment ?? null
  })

  if (!fragment?.frontendTarKey) {
    throw new Error("No runnable frontend fragment for project")
  }

  const latestDeploymentUrl = await step.run("get-latest-deployment-url", async () => {
    const deployment = await prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { url: true },
    })
    if (!deployment) throw new Error("No deployment found — deploy the backend before exporting an APK")
    return deployment.url
  })

  const sandboxId = await step.run("create-sandbox", async () => {
    const sandbox = await Sandbox.create("build-apk")
    await sandbox.setTimeout(60_000 * 60)
    return sandbox.sandboxId
  })

  const frontendStateUrl = await step.run("get-frontend-state-url", async () => {
    return await getStateDownloadUrl(fragment.frontendTarKey!)
  })

  await step.run("restore-frontend", async () => {
    const sandbox = await getSandbox(sandboxId)
    try {
      await sandbox.commands.run(
        `mkdir -p ${FRONTEND_DIR} && curl -sL -o /tmp/frontend.tar.gz "${frontendStateUrl}" && tar -xzf /tmp/frontend.tar.gz -C ${FRONTEND_DIR} && rm /tmp/frontend.tar.gz && cd ${FRONTEND_DIR} && npm install`,
        { timeoutMs: 60_000 * 10 },
      )
    } catch (e) {
      const r = asCommandResult(e)
      throw new Error(`Frontend restore failed (exit ${r.exitCode}):\n${r.stdout}\n${r.stderr}`)
    }
  })

  await step.run("write-frontend-env", async () => {
    const sandbox = await getSandbox(sandboxId)
    await sandbox.files.write(
      `${FRONTEND_DIR}/.env`,
      stringifyEnv({ EXPO_PUBLIC_API_URL: latestDeploymentUrl }),
    )
  })

  await step.run("write-keystore-file", async () => {
    const sandbox = await getSandbox(sandboxId)
    const row = await prisma.keyStore.findUnique({
      where: { projectId },
      select: { data: true },
    })
    if (!row) throw new Error("Keystore not found for project")
    const buf = Buffer.from(row.data)
    const ab = new ArrayBuffer(buf.length)
    new Uint8Array(ab).set(buf)
    await sandbox.files.write(`${FRONTEND_DIR}/my-upload-key.keystore`, ab)
  })

  // Kick off the EAS build with --no-wait, get back a build id. The sandbox
  // only needs to live long enough to trigger the build; actual build runs
  // on EAS infra and we poll for completion below.
  const buildId = await step.run("kickoff-eas-build", async () => {
    const sandbox = await getSandbox(sandboxId)
    await sandbox.setTimeout(60_000 * 60)
    const expoToken = await loadExpoToken(projectId)
    const password = await loadKeystorePassword(projectId)

    let stdout: string
    try {
      const result = await sandbox.commands.run(
        `cd ${FRONTEND_DIR} && EXPO_TOKEN=${shellSingleQuote(expoToken)} /eas-build.sh ${shellSingleQuote(password)}`,
        { timeoutMs: 60_000 * 10, user: "root" },
      )
      stdout = result.stdout
      console.log("[export-apk] eas-build kickoff (redacted):\n" + scrub(stdout, expoToken, password))
    } catch (e) {
      const r = asCommandResult(e)
      throw new Error(
        `eas-build.sh kickoff failed (exit ${r.exitCode}):\n${scrub(r.stdout, expoToken, password)}\n${scrub(r.stderr, expoToken, password)}`,
      )
    }

    const buildJson = extractBuildJson(stdout)
    const id = buildJson.id
    if (!id) {
      throw new Error(`EAS kickoff did not return a build id:\n${stdout.slice(0, 500)}`)
    }
    return id
  })

  // Poll `eas build:view <id> --json` until status=FINISHED. Each poll is a
  // short command; we step.sleep between polls so the sandbox's network
  // connection isn't held open (what killed the --wait flow previously).
  // Budget: 80 × 30s = 40min. EAS queue+build typically runs 20-25min.
  const POLL_ATTEMPTS = 80
  const POLL_INTERVAL = "30s"

  let apkDownloadUrl: string | null = null
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await step.sleep(`wait-eas-${attempt}`, POLL_INTERVAL)
    }
    const pollResult = await step.run(`poll-eas-${attempt}`, async () => {
      const sandbox = await getSandbox(sandboxId)
      await sandbox.setTimeout(60_000 * 60)
      const expoToken = await loadExpoToken(projectId)
      try {
        const result = await sandbox.commands.run(
          `cd ${FRONTEND_DIR} && EXPO_TOKEN=${shellSingleQuote(expoToken)} eas build:view ${shellSingleQuote(buildId)} --json`,
          { timeoutMs: 60_000 * 2, user: "root" },
        )
        const json = extractBuildJson(result.stdout) as {
          status?: string
          artifacts?: { applicationArchiveUrl?: string }
        }
        return {
          status: json.status ?? "UNKNOWN",
          url: json.artifacts?.applicationArchiveUrl ?? null,
        }
      } catch (e) {
        const r = asCommandResult(e)
        throw new Error(
          `eas build:view failed (exit ${r.exitCode}):\n${scrub(r.stdout, expoToken)}\n${scrub(r.stderr, expoToken)}`,
        )
      }
    })

    if (pollResult.status === "FINISHED") {
      if (!pollResult.url) {
        throw new Error(`EAS build ${buildId} finished but returned no artifact URL`)
      }
      apkDownloadUrl = pollResult.url
      break
    }
    if (pollResult.status === "ERRORED" || pollResult.status === "CANCELED") {
      throw new Error(`EAS build ${buildId} ended with status ${pollResult.status}`)
    }
    // Still IN_QUEUE / IN_PROGRESS / NEW — keep polling.
  }

  if (!apkDownloadUrl) {
    throw new Error(`EAS build ${buildId} did not finish within poll budget`)
  }

  const apkKey = await step.run("fetch-and-upload-apk", async () => {
    const response = await fetch(apkDownloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download APK from EAS (${response.status}): ${apkDownloadUrl}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const key = `apks/apk_${projectId}_${Date.now()}.apk`
    return await uploadState(key, Buffer.from(arrayBuffer))
  })

  const apk = await step.run("persist-apk-and-message", async () => {
    const created = await prisma.aPK.create({
      data: { projectId, url: apkKey },
    })

    const newFragment = await prisma.fragment.create({
      data: {
        content: `APK exported. Download key: ${apkKey}`,
        frontendTarKey: fragment.frontendTarKey,
        backendTarKey: fragment.backendTarKey,
      },
    })

    await prisma.message.create({
      data: {
        projectId,
        content: `APK exported successfully.`,
        role: "ASSISTANT",
        type: "SUCCESS",
        fragmentId: newFragment.id,
      },
    })

    return created
  })

  return { apkId: apk.id, apkKey }
}
