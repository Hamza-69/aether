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
  APKSchema,
  ApkDownloadUrlSchema,
  ExportApkResponseSchema,
  KeyStoreSummarySchema,
  GenerateKeystoreResponseSchema,
  GenerateKeystoreBodySchema,
} from "./models"

const registry = new OpenAPIRegistry()

// ── Security scheme ──────────────────────────────────────────────────────────
registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
})

const protectedRoute = [{ BearerAuth: [] }]

// ── Schema registration ─────────────────────────────────────────────────────
registry.register("Project", ProjectSchema)
registry.register("ProjectPreview", ProjectPreviewSchema)
registry.register("Message", MessageSchema)
registry.register("Error", ErrorSchema)
registry.register("SecretEntry", SecretEntrySchema)
registry.register("SecretSummary", SecretSummarySchema)
registry.register("UpsertSecretsBody", UpsertSecretsBodySchema)
registry.register("Deployment", DeploymentSchema)
registry.register("DeployResponse", DeployResponseSchema)
registry.register("APK", APKSchema)
registry.register("ApkDownloadUrl", ApkDownloadUrlSchema)
registry.register("ExportApkResponse", ExportApkResponseSchema)
registry.register("KeyStoreSummary", KeyStoreSummarySchema)
registry.register("GenerateKeystoreResponse", GenerateKeystoreResponseSchema)
registry.register("GenerateKeystoreBody", GenerateKeystoreBodySchema)

const UserSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz123" }),
    name: z.string().openapi({ example: "Jane Doe" }),
    username: z.string().openapi({ example: "janedoe" }),
    email: z.string().email().openapi({ example: "jane@example.com" }),
    createdAt: z.string().datetime().openapi({ example: "2024-01-01T00:00:00Z" }),
  })
  .openapi("User")

registry.register("User", UserSchema)

