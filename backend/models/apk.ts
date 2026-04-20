import { z } from "../lib/zod"

export const APKSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz123" }),
    url: z.string().openapi({ example: "apks/apk_clxyz123_1712345678901.apk" }),
    projectId: z.string().openapi({ example: "clxyz123" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("APK")

export const ExportApkResponseSchema = z
  .object({
    scheduled: z.boolean().openapi({ example: true }),
  })
  .openapi("ExportApkResponse")

export const ApkDownloadUrlSchema = z
  .object({
    url: z.string().url().openapi({
      example: "https://fly.storage.tigris.dev/...signed...",
      description: "Presigned download URL, valid for 1 hour",
    }),
    expiresAt: z.string().datetime().openapi({
      description: "ISO timestamp at which the url stops working",
    }),
    expiresInSeconds: z.number().int().openapi({ example: 3600 }),
  })
  .openapi("ApkDownloadUrl")

export const KeyStoreSummarySchema = z
  .object({
    exists: z.boolean().openapi({ example: true }),
    status: z.enum(["IDLE", "SCHEDULED", "RUNNING"]).openapi({ example: "IDLE" }),
    keystore: z
      .object({
        id: z.string(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .nullable(),
  })
  .openapi("KeyStoreSummary")

export const GenerateKeystoreResponseSchema = z
  .object({
    scheduled: z.boolean().openapi({ example: true }),
    alreadyExists: z.boolean().optional().openapi({ example: false }),
  })
  .openapi("GenerateKeystoreResponse")

export const KeystoreSubjectSchema = z
  .object({
    commonName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .openapi({ example: "my-todo-app" }),
    organizationalUnit: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .openapi({ example: "mobile" }),
    organization: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .openapi({ example: "Acme Inc" }),
    locality: z.string().trim().min(1).max(100).optional().openapi({ example: "Beirut" }),
    state: z.string().trim().min(1).max(100).optional().openapi({ example: "Mount Lebanon" }),
    countryCode: z
      .string()
      .trim()
      .regex(/^[a-zA-Z]{2}$/, "countryCode must be a 2-letter ISO code")
      .optional()
      .openapi({ example: "LB" }),
  })
  .openapi("KeystoreSubject")

export const GenerateKeystoreBodySchema = z
  .object({
    subject: KeystoreSubjectSchema.optional().openapi({
      description:
        "Optional keytool distinguished-name overrides. Missing fields are derived from the project name. countryCode defaults to US.",
    }),
  })
  .openapi("GenerateKeystoreBody")
