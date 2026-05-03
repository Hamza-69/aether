import { Router } from "express"
import { prisma } from "../lib/prisma"
import { inngest } from "../ai/inngest/client"
import { SendMessageBodySchema } from "../models"
import { ensureProjectOwnership } from "../lib/ensureProjectOwnership"

export const messagesRouter = Router({ mergeParams: true })

// GET /api/projects/:projectId/messages — list all messages for a project
messagesRouter.get("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  try {
    const messages = await prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        fragment: {
          select: {
            id: true,
            content: true,
            frontendTarKey: true,
            backendTarKey: true,
          },
        },
        stream: {
          include: {
            streamChunks: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    })
    res.status(200).json({ messages })
  } catch (error) {
    console.error("[messagesRouter.GET] Failed:", error)
    res.status(500).json({ error: "Failed to list messages" })
  }
})

// POST /api/projects/:projectId/messages — send a follow-up prompt
messagesRouter.post("/", async (req, res) => {
  const { projectId } = req.params as { projectId: string }

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  const parsed = SendMessageBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" })
    return
  }

  const { prompt } = parsed.data

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
