import { z } from "../lib/zod"

const SECRET_NAME = /^[A-Z_][A-Z0-9_]*$/

export const UserSecretEntrySchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(128)
      .regex(SECRET_NAME, "name must be UPPER_SNAKE_CASE")
      .openapi({ example: "OPENAI_API_KEY" }),
    encryptedValue: z
      .string()
      .min(1)
      .openapi({
        example: "base64-ciphertext",
        description:
          "Base64 of [IV(12) | AuthTag(16) | ciphertext] encrypted with CLIENT_SECRET_KEY (AES-256-GCM).",
      }),
  })
  .openapi("UserSecretEntry")

export const UpsertUserSecretsBodySchema = z
  .object({
    secrets: z.array(UserSecretEntrySchema).min(1).max(100),
  })
  .openapi("UpsertUserSecretsBody")

export const UserSecretSummarySchema = z
  .object({
    name: z.string().openapi({ example: "OPENAI_API_KEY" }),
    updatedAt: z.string().datetime(),
  })
  .openapi("UserSecretSummary")
