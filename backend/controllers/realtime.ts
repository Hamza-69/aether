import { inngest } from "../ai/inngest/client"
import { getSubscriptionToken } from "@inngest/realtime"
import express, { Router } from "express"
import { prisma } from "../lib/prisma"

export const realtimeRouter: Router = express.Router()

realtimeRouter.post("/", async (req, res): Promise<void> => {
  const { StreamableId, type, channel, topic } = req.body

  if (!StreamableId || !channel || !topic) {
    res.status(400).json({ error: "Missing required fields: StreamableId, channel, topic" })
    return
  }

  let streamableExists = false

  switch (type) {
    case "project":
      const project = await prisma.project.findUnique({ where: { id: StreamableId } })
      streamableExists = !!project
      break
    case "apk":
      const apk = await prisma.aPK.findUnique({ where: { id: StreamableId } })
      streamableExists = !!apk
      break
    case "deployment":
      const deployment = await prisma.deployment.findUnique({ where: { id: StreamableId } })
      streamableExists = !!deployment
      break
    case "keystore":
      const keystore = await prisma.keyStore.findUnique({ where: { id: StreamableId } })
      streamableExists = !!keystore
      break
    case "message":
      const message = await prisma.message.findUnique({ where: { id: StreamableId } })
      streamableExists = !!message
      break
    default:
      res.status(400).json({ error: "Invalid type. Must be one of: project, apk, deployment, keystore, message" })
      return
  }

  if (!streamableExists) {
    res.status(404).json({ error: "Streamable not found" })
    return
  }

  const token = await getSubscriptionToken(inngest, {
    channel,
    topics: [topic],
  }) as any

  res.status(200).json({ token })
})