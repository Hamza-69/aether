import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi"
import { z } from "./lib/zod"
import {
  CreateProjectBodySchema,
  ErrorSchema,
  MessageSchema,
  ProjectPreviewSchema,
  ProjectSchema,
  SecretEntrySchema,
  SecretSummarySchema,
  SendMessageBodySchema,
  UpsertSecretsBodySchema,
  DeploymentSchema,
  DeployResponseSchema,
} from "./models"

const registry = new OpenAPIRegistry()

registry.register("Project", ProjectSchema)
registry.register("ProjectPreview", ProjectPreviewSchema)
registry.register("Message", MessageSchema)
registry.register("Error", ErrorSchema)
registry.register("SecretEntry", SecretEntrySchema)
registry.register("SecretSummary", SecretSummarySchema)
registry.register("UpsertSecretsBody", UpsertSecretsBodySchema)
registry.register("Deployment", DeploymentSchema)
registry.register("DeployResponse", DeployResponseSchema)

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

registry.registerPath({
  method: "get",
  path: "/api/projects/{projectId}/secrets",
  tags: ["Secrets"],
  summary: "List secret names for a project",
  description:
    "Returns only names and updatedAt timestamps. Values are never returned by the API.",
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Secret summaries",
      content: {
        "application/json": {
          schema: z.object({ secrets: z.array(SecretSummarySchema) }),
        },
      },
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

registry.registerPath({
  method: "post",
  path: "/api/projects/{projectId}/secrets",
  tags: ["Secrets"],
  summary: "Write or overwrite one or more project secrets",
  description:
    "Each encryptedValue is base64 of [IV(12) | AuthTag(16) | ciphertext] AES-256-GCM-encrypted with CLIENT_SECRET_KEY. The server decrypts with CLIENT_SECRET_KEY and re-encrypts at rest with ENCRYPTION_MASTER_KEY. Upserts by (projectId, name).",
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
    body: {
      required: true,
      content: { "application/json": { schema: UpsertSecretsBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Secrets written/overwritten",
      content: {
        "application/json": {
          schema: z.object({ written: z.array(z.string()) }),
        },
      },
    },
    400: {
      description: "Invalid body or decryption failure",
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

registry.registerPath({
  method: "delete",
  path: "/api/projects/{projectId}/secrets/{name}",
  tags: ["Secrets"],
  summary: "Delete a secret by name",
  request: {
    params: z.object({
      projectId: z.string().openapi({ example: "clxyz123" }),
      name: z.string().openapi({ example: "OPENAI_API_KEY" }),
    }),
  },
  responses: {
    204: { description: "Deleted" },
    404: {
      description: "Project or secret not found",
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
  path: "/api/projects/{projectId}/deploy",
  tags: ["Deployments"],
  summary: "Deploy the project's latest backend fragment to Fly.io",
  description:
    "Validates that the project has a FLY_API_TOKEN secret and a runnable fragment, then enqueues the deploy-project/run Inngest job. The job restores the latest backend tar in a sandbox, runs deploy.sh (which does `fly launch` on first deploy and `fly deploy` on redeploys), pushes the project's .env.example keys as Fly secrets, records a new Deployment row, and emits a new assistant message + fragment linking to the deployment URL. Returns 202 immediately; the deployment completes asynchronously.",
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    202: {
      description: "Deployment scheduled",
      content: { "application/json": { schema: DeployResponseSchema } },
    },
    400: {
      description: "FLY_API_TOKEN secret is not set for this project",
      content: { "application/json": { schema: ErrorSchema } },
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
  method: "get",
  path: "/api/projects/{projectId}/deployments",
  tags: ["Deployments"],
  summary: "List all deployments for a project (read-only)",
  description:
    "Returns every deployment recorded for the project, newest first. Each deployment keeps its own URL so previous URLs remain resolvable if a later deployment changes the app hostname. Deployments are created only by the deploy-project background job; there is no PATCH/DELETE endpoint.",
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Deployments list (most recent first)",
      content: {
        "application/json": {
          schema: z.object({ deployments: z.array(DeploymentSchema) }),
        },
      },
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
