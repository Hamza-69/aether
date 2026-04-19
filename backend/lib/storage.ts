import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const tigris = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3 || "https://fly.storage.tigris.dev",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function uploadState(key: string, fileBuffer: Buffer | Uint8Array) {
  await tigris.send(new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME!,
    Key: key,
    Body: fileBuffer,
  }))
  return key
}

export const ZERO_STATE_FRONTEND_KEY = "zero-state/frontend.tar.gz"
export const ZERO_STATE_BACKEND_KEY = "zero-state/backend.tar.gz"

export async function getStateDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME!,
    Key: key,
  })
  return getSignedUrl(tigris, command, { expiresIn: 300 })
}
