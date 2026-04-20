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

registry.registerPath({
  method: "get",
  path: "/api/projects/{projectId}/keystore",
  tags: ["Keystore"],
  summary: "Get keystore status and presence for a project",
  description:
    "Returns whether a keystore has been generated for this project, plus the current keyStoreStatus lock. Keystore bytes and password are never returned by the API.",
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Keystore summary",
      content: { "application/json": { schema: KeyStoreSummarySchema } },
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
    "Unique idempotency rules: (a) if a keystore already exists, returns 200 with alreadyExists=true and does NOT regenerate (regenerating would orphan previously-signed APKs). (b) if keyStoreStatus is SCHEDULED/RUNNING under the stale cutoff, returns 409. (c) otherwise atomically claims the IDLE→SCHEDULED lock and enqueues the generate-keystore/run Inngest job. You can optionally pass subject overrides in the request body. Missing subject fields are auto-derived from the project name (countryCode defaults to US). The job spins up a generate-keystore sandbox, generates a random base64 password via openssl, runs keytool to produce a PKCS12 release.keystore, and persists both (encrypted password + keystore bytes) in the KeyStore row for the project. Returns 202 when scheduled; generation completes asynchronously.",
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

registry.registerPath({
  method: "get",
  path: "/api/projects/{projectId}/apks",
  tags: ["APK"],
  summary: "List all exported APKs for a project (read-only)",
  description:
    "Returns every APK exported for the project, newest first. Each APK row's `url` is the S3/Tigris object key under the project's bucket; resolve it to a download URL via the storage layer. APKs are created only by the export-apk background job.",
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
    "Returns a presigned S3/Tigris URL for the APK artifact that is valid for 1 hour. The client should use this URL directly to download the .apk file. After expiry, request a fresh URL from this endpoint.",
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
    "Validates that the project has (a) a keystore generated via POST /api/projects/{projectId}/keystore, (b) an EXPO_TOKEN secret (Expo personal access token used to auth eas-cli), (c) at least one prior deployment (whose URL becomes EXPO_PUBLIC_API_URL in the APK's .env), and (d) a runnable frontend fragment. Then atomically claims the apkStatus IDLE→SCHEDULED lock and enqueues the export-apk/run Inngest job. The job restores the latest frontend tar in a lightweight eas-cli sandbox, writes .env with EXPO_PUBLIC_API_URL pointing to the latest deployment, writes the decrypted keystore bytes to my-upload-key.keystore in the frontend root, runs eas-build.sh (which writes credentials.json + eas.json for local-credentials signing, then invokes `eas build --platform android --profile production-apk --non-interactive --json` blocking). The resulting artifact URL is fetched from the EAS JSON output, the APK is downloaded and uploaded to S3, an APK row is recorded, and an assistant message is emitted. Returns 202 immediately; the export completes asynchronously.",
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

const generator = new OpenApiGeneratorV31(registry.definitions)

export const openApiSpec = generator.generateDocument({
  openapi: "3.1.0",
  info: { title: "Aether API", version: "1.0.0", description: "AI-powered code generation platform" },
  servers: [{ url: "http://localhost:3000" }],
})
