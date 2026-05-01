import { Sandbox } from "e2b"
import { AgentResult, TextMessage } from "@inngest/agent-kit"
import { prisma } from "./prisma"
import { Prisma } from "../generated/prisma/client"

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId)
  await sandbox.setTimeout(60_000*10*3) // 30 mins
  return sandbox
}

export function lastAssistantTextMessageContent(result: AgentResult) {
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message) => message.role ==="assistant",
  )

  const message = result.output[lastAssistantTextMessageIndex] as 
  | TextMessage 
  | undefined

  return message?.content
  ? typeof message.content === "string"
    ? message.content
    : message.content.map((c) => c.text).join("")
    : undefined
}

export async function publish(publishCallback: Function, channel: string, topic: string, data: Prisma.InputJsonValue, streamId: string) {
  await publishCallback({
    channel,
    topic,
    data,
  })

  await prisma.streamChunk.create({
    data: {
      streamId,
      data
    }
  })
}