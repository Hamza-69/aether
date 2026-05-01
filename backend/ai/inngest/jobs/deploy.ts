import { Sandbox } from "e2b"
import { inngest } from "../client"
import { prisma } from "../../../lib/prisma"
import { getSandbox } from "../../../lib/utils"
import {
  uploadState,
  getStateDownloadUrl,
} from "../../../lib/storage"
import { decrypt } from "../../../lib/encryption"
import { resolveBackendSecretsFromExample } from "../../../lib/projectSecrets"

const FLY_SECRET_NAME = "FLY_API_TOKEN"
const BACKEND_DIR = "/home/user/backend"

const shellSingleQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`

// e2b throws CommandExitError on nonzero exit; the stdout/stderr/exitCode
// we need for debugging live on the thrown error itself, not a result object.
const asCommandResult = (e: unknown): { stdout: string; stderr: string; exitCode: number } => {
  const err = e as { stdout?: string; stderr?: string; exitCode?: number; message?: string }
  return {
    stdout: err?.stdout ?? "",
    stderr: err?.stderr ?? err?.message ?? String(e),
    exitCode: typeof err?.exitCode === "number" ? err.exitCode : 1,
  }
}

// Scrub the fly token out of captured output before it hits an Inngest error
// log. Deploy.sh never echoes env vars, but we run with `2>&1` and flyctl
// error paths can occasionally include env data, so redact defensively.
const scrub = (output: string, token: string): string => {
  if (!token) return output
  return output.split(token).join("[REDACTED_FLY_TOKEN]")
}

const extractFlyAppName = (flyToml: string): string | null => {
  const match = flyToml.match(/^\s*app\s*=\s*['"]([^'"]+)['"]/m)
  return match?.[1] ?? null
}

// Load + decrypt the Fly API token inline. Never returned from a step —
// Inngest persists step return values in its run logs, so plaintext secrets
// must never cross a step boundary.
const loadFlyToken = async (projectId: string): Promise<string> => {
  const row = await prisma.secret.findUnique({
    where: { projectId_name: { projectId, name: FLY_SECRET_NAME } },
    select: { encryptedValue: true },
  })
  if (!row) throw new Error(`${FLY_SECRET_NAME} not set for project`)
  return decrypt(Buffer.from(row.encryptedValue)).toString("utf8")
}

export const deployProjectFunction = inngest.createFunction(
  {
    id: "deploy-project",
    // Inngest-level concurrency guard. The DB lock is the source of truth,
    // but this prevents two events that slip past the lock (e.g. duplicate
    // Inngest delivery) from running the pipeline in parallel for a project.
    concurrency: [{ key: "event.data.projectId", limit: 1 }],
  },
  { event: "deploy-project/run" },
  async ({ event, step, publish }: { event: any, step: any, publish: Function }) => {
    const { projectId } = event.data as { projectId: string }

    await step.run("mark-deployment-running", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          deploymentStatus: "RUNNING",
          deploymentStartedAt: new Date(),
        },
      })
    })

    try {
      return await runDeployPipeline(projectId, step)
    } finally {
      // Always release the lock — success, thrown error, or retry exhaustion.
      // Inngest still records the failure in its run history.
      await step.run("release-deployment-lock", async () => {
        await prisma.project.update({
          where: { id: projectId },
          data: { deploymentStatus: "IDLE" },
        })
      })
    }
  },
)

const runDeployPipeline = async (
  projectId: string,
  step: Parameters<Parameters<typeof inngest.createFunction>[2]>[0]["step"],
) => {
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

    if (!fragment?.backendTarKey || !fragment?.frontendTarKey) {
      throw new Error("No runnable fragment for project")
    }

    const SandboxId = await step.run("create-sandbox", async () => {
      const sandbox = await Sandbox.create("coding-preview")
      await sandbox.setTimeout(60_000 * 10 * 3)
      return sandbox.sandboxId
    })

    const backendStateUrl = await step.run("get-backend-state-url", async () => {
      return await getStateDownloadUrl(fragment.backendTarKey!)
    })

    await step.run("restore-backend", async () => {
      const sandbox = await getSandbox(SandboxId)
      try {
        await sandbox.commands.run(
          `mkdir -p ${BACKEND_DIR} && curl -sL -o /tmp/backend.tar.gz "${backendStateUrl}" && tar -xzf /tmp/backend.tar.gz -C ${BACKEND_DIR} && rm /tmp/backend.tar.gz && cd ${BACKEND_DIR} && npm install && npx prisma generate`,
          { timeoutMs: 300_000 },
        )
      } catch (e) {
        const r = asCommandResult(e)
        console.error("[deploy-project] restore-backend stdout:\n" + r.stdout)
        console.error("[deploy-project] restore-backend stderr:\n" + r.stderr)
        throw new Error(`Backend restore failed (exit ${r.exitCode}):\n${r.stdout}\n${r.stderr}`)
      }
    })

    await step.run("run-deploy-script", async () => {
      const sandbox = await getSandbox(SandboxId)
      const flyToken = await loadFlyToken(projectId)

      try {
        const probe = await sandbox.commands.run(
          `echo "--- id ---"; id; echo "--- PATH ---"; echo "$PATH"; echo "--- which fly ---"; which fly || true; echo "--- /usr/local/bin/fly ---"; ls -la /usr/local/bin/fly || true; echo "--- /usr/local/fly/bin ---"; ls -la /usr/local/fly/bin 2>/dev/null || echo "missing"; echo "--- /root/.fly/bin ---"; ls -la /root/.fly/bin 2>/dev/null || echo "missing"`,
        )
        console.log("[deploy-project] sandbox probe:\n" + probe.stdout + "\n" + probe.stderr)
      } catch (e) {
        console.error("[deploy-project] probe failed:", asCommandResult(e))
      }

      try {
        const result = await sandbox.commands.run(
          `cd ${BACKEND_DIR} && PATH="/usr/local/fly/bin:/usr/local/bin:$PATH" FLY_API_TOKEN=${shellSingleQuote(flyToken)} FLY_ACCESS_TOKEN=${shellSingleQuote(flyToken)} bash /app/deploy.sh 2>&1`,
          { timeoutMs: 60_000 * 15 },
        )
        console.log("[deploy-project] deploy.sh stdout:\n" + scrub(result.stdout, flyToken))
        console.log("[deploy-project] deploy.sh stderr:\n" + scrub(result.stderr, flyToken))
      } catch (e) {
        const r = asCommandResult(e)
        console.error("[deploy-project] deploy.sh stdout:\n" + scrub(r.stdout, flyToken))
        console.error("[deploy-project] deploy.sh stderr:\n" + scrub(r.stderr, flyToken))
        throw new Error(
          `Deploy script failed (exit ${r.exitCode}):\n${scrub(r.stdout, flyToken)}\n${scrub(r.stderr, flyToken)}`,
        )
      }
    })

    const appInfo = await step.run("read-fly-toml", async () => {
      const sandbox = await getSandbox(SandboxId)
      const contents = await sandbox.files.read(`${BACKEND_DIR}/fly.toml`)
      const appName = extractFlyAppName(contents)
      if (!appName) throw new Error("Could not read app name from fly.toml")
      return { appName, url: `https://${appName}.fly.dev` }
    })

    await step.run("set-fly-secrets", async () => {
      const sandbox = await getSandbox(SandboxId)
      const projectSecrets = await resolveBackendSecretsFromExample(sandbox, projectId)
      const entries = Object.entries(projectSecrets).filter(
        ([k]) => k !== FLY_SECRET_NAME,
      )
      if (entries.length === 0) return
      const flyToken = await loadFlyToken(projectId)
      const args = entries
        .map(([k, v]) => `${k}=${shellSingleQuote(v)}`)
        .join(" ")
      try {
        await sandbox.commands.run(
          `cd ${BACKEND_DIR} && PATH="/usr/local/fly/bin:/usr/local/bin:$PATH" FLY_API_TOKEN=${shellSingleQuote(flyToken)} FLY_ACCESS_TOKEN=${shellSingleQuote(flyToken)} fly secrets set --app ${shellSingleQuote(appInfo.appName)} ${args} 2>&1`,
          { timeoutMs: 60_000 * 30 },
        )
      } catch (e) {
        const r = asCommandResult(e)
        const redacted = entries.reduce(
          (acc, [, v]) => acc.split(v).join("[REDACTED]"),
          `${scrub(r.stdout, flyToken)}\n${scrub(r.stderr, flyToken)}`,
        )
        console.error("[deploy-project] fly-secrets-set output:\n" + redacted)
        throw new Error(`fly secrets set failed (exit ${r.exitCode}):\n${redacted}`)
      }
    })

    const newBackendTarKey = await step.run("tar-and-upload-backend", async () => {
      const sandbox = await getSandbox(SandboxId)
      try {
        await sandbox.commands.run(
          `cd ${BACKEND_DIR} && git init -q && git add -A && git ls-files --cached --others --exclude-standard | grep -Ev '^\\.env$' | tar -czf /tmp/backend.tar.gz -T -`,
          { timeoutMs: 120_000 },
        )
      } catch (e) {
        const r = asCommandResult(e)
        console.error("[deploy-project] tar stdout:\n" + r.stdout)
        console.error("[deploy-project] tar stderr:\n" + r.stderr)
        throw new Error(`Backend tar failed (exit ${r.exitCode}):\n${r.stdout}\n${r.stderr}`)
      }
      const buffer = await sandbox.files.read("/tmp/backend.tar.gz", { format: "bytes" })
      const key = `workspaces/deploy_${projectId}_${Date.now()}_backend.tar.gz`
      return await uploadState(key, buffer)
    })

    const deployment = await step.run("persist-deployment-and-message", async () => {
      const created = await prisma.deployment.create({
        data: { projectId, url: appInfo.url },
      })

      const newFragment = await prisma.fragment.create({
        data: {
          content: `Project deployed. Visit ${appInfo.url} to view it.`,
          frontendTarKey: fragment.frontendTarKey,
          backendTarKey: newBackendTarKey,
        },
      })

      await prisma.message.create({
        data: {
          projectId,
          content: `Project deployed. Visit ${appInfo.url} to view it.`,
          role: "ASSISTANT",
          type: "SUCCESS",
          fragmentId: newFragment.id,
        },
      })

      return created
    })

  return { url: deployment.url, deploymentId: deployment.id }
}
