import { Router } from "express"
import { Sandbox } from "e2b"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { CreateProjectBodySchema } from "../models"
import { secretsRouter } from "./secrets"
import { deploymentsRouter, deployProjectHandler } from "./deployments"

export const projectsRouter = Router()

projectsRouter.use("/:projectId/secrets", secretsRouter)
projectsRouter.use("/:projectId/deployments", deploymentsRouter)
projectsRouter.post("/:projectId/deploy", deployProjectHandler)

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

const startPreviewJob = async (projectId: string) => {
  const sandbox = await Sandbox.create("coding-preview")
  await sandbox.setTimeout(60_000 * 10 * 3)
  const url = `https://8081-${sandbox.sandboxId}.e2b.app`

  await prisma.project.update({
    where: { id: projectId },
    data: {
      previewUrl: url,
      previewStatus: "SCHEDULED",
      previewStartedAt: new Date(),
    },
  })

  await inngest.send({
    name: "preview-project/run",
    data: { projectId, sandboxId: sandbox.sandboxId },
  })

  return url
}

projectsRouter.get("/", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    })
    res.status(200).json({ projects })
  } catch (error) {
    console.error("[projectsRouter.GET] Failed to list projects:", error)
    res.status(500).json({ error: "Failed to list projects" })
  }
})

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
      data: { name: projectName },
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

projectsRouter.post("/:projectId/preview", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    res.status(404).json({ error: "project not found" })
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

    if (project.previewStatus === "RUNNING" && project.previewUrl && elapsedMin <= RUNNING_MAX_MIN) {
      const alive = await isSandboxUrlAlive(project.previewUrl)
      if (alive) {
        res.status(200).json({ url: project.previewUrl, alreadyRunning: true })
        return
      }
    }

    if (
      project.previewStatus === "SCHEDULED" &&
      project.previewUrl &&
      elapsedMin <= SCHEDULED_STUCK_MIN
    ) {
      res.status(200).json({ url: project.previewUrl, scheduled: true })
      return
    }

    const url = await startPreviewJob(projectId)
    res.status(202).json({ url, scheduled: true })
  } catch (error) {
    console.error("[projectsRouter.POST /:projectId/preview] Failed:", error)
    res.status(500).json({ error: "Failed to run preview" })
  }
})
