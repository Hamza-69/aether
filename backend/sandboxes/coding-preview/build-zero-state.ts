import "dotenv/config"
import { Sandbox } from "e2b"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

const BUCKET = process.env.BUCKET_NAME
const ENDPOINT = process.env.AWS_ENDPOINT_URL_S3 || "https://fly.storage.tigris.dev"
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
  console.error("Missing env: BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY")
  process.exit(1)
}

const TEMPLATE = process.env.ZERO_STATE_TEMPLATE || "coding-preview"
const FRONTEND_KEY = process.env.ZERO_STATE_FRONTEND_KEY || "zero-state/frontend.tar.gz"
const BACKEND_KEY = process.env.ZERO_STATE_BACKEND_KEY || "zero-state/backend.tar.gz"

const tigris = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
})

async function upload(key: string, body: Uint8Array) {
  await tigris.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
    })
  )
  return key
}

async function runOrThrow(sandbox: Sandbox, label: string, cmd: string, timeoutMs: number) {
  console.log(`→ ${label}`)
  const res = await sandbox.commands.run(cmd, { timeoutMs })
  if (res.exitCode !== 0) {
    throw new Error(`${label} failed (exit ${res.exitCode}):\n${res.stderr}`)
  }
}

async function main() {
  console.log(`Booting sandbox template "${TEMPLATE}"...`)
  const sandbox = await Sandbox.create(TEMPLATE)
  await sandbox.setTimeout(60_000 * 20)

  try {
    await runOrThrow(
      sandbox,
      "setup-frontend.sh",
      "cd /home/user && /app/setup-frontend.sh",
      600_000
    )
    await runOrThrow(
      sandbox,
      "setup-backend.sh",
      "cd /home/user && /app/setup-backend.sh",
      600_000
    )

    await runOrThrow(
      sandbox,
      "tar frontend",
      "tar --exclude='./node_modules' -czf /tmp/frontend.tar.gz -C /home/user/frontend .",
      300_000
    )
    await runOrThrow(
      sandbox,
      "tar backend",
      "tar --exclude='./node_modules' --exclude='./src/generated' -czf /tmp/backend.tar.gz -C /home/user/backend .",
      300_000
    )

    console.log("→ downloading tars from sandbox")
    const feBytes = (await sandbox.files.read("/tmp/frontend.tar.gz", { format: "bytes" })) as Uint8Array
    const beBytes = (await sandbox.files.read("/tmp/backend.tar.gz", { format: "bytes" })) as Uint8Array
    console.log(`   frontend.tar.gz = ${(feBytes.byteLength / 1024 / 1024).toFixed(1)} MB`)
    console.log(`   backend.tar.gz  = ${(beBytes.byteLength / 1024 / 1024).toFixed(1)} MB`)

    console.log("→ uploading to Tigris")
    await upload(FRONTEND_KEY, feBytes)
    await upload(BACKEND_KEY, beBytes)

    console.log("\n=== Zero-state tar keys (served via presigned URL at init) ===")
    console.log(`ZERO_STATE_FRONTEND_KEY=${FRONTEND_KEY}`)
    console.log(`ZERO_STATE_BACKEND_KEY=${BACKEND_KEY}`)
  } finally {
    await sandbox.kill().catch(() => {})
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
