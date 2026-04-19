import { z } from "../lib/zod"

const SECRET_NAME = /^[A-Z_][A-Z0-9_]*$/

export const SecretEntrySchema = z
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
  .openapi("SecretEntry")

export const UpsertSecretsBodySchema = z
  .object({
    secrets: z.array(SecretEntrySchema).min(1).max(100),
  })
  .openapi("UpsertSecretsBody")

export const SecretSummarySchema = z
  .object({
    name: z.string().openapi({ example: "OPENAI_API_KEY" }),
    updatedAt: z.string().datetime(),
  })
  .openapi("SecretSummary")