// ── Auth routes (public) ────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/auth/me",
  tags: ["Auth"],
  summary: "Get current authenticated user",
  security: protectedRoute,
  responses: {
    200: {
      description: "Current user",
      content: {
        "application/json": {
          schema: z.object({ user: UserSchema }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

// ── Projects ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/projects",
  tags: ["Projects"],
  summary: "List projects owned by the authenticated user",
  security: protectedRoute,
  responses: {
    200: {
      description: "Projects list",
      content: {
        "application/json": {
          schema: z.object({ projects: z.array(ProjectSchema) }),
        },
      },
    },
    401: {
      description: "Unauthorized",
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
  path: "/api/projects/{projectId}",
  tags: ["Projects"],
  summary: "Get a single project by ID",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Project details",
      content: {
        "application/json": {
          schema: z.object({ project: ProjectSchema }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Project not found or not owned by user",
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
  path: "/api/projects",
  tags: ["Projects"],
  summary: "Create a new project",
  security: protectedRoute,
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
    401: {
      description: "Unauthorized",
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
  security: protectedRoute,
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
    401: {
      description: "Unauthorized",
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

// ── Messages ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/projects/{projectId}/messages",
  tags: ["Messages"],
  summary: "List all messages for a project",
  description:
    "Returns all messages for the project in chronological order (oldest first). Each assistant message includes its linked fragment content.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Messages list",
      content: {
        "application/json": {
          schema: z.object({ messages: z.array(MessageSchema) }),
        },
      },
    },
    401: {
      description: "Unauthorized",
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
  method: "post",
  path: "/api/projects/{projectId}/messages",
  tags: ["Messages"],
  summary: "Send a follow-up prompt to an existing project",
  security: protectedRoute,
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
    401: {
      description: "Unauthorized",
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

// ── Secrets ─────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/projects/{projectId}/secrets",
  tags: ["Secrets"],
  summary: "List secret names for a project",
  description:
    "Returns only names and updatedAt timestamps. Values are never returned by the API.",
  security: protectedRoute,
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
    401: {
      description: "Unauthorized",
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
  method: "post",
  path: "/api/projects/{projectId}/secrets",
  tags: ["Secrets"],
  summary: "Write or overwrite one or more project secrets",
  description:
    "Each encryptedValue is base64 of [IV(12) | AuthTag(16) | ciphertext] AES-256-GCM-encrypted with CLIENT_SECRET_KEY. The server decrypts with CLIENT_SECRET_KEY and re-encrypts at rest with ENCRYPTION_MASTER_KEY. Upserts by (projectId, name).",
  security: protectedRoute,
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
    401: {
      description: "Unauthorized",
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
  security: protectedRoute,
  request: {
    params: z.object({
      projectId: z.string().openapi({ example: "clxyz123" }),
      name: z.string().openapi({ example: "OPENAI_API_KEY" }),
    }),
  },
  responses: {
    204: { description: "Deleted" },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
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

// ── Deployments ─────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/projects/{projectId}/deploy",
  tags: ["Deployments"],
  summary: "Deploy the project's latest backend fragment to Fly.io",
  description:
    "Validates that the project has a FLY_API_TOKEN secret and a runnable fragment, then enqueues the deploy-project/run Inngest job. Returns 202 immediately; the deployment completes asynchronously.",
  security: protectedRoute,
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
    401: {
      description: "Unauthorized",
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
    "Returns every deployment recorded for the project, newest first.",
  security: protectedRoute,
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
    401: {
      description: "Unauthorized",
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

// ── Keystore ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/projects/{projectId}/keystore",
  tags: ["Keystore"],
  summary: "Get keystore status and presence for a project",
  description:
    "Returns whether a keystore has been generated for this project, plus the current keyStoreStatus lock. Keystore bytes and password are never returned by the API.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Keystore summary",
      content: { "application/json": { schema: KeyStoreSummarySchema } },
    },
    401: {
      description: "Unauthorized",
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
  method: "post",
  path: "/api/projects/{projectId}/keystore",
  tags: ["Keystore"],
  summary: "Generate and store a signing keystore for the project",
  description:
    "Unique idempotency rules: (a) if a keystore already exists, returns 200 with alreadyExists=true and does NOT regenerate. (b) if keyStoreStatus is SCHEDULED/RUNNING under the stale cutoff, returns 409. (c) otherwise atomically claims the IDLE→SCHEDULED lock and enqueues the generate-keystore/run Inngest job.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
    body: {
      required: false,
      content: { "application/json": { schema: GenerateKeystoreBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Keystore already exists — no-op",
      content: { "application/json": { schema: GenerateKeystoreResponseSchema } },
    },
    202: {
      description: "Keystore generation scheduled",
      content: { "application/json": { schema: GenerateKeystoreResponseSchema } },
    },
    400: {
      description: "Invalid request body",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Project not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Keystore generation already in progress",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

// ── APK ─────────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/projects/{projectId}/apks",
  tags: ["APK"],
  summary: "List all exported APKs for a project (read-only)",
  description:
    "Returns every APK exported for the project, newest first.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "APKs list (most recent first)",
      content: {
        "application/json": {
          schema: z.object({ apks: z.array(APKSchema) }),
        },
      },
    },
    401: {
      description: "Unauthorized",
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
  path: "/api/projects/{projectId}/apks/{apkId}/download-url",
  tags: ["APK"],
  summary: "Get a time-limited download URL for an exported APK",
  description:
    "Returns a presigned S3/Tigris URL for the APK artifact that is valid for 1 hour.",
  security: protectedRoute,
  request: {
    params: z.object({
      projectId: z.string().openapi({ example: "clxyz123" }),
      apkId: z.string().openapi({ example: "clapk456" }),
    }),
  },
  responses: {
    200: {
      description: "Presigned download URL (valid 1 hour)",
      content: { "application/json": { schema: ApkDownloadUrlSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "APK not found for this project",
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
  path: "/api/projects/{projectId}/export-apk",
  tags: ["APK"],
  summary: "Export a signed Android APK for the project's frontend",
  description:
    "Validates prerequisites (keystore, EXPO_TOKEN secret, prior deployment, runnable frontend fragment), then enqueues the export-apk/run Inngest job. Returns 202 immediately.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    202: {
      description: "APK export scheduled",
      content: { "application/json": { schema: ExportApkResponseSchema } },
    },
    400: {
      description:
        "Keystore not generated, EXPO_TOKEN secret not set, or no deployment exists for this project",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Project or runnable frontend fragment not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "An APK export is already in progress for this project",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

// ── Realtime ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/realtime",
  tags: ["Realtime"],
  summary: "Get a subscription token for a project's realtime stream",
  description:
    "Returns an Inngest realtime subscription token for the given project and stream type. The client uses this token to subscribe to live updates.",
  security: protectedRoute,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            projectId: z.string().openapi({ example: "clxyz123" }),
            type: z.enum(["code-agent", "deploy", "export-apk", "generate-keystore", "preview"]),
          }).openapi("RealtimeSubscriptionRequest"),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Subscription token",
      content: {
        "application/json": {
          schema: z.object({
            token: z.any(),
            channel: z.string(),
            topic: z.string(),
          }).openapi("RealtimeSubscriptionResponse"),
        },
      },
    },
    400: {
      description: "Missing or invalid fields",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Project not found",
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
