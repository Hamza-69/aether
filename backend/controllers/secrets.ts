import { Router } from "express"
import { prisma } from "../lib/prisma"
import { decryptFromClient } from "../lib/clientEncryption"
import { encrypt } from "../lib/encryption"
import { UpsertSecretsBodySchema } from "../models"
import { ensureProjectOwnership } from "../lib/ensureProjectOwnership"

export const secretsRouter = Router({ mergeParams: true })

secretsRouter.get("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }
  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }
    const [secrets, requiredSecrets] = await Promise.all([
      prisma.secret.findMany({
        where: { projectId },
        select: { name: true, encryptedValue: true, useUserSecret: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.projectRequiredSecret.findMany({
        where: { projectId },
        select: { name: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
    ])

    const userSecretNames = secrets.filter(s => s.useUserSecret).map(s => s.name)
    const userSecrets = userSecretNames.length > 0
      ? await prisma.userSecret.findMany({
          where: { userId: req.user!.id, name: { in: userSecretNames } },
          select: { name: true },
        })
      : []
    const foundUserSecrets = new Set(userSecrets.map(s => s.name))
    const secretMap = new Map(secrets.map(s => [s.name, s]))

    res.status(200).json({
      secrets: secrets.map(({ encryptedValue, ...secret }) => secret),
      requiredSecrets: requiredSecrets.map((required) => {
        const secret = secretMap.get(required.name)
        const isSet = !!secret && (secret.useUserSecret ? foundUserSecrets.has(secret.name) : !!secret.encryptedValue)
        return {
          name: required.name,
          isSet,
          useUserSecret: secret?.useUserSecret ?? false,
          updatedAt: required.updatedAt,
        }
      }),
    })
  } catch (error) {
    console.error("[secretsRouter.GET] Failed:", error)
    res.status(500).json({ error: "Failed to list secrets" })
  }
})

secretsRouter.post("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }
  const parsed = UpsertSecretsBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
    return
  }

  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }

    const { secrets } = parsed.data
    const names = new Set<string>()
    for (const { name } of secrets) {
      if (names.has(name)) {
        res.status(400).json({ error: `duplicate secret name in request: ${name}` })
        return
      }
      names.add(name)
    }

    const secretsUsingUser = secrets.filter(s => s.useUserSecret).map(s => s.name)
    if (secretsUsingUser.length > 0) {
      const userSecrets = await prisma.userSecret.findMany({
        where: { userId: req.user!.id, name: { in: secretsUsingUser } },
        select: { name: true }
      })
      const foundUserSecrets = new Set(userSecrets.map(s => s.name))
      for (const name of secretsUsingUser) {
        if (!foundUserSecrets.has(name)) {
          res.status(400).json({ error: `Cannot use account secret for '${name}' because it does not exist in your account` })
          return
        }
      }
    }

    const prepared: { name: string; encryptedValue: Uint8Array<ArrayBuffer> | null; useUserSecret: boolean }[] = []
    for (const { name, encryptedValue, useUserSecret } of secrets) {
      let bytes: Uint8Array<ArrayBuffer> | null = null
      if (encryptedValue) {
        let plaintext: string
        try {
          plaintext = decryptFromClient(encryptedValue)
        } catch {
          res.status(400).json({ error: `failed to decrypt secret '${name}' with CLIENT_SECRET_KEY` })
          return
        }
        const encrypted = encrypt(Buffer.from(plaintext, "utf8"))
        bytes = new Uint8Array(new ArrayBuffer(encrypted.length))
        bytes.set(encrypted)
      }
      prepared.push({ name, encryptedValue: bytes, useUserSecret })
    }

    await prisma.$transaction(
      prepared.map(({ name, encryptedValue, useUserSecret }) =>
        prisma.secret.upsert({
          where: { projectId_name: { projectId, name } },
          create: { projectId, name, encryptedValue, useUserSecret },
          update: { 
            ...(encryptedValue !== null ? { encryptedValue } : {}),
            useUserSecret 
          },
        }),
      ),
    )

    res.status(200).json({ written: prepared.map((p) => p.name) })
  } catch (error) {
    console.error("[secretsRouter.POST] Failed:", error)
    res.status(500).json({ error: "Failed to save secrets" })
  }
})

secretsRouter.delete("/:name", async (req, res) => {
  const { projectId, name } = req.params as { projectId: string; name: string }
  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }
    const deleted = await prisma.secret.deleteMany({ where: { projectId, name } })
    if (deleted.count === 0) {
      res.status(404).json({ error: "secret not found" })
      return
    }
    res.status(204).send()
  } catch (error) {
    console.error("[secretsRouter.DELETE] Failed:", error)
    res.status(500).json({ error: "Failed to delete secret" })
  }
})
