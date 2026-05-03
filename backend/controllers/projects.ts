import { Router } from "express"
import { Sandbox } from "e2b"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { CreateProjectBodySchema } from "../models"
import { secretsRouter } from "./secrets"
import { deploymentsRouter, deployProjectHandler } from "./deployments"
import { keystoresRouter, generateKeystoreHandler } from "./keystores"
import { apksRouter, exportApkHandler } from "./apks"
import { messagesRouter } from "./messages"
import { ensureProjectOwnership } from "../lib/ensureProjectOwnership"

export const projectsRouter = Router()

// Sub-routers (all inherit auth from the parent mount in app.ts)
projectsRouter.use("/:projectId/secrets", secretsRouter)
projectsRouter.use("/:projectId/deployments", deploymentsRouter)
projectsRouter.post("/:projectId/deploy", deployProjectHandler)
projectsRouter.use("/:projectId/keystore", keystoresRouter)
projectsRouter.post("/:projectId/keystore", generateKeystoreHandler)
projectsRouter.use("/:projectId/apks", apksRouter)
projectsRouter.post("/:projectId/export-apk", exportApkHandler)
projectsRouter.use("/:projectId/messages", messagesRouter)

const toKebabCase = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)

const RUNNING_MAX_MIN = 20
const SCHEDULED_STUCK_MIN = 5
const SANDBOX_NOT_FOUND_MSG = "The sandbox was not found"

const isSandboxUrlAlive = async (url: string) => {
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow" })
    if (response.status === 502) {
      const body = await response.text().catch(() => "")
      if (body.includes(SANDBOX_NOT_FOUND_MSG)) return false
    }
    return response.status < 500
  } catch {
    return false
  }
}

const startPreviewJob = async (project: { id: string, previewSandboxId: string | null }) => {
  if (project.previewSandboxId) {
    try {
      await Sandbox.kill(project.previewSandboxId)
      console.log(`[startPreviewJob] Killed previous sandbox: ${project.previewSandboxId}`)
    } catch (err) {
      console.warn(`[startPreviewJob] Failed to kill previous sandbox ${project.previewSandboxId}:`, err)
    }
  }

  const sandbox = await Sandbox.create("coding-preview")
  await sandbox.setTimeout(60_000 * 10 * 3)
  const url = `https://8081-${sandbox.sandboxId}.e2b.app`

  await prisma.project.update({
    where: { id: project.id },
    data: {
      previewStatus: "SCHEDULED",
      previewStartedAt: new Date(),
      previewSandboxId: sandbox.sandboxId,
    },
  })

  await inngest.send({
    name: "preview-project/run",
    data: { projectId: project.id, sandboxId: sandbox.sandboxId },
  })

  return url
}

// GET /api/projects — list only the authenticated user's projects
projectsRouter.get("/", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: "desc" },
    })
    res.status(200).json({ projects })
  } catch (error) {
    console.error("[projectsRouter.GET] Failed to list projects:", error)
    res.status(500).json({ error: "Failed to list projects" })
  }
})

// GET /api/projects/:projectId — fetch a single project
projectsRouter.get("/:projectId", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  try {
    const project = await ensureProjectOwnership(projectId, req.user!.id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }
    res.status(200).json({ project })
  } catch (error) {
    console.error("[projectsRouter.GET /:projectId] Failed:", error)
    res.status(500).json({ error: "Failed to fetch project" })
  }
})

// POST /api/projects — create a project owned by the authenticated user
projectsRouter.post("/", async (req, res) => {
  console.log(`[projectsRouter.POST] Received request to create project`)

  const parsed = CreateProjectBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
    return
  }

  const { prompt, name } = parsed.data
  console.log(`[projectsRouter.POST] name=${name || "(none)"}, prompt length: ${prompt.length}`)

  const projectName = name?.trim() || toKebabCase(prompt)
  console.log(`[projectsRouter.POST] Resolved project name: "${projectName}"`)

  try {
    const project = await prisma.project.create({
      data: {
        name: projectName,
        userId: req.user!.id,
      },
    })
    console.log(`[projectsRouter.POST] Created project: ${project.id}`)

    await prisma.message.create({
      data: {
        projectId: project.id,
        content: prompt,
        role: "USER",
        type: "SUCCESS",
      },
    })
    console.log(`[projectsRouter.POST] Created user message for project: ${project.id}`)

    await inngest.send({
      name: "code-agent/run",
      data: {
        value: prompt,
        projectId: project.id,
      },
    })
    console.log(`[projectsRouter.POST] Fired code-agent/run event for project: ${project.id}`)

    res.status(201).json({ project })
  } catch (error) {
    console.error("[projectsRouter.POST] Failed to create project:", error)
    res.status(500).json({ error: "Failed to create project" })
  }
})

// POST /api/projects/:projectId/preview — start or reuse sandbox preview
projectsRouter.post("/:projectId/preview", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
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

  try {
    const now = Date.now()
    const startedAt = project.previewStartedAt?.getTime() ?? 0
    const elapsedMin = (now - startedAt) / 60_000

    const latestPreview = await prisma.preview.findFirst({
      where: { projectId, url: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { url: true },
    })
    const latestUrl = latestPreview?.url ?? null

    if (project.previewStatus === "RUNNING" && latestUrl && elapsedMin <= RUNNING_MAX_MIN) {
      const alive = await isSandboxUrlAlive(latestUrl)
      if (alive) {
        res.status(200).json({ url: latestUrl, alreadyRunning: true })
        return
      }
    }

    if (
      project.previewStatus === "SCHEDULED" &&
      latestUrl &&
      elapsedMin <= SCHEDULED_STUCK_MIN
    ) {
      res.status(200).json({ url: latestUrl, scheduled: true })
      return
    }

    const url = await startPreviewJob(project)
    res.status(202).json({ url, scheduled: true })
  } catch (error) {
    console.error("[projectsRouter.POST /:projectId/preview] Failed:", error)
    res.status(500).json({ error: "Failed to run preview" })
  }
})

// POST /api/projects/:projectId/preview/restart — force restart sandbox preview
projectsRouter.post("/:projectId/preview/restart", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
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

  // Rate limit: 1 per minute per project
  if (project.previewStartedAt) {
    const elapsedMs = Date.now() - project.previewStartedAt.getTime()
    if (elapsedMs < 60_000) {
      res.status(429).json({ error: "Rate limit exceeded: please wait a minute before restarting the preview again." })
      return
    }
  }

  try {
    const url = await startPreviewJob(project)
    res.status(202).json({ url, scheduled: true })
  } catch (error) {
    console.error("[projectsRouter.POST /:projectId/preview/restart] Failed:", error)
    res.status(500).json({ error: "Failed to restart preview" })
  }
})
