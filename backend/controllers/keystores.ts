import { Router, type Request, type Response } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { GenerateKeystoreBodySchema } from "../models"

// Stale cutoff for a crashed keystore job — after this, we let a new caller
// re-claim the SCHEDULED/RUNNING slot even though the lock is technically held.
const KEYSTORE_STALE_MIN = 15

export const keystoresRouter = Router({ mergeParams: true })

keystoresRouter.get("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }
  try {
    const keystore = await prisma.keyStore.findUnique({
      where: { projectId },
      select: { id: true, createdAt: true, updatedAt: true },
    })
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { keyStoreStatus: true },
    })
    if (!project) {
      res.status(404).json({ error: "project not found" })
      return
    }
    res.status(200).json({
      exists: Boolean(keystore),
      status: project.keyStoreStatus,
      keystore,
    })
  } catch (error) {
    console.error("[keystoresRouter.GET] Failed:", error)
    res.status(500).json({ error: "Failed to fetch keystore" })
  }
})

export const generateKeystoreHandler = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string }
  try {
    const parsed = GenerateKeystoreBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
      return
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        keyStoreStatus: true,
        keyStoreStartedAt: true,
        keyStore: { select: { id: true } },
      },
    })
    if (!project) {
      res.status(404).json({ error: "project not found" })
      return
    }

    // Idempotency: short-circuit if the keystore already exists. Regenerating
    // would orphan any already-signed APKs — never overwrite silently.
    if (project.keyStore) {
      res.status(200).json({
        scheduled: false,
        alreadyExists: true,
      })
      return
    }

    // If a scheduled/running job is still fresh, treat this as idempotent.
    // This race-tolerant variant: only claim when (a) no keystore exists AND
    // (b) status is IDLE or the prior attempt is past the stale cutoff.
    const staleCutoff = new Date(Date.now() - KEYSTORE_STALE_MIN * 60_000)
    const claimed = await prisma.project.updateMany({
      where: {
        id: projectId,
        keyStore: { is: null },
        OR: [
          { keyStoreStatus: "IDLE" },
          { keyStoreStartedAt: { lt: staleCutoff } },
          { keyStoreStartedAt: null },
        ],
      },
      data: {
        keyStoreStatus: "SCHEDULED",
        keyStoreStartedAt: new Date(),
      },
    })

    if (claimed.count === 0) {
      res.status(409).json({
        error: "Keystore generation already in progress for this project",
        keyStoreStatus: project.keyStoreStatus,
      })
      return
    }

    await inngest.send({
      name: "generate-keystore/run",
      data: {
        projectId,
        subjectOverrides: parsed.data.subject,
      },
    })

    res.status(202).json({ scheduled: true })
  } catch (error) {
    console.error("[generateKeystoreHandler] Failed:", error)
    res.status(500).json({ error: "Failed to schedule keystore generation" })
  }
}
