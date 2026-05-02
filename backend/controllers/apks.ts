import { Router, type Request, type Response } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { EXPO_SECRET_NAME } from "../ai/inngest/jobs/export-apk"
import { getStateDownloadUrl } from "../lib/storage"
import { ensureProjectOwnership } from "../lib/ensureProjectOwnership"

const APK_DOWNLOAD_URL_TTL_SECONDS = 60 * 60

// Stale cutoff: if an APK export has been SCHEDULED/RUNNING longer than this,
// assume the worker crashed and allow a new caller to take the lock.
const APK_STALE_MIN = 75

export const apksRouter = Router({ mergeParams: true })

apksRouter.get("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }
  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }
    const apks = await prisma.aPK.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    })
    res.status(200).json({ apks })
  } catch (error) {
    console.error("[apksRouter.GET] Failed:", error)
    res.status(500).json({ error: "Failed to list APKs" })
  }
})

apksRouter.get("/:apkId/download-url", async (req, res) => {
  const { projectId, apkId } = req.params as { projectId: string; apkId: string }
  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }
    const apk = await prisma.aPK.findFirst({
      where: { id: apkId, projectId },
      select: { id: true, url: true },
    })
    if (!apk) {
      res.status(404).json({ error: "APK not found" })
      return
    }
    const url = await getStateDownloadUrl(apk.url, APK_DOWNLOAD_URL_TTL_SECONDS)
    const expiresAt = new Date(Date.now() + APK_DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString()
    res.status(200).json({
      url,
      expiresAt,
      expiresInSeconds: APK_DOWNLOAD_URL_TTL_SECONDS,
    })
  } catch (error) {
    console.error("[apksRouter.GET /:apkId/download-url] Failed:", error)
    res.status(500).json({ error: "Failed to create APK download URL" })
  }
})

export const exportApkHandler = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string }
  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }

    const projectDetails = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        apkStatus: true,
        apkStartedAt: true,
        keyStore: { select: { id: true } },
      },
    })

    // Gate: APK export requires a keystore. Caller must generate one first
    // via POST /api/projects/:projectId/keystore.
    if (!projectDetails?.keyStore) {
      res.status(400).json({
        error:
          "No keystore found for this project. Generate one via POST /api/projects/:projectId/keystore before exporting an APK.",
      })
      return
    }

    // Gate: APK export uses EAS, which needs an Expo personal access token.
    const expoSecret = await prisma.secret.findUnique({
      where: { projectId_name: { projectId, name: EXPO_SECRET_NAME } },
      select: { id: true },
    })
    if (!expoSecret) {
      res.status(400).json({
        error: `${EXPO_SECRET_NAME} secret is not set for this project. Add it before exporting an APK.`,
      })
      return
    }

    const hasRunnableFragment = await prisma.message.findFirst({
      where: {
        projectId,
        role: "ASSISTANT",
        fragment: { frontendTarKey: { not: null } },
      },
      select: { id: true },
    })
    if (!hasRunnableFragment) {
      res.status(404).json({ error: "No runnable frontend fragment found for project" })
      return
    }

    const latestDeployment = await prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    if (!latestDeployment) {
      res.status(400).json({
        error: "No deployment found. Deploy the backend before exporting an APK.",
      })
      return
    }

    // Idempotency lock: conditional IDLE → SCHEDULED. Concurrent POSTs race,
    // only the winner enqueues the Inngest job.
    const staleCutoff = new Date(Date.now() - APK_STALE_MIN * 60_000)
    const claimed = await prisma.project.updateMany({
      where: {
        id: projectId,
        OR: [
          { apkStatus: "IDLE" },
          { apkStartedAt: { lt: staleCutoff } },
          { apkStartedAt: null },
        ],
      },
      data: {
        apkStatus: "SCHEDULED",
        apkStartedAt: new Date(),
      },
    })

    if (claimed.count === 0) {
      res.status(409).json({
        error: "An APK export for this project is already in progress",
        apkStatus: projectDetails.apkStatus,
      })
      return
    }

    await inngest.send({
      name: "export-apk/run",
      data: { projectId },
    })

    res.status(202).json({ scheduled: true })
  } catch (error) {
    console.error("[exportApkHandler] Failed:", error)
    res.status(500).json({ error: "Failed to schedule APK export" })
  }
}
