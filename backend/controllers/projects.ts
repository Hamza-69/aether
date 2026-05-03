import { Router } from "express"
import { Sandbox } from "e2b"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { CreateProjectBodySchema, RenameProjectBodySchema } from "../models"
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
    data: { projectId: project.id, sandboxId: sandbox.sandboxId, frontendUrl: url },
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
    const latestPreview = await prisma.preview.findFirst({
      where: { projectId, url: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { url: true },
    })
    res.status(200).json({
      project: {
        ...project,
        previewUrl: latestPreview?.url ?? null,
      },
    })
  } catch (error) {
    console.error("[projectsRouter.GET /:projectId] Failed:", error)
    res.status(500).json({ error: "Failed to fetch project" })
  }
})

// PATCH /api/projects/:projectId — rename a project
projectsRouter.patch("/:projectId", async (req, res) => {
  const { projectId } = req.params as { projectId: string }
  const parsed = RenameProjectBodySchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
    return
  }

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  try {
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { name: parsed.data.name },
    })
    res.status(200).json({ project: updated })
  } catch (error) {
    console.error("[projectsRouter.PATCH /:projectId] Failed:", error)
    res.status(500).json({ error: "Failed to rename project" })
  }
})

// DELETE /api/projects/:projectId — delete a project
projectsRouter.delete("/:projectId", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Defensive cleanup so delete works even if older DB constraints are missing cascades.
      const streams = await tx.stream.findMany({
        where: {
          OR: [
            { message: { projectId } },
            { deployment: { projectId } },
            { apk: { projectId } },
            { preview: { projectId } },
            { keystore: { projectId } },
          ],
        },
        select: { id: true },
      })
      const streamIds = streams.map((s) => s.id)
      if (streamIds.length > 0) {
        await tx.streamChunk.deleteMany({ where: { streamId: { in: streamIds } } })
        await tx.stream.deleteMany({ where: { id: { in: streamIds } } })
      }

      await tx.publishedProject.deleteMany({ where: { projectId } })
      await tx.message.deleteMany({ where: { projectId } })
      await tx.secret.deleteMany({ where: { projectId } })
      await tx.deployment.deleteMany({ where: { projectId } })
      await tx.aPK.deleteMany({ where: { projectId } })
      await tx.preview.deleteMany({ where: { projectId } })
      await tx.keyStore.deleteMany({ where: { projectId } })

      await tx.project.delete({
        where: { id: projectId },
      })
    })
    res.status(200).json({ success: true })
  } catch (error) {
    console.error("[projectsRouter.DELETE /:projectId] Failed:", error)
    res.status(500).json({ error: "Failed to delete project" })
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
    if (elapsedMs < 120_000 && project.previewSandboxId) {
      const url = `https://8081-${project.previewSandboxId}.e2b.app`
      res.status(202).json({
        url,
        scheduled: project.previewStatus === "SCHEDULED",
        alreadyRunning: project.previewStatus === "RUNNING",
      })
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

// POST /api/projects/:projectId/publish — publish a project
projectsRouter.post("/:projectId/publish", async (req, res) => {
  const { projectId } = req.params

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  try {
    const latestMessage = await prisma.message.findFirst({
      where: {
        projectId,
        role: "ASSISTANT",
        fragment: { isNot: null },
      },
      orderBy: { createdAt: "desc" },
      include: { fragment: true },
    })

    if (!latestMessage || !latestMessage.fragment) {
      res.status(404).json({ error: "No code fragment found to publish" })
      return
    }

    const publishedProject = await prisma.publishedProject.upsert({
      where: { projectId },
      create: {
        projectId,
        name: project.name,
        screenshotUrl: project.screenshotUrl,
        content: latestMessage.fragment.content,
        frontendTarKey: latestMessage.fragment.frontendTarKey,
        backendTarKey: latestMessage.fragment.backendTarKey,
      },
      update: {
        name: project.name,
        screenshotUrl: project.screenshotUrl,
        content: latestMessage.fragment.content,
        frontendTarKey: latestMessage.fragment.frontendTarKey,
        backendTarKey: latestMessage.fragment.backendTarKey,
      },
    })

    res.status(200).json({ publishedProject })
  } catch (error) {
    console.error("[projectsRouter.POST /:projectId/publish] Failed:", error)
    res.status(500).json({ error: "Failed to publish project" })
  }
})

// POST /api/projects/:projectId/unpublish — unpublish a project
projectsRouter.post("/:projectId/unpublish", async (req, res) => {
  const { projectId } = req.params

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  try {
    await prisma.publishedProject.delete({
      where: { projectId },
    })
    res.status(200).json({ message: "Project unpublished successfully" })
  } catch (error: any) {
    if (error.code === 'P2025') {
      // Record to delete does not exist
      res.status(200).json({ message: "Project was not published" })
      return
    }
    console.error("[projectsRouter.POST /:projectId/unpublish] Failed:", error)
    res.status(500).json({ error: "Failed to unpublish project" })
  }
})
