import { z } from "../lib/zod"

export const DeploymentSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz123" }),
    url: z.string().url().openapi({ example: "https://my-app.fly.dev" }),
    projectId: z.string().openapi({ example: "clxyz123" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Deployment")

export const DeployResponseSchema = z
  .object({
    scheduled: z.boolean().openapi({ example: true }),
  })
  .openapi("DeployResponse")
