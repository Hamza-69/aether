import { Router } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"

export const messagesRouter = Router({ mergeParams: true })

// POST /api/projects/:projectId/messages
// Sends a follow-up prompt to an existing project and fires the agent
messagesRouter.post("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }
  const { prompt } = req.body

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" })
    return
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    res.status(404).json({ error: "project not found" })
    return
  }

  try {
    const message = await prisma.message.create({
      data: {
        projectId,
        content: prompt,
        role: "USER",
        type: "SUCCESS",
      },
    })

    await inngest.send({
      name: "code-agent/run",
      data: {
        value: prompt,
        projectId,
      },
    })

    res.status(201).json({ message })
  } catch (error) {
    console.error("[messagesRouter.POST] Failed:", error)
    res.status(500).json({ error: "Failed to send message" })
  }
})
