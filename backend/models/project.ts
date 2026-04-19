import { z } from "../lib/zod"

export const ProjectSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz123" }),
    name: z.string().openapi({ example: "my-todo-app" }),
    createdAt: z.string().datetime().openapi({ example: "2024-01-01T00:00:00Z" }),
    updatedAt: z.string().datetime().openapi({ example: "2024-01-01T00:00:00Z" }),
  })
  .openapi("Project")

export const CreateProjectBodySchema = z
  .object({
    prompt: z.string().min(1).openapi({ example: "Build a todo app." }),
    name: z.string().optional().openapi({
      example: "my-todo-app",
      description: "Auto-derived from prompt if omitted",
    }),
  })
  .openapi("CreateProjectBody")

export const ProjectPreviewSchema = z
  .object({
    url: z.string().url().openapi({ example: "https://8081-123.e2b.app" }),
    alreadyRunning: z
      .boolean()
      .optional()
      .openapi({ description: "Sandbox is already up and serving at url" }),
    scheduled: z
      .boolean()
      .optional()
      .openapi({ description: "A background job is bringing the sandbox up at url" }),
  })
  .openapi("ProjectPreview")
