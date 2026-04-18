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
    prompt: z.string().min(1).openapi({ example: "Build a todo app with React" }),
    name: z.string().optional().openapi({
      example: "my-todo-app",
      description: "Auto-derived from prompt if omitted",
    }),
  })
  .openapi("CreateProjectBody")
