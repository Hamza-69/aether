import { prisma } from "./prisma"
import { decrypt } from "./encryption"
import type { Sandbox } from "e2b"

const ENV_EXAMPLE_PATH = "/home/user/backend/.env.example"

export const parseEnvKeys = (contents: string): string[] => {
  const keys = new Set<string>()
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) keys.add(key)
  }
  return [...keys].sort()
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
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!project) return {}
  const userId = project.userId

  const rows = await prisma.secret.findMany({
    where: { projectId, name: { in: keys } },
    select: { name: true, encryptedValue: true, useUserSecret: true },
  })

  const useUserSecretKeys = rows.filter(r => r.useUserSecret).map(r => r.name)
  let userRows: { name: string, encryptedValue: any }[] = []

  if (useUserSecretKeys.length > 0) {
    userRows = await prisma.userSecret.findMany({
      where: { userId, name: { in: useUserSecretKeys } },
      select: { name: true, encryptedValue: true },
    })
  }

  const userRowMap = new Map(userRows.map(r => [r.name, r.encryptedValue]))

  const out: Record<string, string> = {}
  for (const row of rows) {
    try {
      let encryptedValue = row.encryptedValue
      if (row.useUserSecret) {
        encryptedValue = userRowMap.get(row.name) || null
      }
      
      if (encryptedValue) {
        out[row.name] = decrypt(Buffer.from(encryptedValue)).toString("utf8")
      }
    } catch (err) {
      console.error(`[projectSecrets] Failed to decrypt ${row.name}:`, err)
    }
  }
  return out
}

export const updateRequiredBackendSecretsFromExample = async (
  sandbox: Sandbox,
  projectId: string,
): Promise<string[]> => {
  let exampleContents = ""
  try {
    exampleContents = await sandbox.files.read(ENV_EXAMPLE_PATH)
  } catch {
    // Treat a missing backend .env.example as no backend-required secrets.
  }

  const names = parseEnvKeys(exampleContents)
  const keep = new Set(names)

  await prisma.$transaction([
    prisma.projectRequiredSecret.deleteMany({
      where: {
        projectId,
        ...(names.length > 0 ? { name: { notIn: names } } : {}),
      },
    }),
    ...names.map((name) =>
      prisma.projectRequiredSecret.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name },
        update: {},
      }),
    ),
  ])

  return [...keep]
}
