import { Router } from "express"
import { prisma } from "../lib/prisma"
import { decryptFromClient } from "../lib/clientEncryption"
import { encrypt } from "../lib/encryption"
import { UpsertUserSecretsBodySchema } from "../models"

export const userSecretsRouter = Router()

// GET /api/secrets — list all account-level secret names for the authenticated user
userSecretsRouter.get("/", async (req, res) => {
  try {
    const secrets = await prisma.userSecret.findMany({
      where: { userId: req.user!.id },
      select: { name: true, updatedAt: true },
      orderBy: { name: "asc" },
    })
    res.status(200).json({ secrets })
  } catch (error) {
    console.error("[userSecretsRouter.GET] Failed:", error)
    res.status(500).json({ error: "Failed to list user secrets" })
  }
})

// POST /api/secrets — upsert account-level secrets
userSecretsRouter.post("/", async (req, res) => {
  const parsed = UpsertUserSecretsBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
    return
  }

  try {
    const userId = req.user!.id
    const { secrets } = parsed.data

    const names = new Set<string>()
    for (const { name } of secrets) {
      if (names.has(name)) {
        res.status(400).json({ error: `duplicate secret name in request: ${name}` })
        return
      }
      names.add(name)
    }

    const prepared: { name: string; encryptedValue: Uint8Array<ArrayBuffer> }[] = []
    for (const { name, encryptedValue } of secrets) {
      let plaintext: string
      try {
        plaintext = decryptFromClient(encryptedValue)
      } catch {
        res.status(400).json({ error: `failed to decrypt secret '${name}' with CLIENT_SECRET_KEY` })
        return
      }
      const encrypted = encrypt(Buffer.from(plaintext, "utf8"))
      const bytes = new Uint8Array(new ArrayBuffer(encrypted.length))
      bytes.set(encrypted)
      prepared.push({ name, encryptedValue: bytes })
    }

    await prisma.$transaction(
      prepared.map(({ name, encryptedValue }) =>
        prisma.userSecret.upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name, encryptedValue },
          update: { encryptedValue },
        }),
      ),
    )

    res.status(200).json({ written: prepared.map((p) => p.name) })
  } catch (error) {
    console.error("[userSecretsRouter.POST] Failed:", error)
    res.status(500).json({ error: "Failed to save user secrets" })
  }
})

// DELETE /api/secrets/:name — delete a single account-level secret
userSecretsRouter.delete("/:name", async (req, res) => {
  const { name } = req.params as { name: string }
  try {
    const deleted = await prisma.userSecret.deleteMany({
      where: { userId: req.user!.id, name },
    })
    if (deleted.count === 0) {
      res.status(404).json({ error: "secret not found" })
      return
    }
    res.status(204).send()
  } catch (error) {
    console.error("[userSecretsRouter.DELETE] Failed:", error)
    res.status(500).json({ error: "Failed to delete user secret" })
  }
})
