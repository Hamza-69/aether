import { prisma } from "./prisma"
import { decrypt } from "./encryption"
import type { Sandbox } from "e2b"

const ENV_EXAMPLE_PATH = "/home/user/backend/.env.example"

const parseEnvKeys = (contents: string): string[] => {
  const keys: string[] = []
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) keys.push(key)
  }
  return keys
}

export const stringifyEnv = (env: Record<string, string>): string => {
  const lines = Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  return `${lines.join("\n")}\n`
}

export const resolveBackendSecretsFromExample = async (
  sandbox: Sandbox,
  projectId: string,
): Promise<Record<string, string>> => {
  let exampleContents: string
  try {
    exampleContents = await sandbox.files.read(ENV_EXAMPLE_PATH)
  } catch {
    return {}
  }

  const keys = parseEnvKeys(exampleContents)
  if (keys.length === 0) return {}

  const rows = await prisma.secret.findMany({
    where: { projectId, name: { in: keys } },
    select: { name: true, encryptedValue: true },
  })

  const out: Record<string, string> = {}
  for (const row of rows) {
    try {
      out[row.name] = decrypt(Buffer.from(row.encryptedValue)).toString("utf8")
    } catch (err) {
      console.error(`[projectSecrets] Failed to decrypt ${row.name}:`, err)
    }
  }
  return out
}
