import { Sandbox } from "e2b"
import { inngest } from "../client"
import { prisma } from "../../../lib/prisma"
import { getSandbox } from "../../../lib/utils"
import { encrypt } from "../../../lib/encryption"

type KeystoreSubjectOverrides = {
  commonName?: string
  organizationalUnit?: string
  organization?: string
  locality?: string
  state?: string
  countryCode?: string
}

type KeystoreSubject = {
  commonName: string
  organizationalUnit: string
  organization: string
  locality: string
  state: string
  countryCode: string
}

const asCommandResult = (e: unknown): { stdout: string; stderr: string; exitCode: number } => {
  const err = e as { stdout?: string; stderr?: string; exitCode?: number; message?: string }
  return {
    stdout: err?.stdout ?? "",
    stderr: err?.stderr ?? err?.message ?? String(e),
    exitCode: typeof err?.exitCode === "number" ? err.exitCode : 1,
  }
}

const scrub = (output: string, token: string): string => {
  if (!token) return output
  return output.split(token).join("[REDACTED_KEYSTORE_PASS]")
}

const shellSingleQuote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`

const normalizeField = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

const resolveKeystoreSubject = (projectName: string, overrides?: KeystoreSubjectOverrides): KeystoreSubject => {
  const base = projectName.trim() || "aether"
  const country = overrides?.countryCode?.trim().toUpperCase()
  return {
    commonName: normalizeField(overrides?.commonName, base),
    organizationalUnit: normalizeField(overrides?.organizationalUnit, base),
    organization: normalizeField(overrides?.organization, base),
    locality: normalizeField(overrides?.locality, base),
    state: normalizeField(overrides?.state, base),
    countryCode: country && /^[A-Z]{2}$/.test(country) ? country : "US",
  }
}

export const generateKeystoreFunction = inngest.createFunction(
  {
    id: "generate-keystore",
    concurrency: [{ key: "event.data.projectId", limit: 1 }],
  },
  { event: "generate-keystore/run" },
  async ({ event, step, publish }: { event: any, step: any, publish: Function }) => {
    const { projectId, subjectOverrides } = event.data as {
      projectId: string
      subjectOverrides?: KeystoreSubjectOverrides
    }

    await step.run("mark-keystore-running", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          keyStoreStatus: "RUNNING",
          keyStoreStartedAt: new Date(),
        },
      })
    })

    try {
      return await runGenerateKeystorePipeline(projectId, subjectOverrides, step)
    } finally {
      await step.run("release-keystore-lock", async () => {
        await prisma.project.update({
          where: { id: projectId },
          data: { keyStoreStatus: "IDLE" },
        })
      })
    }
  },
)

const runGenerateKeystorePipeline = async (
  projectId: string,
  subjectOverrides: KeystoreSubjectOverrides | undefined,
  step: Parameters<Parameters<typeof inngest.createFunction>[2]>[0]["step"],
) => {
  const sandboxId = await step.run("create-sandbox", async () => {
    const sandbox = await Sandbox.create("generate-keystore")
    await sandbox.setTimeout(60_000 * 5)
    return sandbox.sandboxId
  })

  // Password is generated, used, and encrypted inline inside a single step.
  // It's never returned from a step so it doesn't leak into Inngest run logs.
  await step.run("generate-and-store-keystore", async () => {
    const sandbox = await getSandbox(sandboxId)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })
    if (!project) throw new Error("Project not found")
    const subject = resolveKeystoreSubject(project.name, subjectOverrides)

    let password: string
    try {
      const passResult = await sandbox.commands.run(`/gen-pass.sh`, { timeoutMs: 30_000 })
      password = passResult.stdout.trim()
      if (!password) throw new Error("empty password from gen-pass.sh")
    } catch (e) {
      const r = asCommandResult(e)
      throw new Error(`gen-pass.sh failed (exit ${r.exitCode}):\n${r.stdout}\n${r.stderr}`)
    }

    try {
      await sandbox.commands.run(
        `cd /tmp && /generate-keystore.sh ${shellSingleQuote(password)} ${shellSingleQuote(password)} ${shellSingleQuote(subject.commonName)} ${shellSingleQuote(subject.organizationalUnit)} ${shellSingleQuote(subject.organization)} ${shellSingleQuote(subject.locality)} ${shellSingleQuote(subject.state)} ${shellSingleQuote(subject.countryCode)}`,
        { timeoutMs: 60_000 },
      )
    } catch (e) {
      const r = asCommandResult(e)
      throw new Error(
        `generate-keystore.sh failed (exit ${r.exitCode}):\n${scrub(r.stdout, password)}\n${scrub(r.stderr, password)}`,
      )
    }

    const keystoreBytes = await sandbox.files.read("/tmp/release.keystore", { format: "bytes" })

    const encryptedPassword = encrypt(Buffer.from(password, "utf8"))
    const passwordBytes = new Uint8Array(new ArrayBuffer(encryptedPassword.length))
    passwordBytes.set(encryptedPassword)

    const keystoreBuf = Buffer.from(keystoreBytes)
    const dataBytes = new Uint8Array(new ArrayBuffer(keystoreBuf.length))
    dataBytes.set(keystoreBuf)

    await prisma.keyStore.upsert({
      where: { projectId },
      create: {
        projectId,
        password: passwordBytes,
        data: dataBytes,
      },
      update: {
        password: passwordBytes,
        data: dataBytes,
      },
    })

  })

  return { ok: true }
}
