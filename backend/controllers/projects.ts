import { Router } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"

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
  const { name, prompt } = req.body
  console.log(`[projectsRouter.POST] name=${name || "(none)"}, prompt length: ${prompt?.length || 0}`)

  if (!prompt) {
    console.warn(`[projectsRouter.POST] Validation failed - prompt is required`)
    res.status(400).json({ error: "prompt is required" })
    return
  }

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
