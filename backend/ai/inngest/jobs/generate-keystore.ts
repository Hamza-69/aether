import { Sandbox } from "e2b"
import { inngest } from "../client"
import { prisma } from "../../../lib/prisma"
import { getSandbox, publish as publishFunction } from "../../../lib/utils"
import { encrypt } from "../../../lib/encryption"

type KeystoreSubjectOverrides = {
  commonName: string
  organizationalUnit: string
  organization: string
  locality: string
  state: string
  countryCode: string
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

const resolveKeystoreSubject = (overrides: KeystoreSubjectOverrides): KeystoreSubject => {
  const commonName = overrides.commonName.trim()
  const organizationalUnit = overrides.organizationalUnit.trim()
  const organization = overrides.organization.trim()
  const locality = overrides.locality.trim()
  const state = overrides.state.trim()
  const countryCode = overrides.countryCode.trim().toUpperCase()

  if (!commonName || !organizationalUnit || !organization || !locality || !state) {
    throw new Error("Keystore subject fields are required")
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("countryCode must be a 2-letter ISO code")
  }

  return {
    commonName,
    organizationalUnit,
    organization,
    locality,
    state,
    countryCode,
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
      subjectOverrides: KeystoreSubjectOverrides
    }

    // Resolve the project owner so channels are scoped per user
    const projectOwner = await step.run("resolve-project-owner", async () => {
      return prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { userId: true },
      })
    })
    const channel = "project_generate_keystore:" + projectOwner.userId + ":" + projectId

    const lockedKeystore = await step.run("create-incomplete-keystore", async () => {
      const existing = await prisma.keyStore.findUnique({
        where: { projectId },
        select: { id: true, completed: true },
      })

      if (existing?.completed) {
        return { alreadyExists: true as const, keystoreId: existing.id, streamId: null as string | null }
      }

      const keystore = existing
        ? await prisma.keyStore.update({
            where: { id: existing.id },
            data: { password: null, data: null, completed: false },
          })
        : await prisma.keyStore.create({
            data: { projectId, password: null, data: null, completed: false },
          })

      await prisma.stream.deleteMany({ where: { keystoreId: keystore.id } })
      const stream = await prisma.stream.create({ data: { keystoreId: keystore.id } })

      const initialKeystore = await prisma.keyStore.findUnique({
        where: { id: keystore.id },
        include: { stream: true },
      })

      await publishFunction(publish, channel, "generate-keystore", initialKeystore as any, stream.id)
      return { alreadyExists: false as const, keystoreId: keystore.id, streamId: stream.id }
    })

    if (lockedKeystore.alreadyExists) {
      return { ok: true, alreadyExists: true }
    }

    const { keystoreId, streamId } = lockedKeystore

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
      return await runGenerateKeystorePipeline(subjectOverrides, step, publish, channel, keystoreId, streamId)
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
  subjectOverrides: KeystoreSubjectOverrides,
  step: Parameters<Parameters<typeof inngest.createFunction>[2]>[0]["step"],
  publish: Function,
  channel: string,
  keystoreId: string,
  streamId: string,
) => {
  const sandboxId = await step.run("create-sandbox", async () => {
    await publishFunction(
      publish,
      channel,
      "generate-keystore",
      { message: "Spinning up the keystore sandbox..." },
      streamId,
    )
    const sandbox = await Sandbox.create("generate-keystore")
    await sandbox.setTimeout(60_000 * 5)
    return sandbox.sandboxId
  })

  // Password is generated, used, and encrypted inline inside a single step.
  // It's never returned from a step so it doesn't leak into Inngest run logs.
  await step.run("generate-and-store-keystore", async () => {
    await publishFunction(
      publish,
      channel,
      "generate-keystore",
      { message: "Generating keystore and password..." },
      streamId,
    )
    const sandbox = await getSandbox(sandboxId)
    const subject = resolveKeystoreSubject(subjectOverrides)

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

    await prisma.keyStore.update({
      where: { id: keystoreId },
      data: {
        password: passwordBytes,
        data: dataBytes,
        completed: true,
      },
    })
  })

  await step.run("publish-keystore-done", async () => {
    const finalKeystore = await prisma.keyStore.findUnique({
      where: { id: keystoreId },
      include: { stream: true },
    })

    await publishFunction(
      publish,
      channel,
      "generate-keystore",
      { keystore: finalKeystore as any, done: true },
      streamId,
    )
  })

  return { ok: true, keystoreId }
}
