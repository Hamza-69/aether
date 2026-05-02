import express from "express"
import { serve } from "inngest/express"
import { inngest } from "./ai/inngest/client"
import cors from "cors"
import morgan from "morgan"
import { projectsRouter } from "./controllers/projects"
import { authRouter } from "./controllers/auth"
import { userSecretsRouter } from "./controllers/userSecrets"
import { codeAgentFunction } from "./ai/inngest/jobs/agent"
import { previewProjectFunction } from "./ai/inngest/jobs/preview"
import { deployProjectFunction } from "./ai/inngest/jobs/deploy"
import { generateKeystoreFunction } from "./ai/inngest/jobs/generate-keystore"
import { exportApkFunction } from "./ai/inngest/jobs/export-apk"
import { apiReference } from "@scalar/express-api-reference"
import { openApiSpec } from "./openapi-registry"
import { requireAuth } from "./lib/auth"
import { realtimeRouter } from "./controllers/realtime"

const app = express()

app.use(cors())
app.use(express.json({ limit: "500mb" }))

morgan.token("body", (req: express.Request) => {
  return JSON.stringify(req.body)
})

app.use(morgan(":method :url :status :res[content-length] :response-time ms"))

app.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec)
})

app.use(
  "/api/docs",
  apiReference({
    theme: "purple",
    url: "/openapi.json",
  }),
)

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [
      codeAgentFunction,
      previewProjectFunction,
      deployProjectFunction,
      generateKeystoreFunction,
      exportApkFunction,
    ],
  }),
)

// Public routes
app.use("/api/auth", authRouter)

// Protected routes — requireAuth runs before any handler in these routers
app.use("/api/secrets", requireAuth, userSecretsRouter)
app.use("/api/projects", requireAuth, projectsRouter)
app.use("/api/realtime", requireAuth, realtimeRouter)

console.log("[app] Registered routes:")
console.log("  - /api/inngest")
console.log("  - /api/auth")
console.log("  - /api/projects")
console.log("  - /api/projects/:projectId/messages")
console.log("  - /api/realtime")
console.log("  - /api/docs (API docs)")
console.log("  - /openapi.json")

export default app