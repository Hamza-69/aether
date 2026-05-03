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
  UserSecretEntrySchema,
  UserSecretSummarySchema,
  UpsertUserSecretsBodySchema,
  PublishedProjectSchema,
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

registry.register("UserSecretEntry", UserSecretEntrySchema)
registry.register("UserSecretSummary", UserSecretSummarySchema)
registry.register("UpsertUserSecretsBody", UpsertUserSecretsBodySchema)

registry.register("PublishedProject", PublishedProjectSchema)

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

// ── Auth: Sign Up ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/auth/signup",
  tags: ["Auth"],
  summary: "Start sign-up (sends OTP to email)",
  description:
    "Validates the name, username, email, and password, then sends a 6-digit OTP code to the provided email address. Returns a challengeId that must be used in the verify step. The code expires in 10 minutes.",
  responses: {
    200: {
      description: "OTP sent",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            challengeId: z.string(),
            expiresAt: z.number(),
          }),
        },
      },
    },
    400: {
      description: "Missing required fields",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Email already in use or username taken",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              name: z.string().openapi({ example: "Jane Doe" }),
              username: z.string().openapi({ example: "janedoe" }),
              email: z.string().email().openapi({ example: "jane@example.com" }),
              password: z.string().min(6).openapi({ example: "securePassword123" }),
            })
            .openapi("SignupBody"),
        },
      },
    },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/auth/signup/verify",
  tags: ["Auth"],
  summary: "Verify sign-up OTP and create the user account",
  description:
    "Validates the OTP code against the challenge. On success, creates the user in the database and returns a JWT token.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              challengeId: z.string().openapi({ example: "1714700000_abc123" }),
              code: z.string().openapi({ example: "123456" }),
            })
            .openapi("VerifyOtpBody"),
        },
      },
    },
  },
  responses: {
    201: {
      description: "User created and authenticated",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            token: z.string(),
            user: UserSchema,
          }),
        },
      },
    },
    400: {
      description: "Invalid or expired code / challenge",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Email or username was taken between initiation and verification",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

// ── Auth: Sign In ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/auth/signin",
  tags: ["Auth"],
  summary: "Sign in with email and password",
  description:
    "Validates email and password, and on success returns a JWT token and user info.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              email: z.string().email().openapi({ example: "jane@example.com" }),
              password: z.string().openapi({ example: "securePassword123" }),
            })
            .openapi("SigninBody"),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Authenticated",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            token: z.string(),
            user: UserSchema,
          }),
        },
      },
    },
    400: {
      description: "Missing required fields",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Invalid email or password",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})


// ── Auth: Forgot / Reset Password ───────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/auth/password/forgot",
  tags: ["Auth"],
  summary: "Request a password-reset OTP",
  description:
    "Sends a 6-digit OTP to the email address if a matching user exists. Returns a challengeId for the verify step.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              email: z.string().email().openapi({ example: "jane@example.com" }),
            })
            .openapi("ForgotPasswordBody"),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reset OTP sent",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            challengeId: z.string(),
            expiresAt: z.number(),
          }),
        },
      },
    },
    400: {
      description: "Email is required",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "No user found with this email",
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
  path: "/api/auth/password/verify",
  tags: ["Auth"],
  summary: "Verify the password-reset OTP",
  description:
    "Confirms the OTP is correct. Marks the challenge as verified so the final reset step can proceed.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            challengeId: z.string().openapi({ example: "1714700000_abc123" }),
            code: z.string().openapi({ example: "123456" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Code verified — proceed to reset",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            challengeId: z.string(),
            expiresAt: z.number(),
          }),
        },
      },
    },
    400: {
      description: "Invalid or expired code / challenge",
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
  path: "/api/auth/password/reset",
  tags: ["Auth"],
  summary: "Set a new password after OTP verification",
  description:
    "Requires a verified challengeId from the previous step. Updates the user's password.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              challengeId: z.string().openapi({ example: "1714700000_abc123" }),
              password: z.string().min(6).openapi({ example: "newSecurePassword456" }),
            })
            .openapi("ResetPasswordBody"),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Password changed",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: {
      description: "Invalid challenge, expired, not verified, or weak password",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

// ── Auth: Change Password (authenticated) ───────────────────────────────────

registry.registerPath({
  method: "put",
  path: "/api/auth/me/password",
  tags: ["Auth"],
  summary: "Change password for the current user",
  description:
    "Requires the current password for verification. New password must be at least 6 characters and different from the current one.",
  security: protectedRoute,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              currentPassword: z.string().openapi({ example: "oldPassword123" }),
              newPassword: z.string().min(6).openapi({ example: "newPassword456" }),
            })
            .openapi("ChangePasswordBody"),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Password changed",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: {
      description: "Missing fields, weak password, or same as current",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Current password is incorrect or not authenticated",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

