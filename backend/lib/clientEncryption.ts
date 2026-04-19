import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const getClientKey = (): Buffer => {
  const key = process.env.CLIENT_SECRET_KEY
  if (!key || key.length !== 64) {
    throw new Error("CLIENT_SECRET_KEY must be a 64-character hex string")
  }
  return Buffer.from(key, "hex")
}

export const decryptFromClient = (payloadB64: string): string => {
  const buf = Buffer.from(payloadB64, "base64")
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, getClientKey(), iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString("utf8")
}
