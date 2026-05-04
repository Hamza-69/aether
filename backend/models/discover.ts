import { z } from "../lib/zod"

export const PublishedProjectSchema = z
  .object({
    id: z.string().openapi({ example: "pub_123" }),
    name: z.string().openapi({ example: "My Cool App" }),
    screenshotUrl: z.string().nullable().openapi({ example: "https://example.com/screenshot.jpg" }),
    createdAt: z.string().datetime().openapi({ example: "2024-01-01T00:00:00Z" }),
    updatedAt: z.string().datetime().openapi({ example: "2024-01-01T00:00:00Z" }),
    projectId: z.string().openapi({ example: "proj_123" }),
    authorUsername: z.string().openapi({ example: "janedoe" }),
  })
  .openapi("PublishedProject")
