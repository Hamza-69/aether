import { z } from "zod"

export const MessageSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz456" }),
    projectId: z.string().openapi({ example: "clxyz123" }),
    content: z.string().openapi({ example: "Build a todo app with React" }),
    role: z.enum(["USER", "ASSISTANT"]),
    type: z.enum(["SUCCESS", "ERROR"]),
    createdAt: z.string().datetime().openapi({ example: "2024-01-01T00:00:00Z" }),
    updatedAt: z.string().datetime().openapi({ example: "2024-01-01T00:00:00Z" }),
  })
  .openapi("Message")

export const SendMessageBodySchema = z
  .object({
    prompt: z.string().min(1).openapi({ example: "Add dark mode support" }),
  })
  .openapi("SendMessageBody")
