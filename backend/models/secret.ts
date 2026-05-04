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
      .optional()
      .openapi({
        example: "base64-ciphertext",
        description:
          "Base64 of [IV(12) | AuthTag(16) | ciphertext] encrypted with CLIENT_SECRET_KEY (AES-256-GCM).",
      }),
    useUserSecret: z.boolean().default(false).openapi({ example: false }),
  })
  .refine(
    (data) => data.useUserSecret || (data.encryptedValue !== undefined && data.encryptedValue.length > 0),
    "Must provide encryptedValue if useUserSecret is false",
  )
  .openapi("SecretEntry")

export const UpsertSecretsBodySchema = z
  .object({
    secrets: z.array(SecretEntrySchema).min(1).max(100),
  })
  .openapi("UpsertSecretsBody")

export const SecretSummarySchema = z
  .object({
    name: z.string().openapi({ example: "OPENAI_API_KEY" }),
    useUserSecret: z.boolean().openapi({ example: false }),
    updatedAt: z.string().datetime(),
  })
  .openapi("SecretSummary")

export const RequiredSecretSummarySchema = z
  .object({
    name: z.string().openapi({ example: "OPENAI_API_KEY" }),
    isSet: z.boolean().openapi({ example: false }),
    useUserSecret: z.boolean().openapi({ example: false }),
    updatedAt: z.string().datetime(),
  })
  .openapi("RequiredSecretSummary")
