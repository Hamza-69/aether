import { Router } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { CreateProjectBodySchema } from "../models"

export const projectsRouter = Router()

const toKebabCase = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)

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
