import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi"
import { z } from "./lib/zod"
import {
  CreateProjectBodySchema,
  ErrorSchema,
  MessageSchema,
  ProjectPreviewSchema,
  ProjectSchema,
  SendMessageBodySchema,
} from "./models"

const registry = new OpenAPIRegistry()

registry.register("Project", ProjectSchema)
registry.register("ProjectPreview", ProjectPreviewSchema)
registry.register("Message", MessageSchema)
registry.register("Error", ErrorSchema)

registry.registerPath({
  method: "get",
  path: "/api/projects",
  tags: ["Projects"],
  summary: "List projects",
  responses: {
    200: {
      description: "Projects list",
      content: {
        "application/json": {
          schema: z.object({ projects: z.array(ProjectSchema) }),
        },
      },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/projects",
  tags: ["Projects"],
  summary: "Create a new project",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateProjectBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Project created and agent triggered",
      content: {
        "application/json": {
          schema: z.object({ project: ProjectSchema }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/projects/{projectId}/preview",
  tags: ["Projects"],
  summary: "Start (or reuse) the sandbox preview for a project",
  description:
    "Returns the sandbox preview URL immediately. Behavior: if the project already has a live sandbox (RUNNING and under 20 min and responding), returns it with alreadyRunning=true. If a preview job is SCHEDULED and under 5 min old, returns the pending url with scheduled=true. Otherwise provisions a new e2b sandbox, persists its url, enqueues the preview-project/run Inngest job, and returns 202 with scheduled=true.",
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Existing preview reused (alreadyRunning or still scheduled and fresh)",
      content: {
        "application/json": {
          schema: ProjectPreviewSchema,
        },
      },
    },
    202: {
      description: "New sandbox provisioned and background job enqueued",
      content: {
        "application/json": {
          schema: ProjectPreviewSchema,
        },
      },
    },
    404: {
      description: "Project or runnable fragment not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/messages/{projectId}",
  tags: ["Messages"],
  summary: "Send a follow-up prompt to an existing project",
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: SendMessageBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Message created and agent triggered",
      content: {
        "application/json": {
          schema: z.object({ message: MessageSchema }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Project not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

const generator = new OpenApiGeneratorV31(registry.definitions)

export const openApiSpec = generator.generateDocument({
  openapi: "3.1.0",
  info: { title: "Aether API", version: "1.0.0", description: "AI-powered code generation platform" },
  servers: [{ url: "http://localhost:3000" }],
})
