import { inngest } from "../ai/inngest/client"
import { getSubscriptionToken } from "@inngest/realtime"
import express, { Router } from "express"
import { ensureProjectOwnership } from "../lib/ensureProjectOwnership"
import { prisma } from "../lib/prisma"

export const realtimeRouter: Router = express.Router()

// Each job publishes on a deterministic (channel, topic) pair derived from
// projectId. Clients only need to tell us which job stream they want.
const STREAM_TYPES = {
  "code-agent":        { channelPrefix: "project_code_agent",        topic: "ai" },
  "deploy":            { channelPrefix: "project_deploy",            topic: "deploy" },
  "export-apk":        { channelPrefix: "project_export_apk",        topic: "export-apk" },
  "generate-keystore": { channelPrefix: "project_generate_keystore", topic: "generate-keystore" },
  "preview":           { channelPrefix: "project_preview",           topic: "preview" },
} as const

type StreamType = keyof typeof STREAM_TYPES

const getPreviewStreamChunks = async (projectId: string, previewStartedAt: Date | null) => {
  const whereClause = previewStartedAt
    ? { projectId, createdAt: { gte: previewStartedAt } }
    : { projectId }

  const preview = await prisma.preview.findFirst({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      stream: {
        include: {
          streamChunks: {
            orderBy: { createdAt: "asc" },
            select: { data: true },
          },
        },
      },
    },
  })

  return preview?.stream?.streamChunks.map((chunk) => chunk.data) ?? []
}

realtimeRouter.post("/", async (req, res): Promise<void> => {
  const { projectId, type } = req.body as { projectId?: string; type?: StreamType }

  if (!projectId || !type) {
    res.status(400).json({ error: "Missing required fields: projectId, type" })
    return
  }

  const config = STREAM_TYPES[type]
  if (!config) {
    res.status(400).json({
      error: `Invalid type. Must be one of: ${Object.keys(STREAM_TYPES).join(", ")}`,
    })
    return
  }

  const project = await ensureProjectOwnership(projectId, req.user!.id)
  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  const channel = `${config.channelPrefix}:${req.user!.id}:${projectId}`

  const token = await getSubscriptionToken(inngest, {
    channel,
    topics: [config.topic],
  }) as any

  const streamChunks = type === "preview"
    ? await getPreviewStreamChunks(projectId, project.previewStartedAt)
    : []

  res.status(200).json({ token, channel, topic: config.topic, streamChunks })
})
