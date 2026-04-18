import { Router } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { SendMessageBodySchema } from "../models"

export const messagesRouter = Router({ mergeParams: true })

// POST /api/messages/:projectId
messagesRouter.post("/:projectId", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const parsed = SendMessageBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
    return
  }

  const { prompt } = parsed.data

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