// ── Auth: Profile Picture ───────────────────────────────────────────────────

registry.registerPath({
  method: "put",
  path: "/api/auth/me/profile-picture",
  tags: ["Auth"],
  summary: "Upload or replace profile picture",
  description:
    "Accepts a base64-encoded image (max 5 MB). Supported types: image/png, image/jpeg, image/webp, image/gif. The image is uploaded to S3 and the URL is returned.",
  security: protectedRoute,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              image: z.string().openapi({ description: "Base64-encoded image data" }),
              mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]).openapi({ example: "image/png" }),
            })
            .openapi("UploadProfilePictureBody"),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Profile picture updated",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            profilePictureUrl: z.string().url(),
          }),
        },
      },
    },
    400: {
      description: "Missing fields, unsupported type, or image too large",
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
  method: "delete",
  path: "/api/auth/me/profile-picture",
  tags: ["Auth"],
  summary: "Remove profile picture",
  description: "Clears the user's profile picture from their account.",
  security: protectedRoute,
  responses: {
    200: {
      description: "Profile picture removed",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
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
  path: "/api/projects/{projectId}/publish",
  tags: ["Projects"],
  summary: "Publish a project",
  description: "Publishes the project's latest fragment to the discover page. Upserts a PublishedProject.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Project published",
      content: {
        "application/json": {
          schema: z.object({ publishedProject: PublishedProjectSchema }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Project or fragment not found",
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
  path: "/api/projects/{projectId}/unpublish",
  tags: ["Projects"],
  summary: "Unpublish a project",
  description: "Removes the project from the discover page.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
    200: {
      description: "Project unpublished",
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
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

registry.registerPath({
  method: "post",
  path: "/api/projects/{projectId}/preview/restart",
  tags: ["Projects"],
  summary: "Force restart the sandbox preview for a project",
  description:
    "Kills the existing e2b sandbox if one is tracked, provisions a new sandbox, enqueues the preview-project/run Inngest job, and returns 202 with scheduled=true. Has a rate limit of 1 restart per minute per project.",
  security: protectedRoute,
  request: {
    params: z.object({ projectId: z.string().openapi({ example: "clxyz123" }) }),
  },
  responses: {
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
    429: {
      description: "Rate limit exceeded",
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

// ── User Secrets ────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/secrets",
  tags: ["User Secrets"],
  summary: "List user account-level secret names",
  description: "Returns only names and updatedAt timestamps for the user's account secrets.",
  security: protectedRoute,
  responses: {
    200: {
      description: "Secret summaries",
      content: {
        "application/json": {
          schema: z.object({ secrets: z.array(UserSecretSummarySchema) }),
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
  method: "post",
  path: "/api/secrets",
  tags: ["User Secrets"],
  summary: "Write or overwrite user account-level secrets",
  security: protectedRoute,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: UpsertUserSecretsBodySchema } },
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
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

registry.registerPath({
  method: "delete",
  path: "/api/secrets/{name}",
  tags: ["User Secrets"],
  summary: "Delete a user account-level secret by name",
  security: protectedRoute,
  request: {
    params: z.object({
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
      description: "Secret not found",
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

// ── Discover ────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/discover",
  tags: ["Discover"],
  summary: "List all published projects",
  security: protectedRoute,
  responses: {
    200: {
      description: "Published projects list",
      content: {
        "application/json": {
          schema: z.object({ publishedProjects: z.array(PublishedProjectSchema) }),
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
  path: "/api/discover/{id}",
  tags: ["Discover"],
  summary: "Get a published project by ID",
  security: protectedRoute,
  request: {
    params: z.object({ id: z.string().openapi({ example: "pub_123" }) }),
  },
  responses: {
    200: {
      description: "Published project details",
      content: {
        "application/json": {
          schema: z.object({ publishedProject: PublishedProjectSchema }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Published project not found",
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
  path: "/api/discover/{id}/clone",
  tags: ["Discover"],
  summary: "Clone a published project",
  description: "Creates a new project for the current user, copying the code from the published project.",
  security: protectedRoute,
  request: {
    params: z.object({ id: z.string().openapi({ example: "pub_123" }) }),
  },
  responses: {
    201: {
      description: "Project cloned successfully",
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
      description: "Published project not found",
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
