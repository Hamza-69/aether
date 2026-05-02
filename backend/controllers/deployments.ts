import { Router, type Request, type Response } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { ensureProjectOwnership } from "../lib/ensureProjectOwnership"

export const FLY_SECRET_NAME = "FLY_API_TOKEN"

// If a deployment is still SCHEDULED/RUNNING past this, we treat the lock as
// stale (crashed job, lost event, etc.) and allow a new deploy to take over.
const DEPLOY_STALE_MIN = 20

export const deploymentsRouter = Router({ mergeParams: true })

deploymentsRouter.get("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }
  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }
    const deployments = await prisma.deployment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    })
    res.status(200).json({ deployments })
  } catch (error) {
    console.error("[deploymentsRouter.GET] Failed:", error)
    res.status(500).json({ error: "Failed to list deployments" })
  }
})

export const deployProjectHandler = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string }
  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }

    const flySecret = await prisma.secret.findUnique({
      where: { projectId_name: { projectId, name: FLY_SECRET_NAME } },
      select: { id: true, useUserSecret: true },
    })
    
    let hasFlySecret = false
    if (flySecret) {
      if (flySecret.useUserSecret) {
        const flyUserSecret = await prisma.userSecret.findUnique({
          where: { userId_name: { userId: req.user!.id, name: FLY_SECRET_NAME } },
          select: { id: true },
        })
        hasFlySecret = !!flyUserSecret
      } else {
        hasFlySecret = true
      }
    } else {
      const flyUserSecret = await prisma.userSecret.findUnique({
        where: { userId_name: { userId: req.user!.id, name: FLY_SECRET_NAME } },
        select: { id: true },
      })
      hasFlySecret = !!flyUserSecret
    }

    if (!hasFlySecret) {
      res.status(400).json({
        error: `${FLY_SECRET_NAME} secret is not set for this project. Add it before deploying.`,
      })
      return
    }

    const hasRunnableFragment = await prisma.message.findFirst({
      where: {
        projectId,
        role: "ASSISTANT",
        fragment: {
          frontendTarKey: { not: null },
          backendTarKey: { not: null },
        },
      },
      select: { id: true },
    })
    if (!hasRunnableFragment) {
      res.status(404).json({ error: "No runnable fragment found for project" })
      return
    }

    // Idempotency lock: conditionally move IDLE → SCHEDULED so concurrent
    // POSTs race and only the winner enqueues the job. A stale SCHEDULED/
    // RUNNING lock (crashed worker, etc.) past DEPLOY_STALE_MIN is treated
    // as releasable.
    const staleCutoff = new Date(Date.now() - DEPLOY_STALE_MIN * 60_000)
    const claimed = await prisma.project.updateMany({
      where: {
        id: projectId,
        OR: [
          { deploymentStatus: "IDLE" },
          { deploymentStartedAt: { lt: staleCutoff } },
          { deploymentStartedAt: null },
        ],
      },
      data: {
        deploymentStatus: "SCHEDULED",
        deploymentStartedAt: new Date(),
      },
    })

    if (claimed.count === 0) {
      res.status(409).json({
        error: "A deployment for this project is already in progress",
        deploymentStatus: project.deploymentStatus,
      })
      return
    }

    await inngest.send({
      name: "deploy-project/run",
      data: { projectId },
    })

    res.status(202).json({ scheduled: true })
  } catch (error) {
    console.error("[deployProjectHandler] Failed:", error)
    res.status(500).json({ error: "Failed to schedule deployment" })
  }
}
