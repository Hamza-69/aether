import express from "express"
import { serve } from "inngest/express"
import { inngest } from "./ai/inngest/client"
import cors from "cors"
import morgan from "morgan"
import { projectsRouter } from "./controllers/projects"
import { messagesRouter } from "./controllers/messages"
import { codeAgentFunction } from "./ai/inngest/jobs/agent"
import { previewProjectFunction } from "./ai/inngest/jobs/preview"
import { apiReference } from "@scalar/express-api-reference"
import { openApiSpec } from "./openapi-registry"

const app = express()

app.use(cors())
app.use(express.json({ limit: "500mb" }))

morgan.token('body', (req: express.Request) => {
  return JSON.stringify(req.body)
})

app.use(morgan(':method :url :status :res[content-length] :response-time ms :body'))

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

app.use("/api/inngest", serve({ client: inngest, functions: [codeAgentFunction, previewProjectFunction] }))
app.use("/api/projects", projectsRouter)
app.use("/api/messages", messagesRouter)

console.log("[app] Registered routes:")
console.log("  - /api/inngest")
console.log("  - /api/projects")
console.log("  - /api/messages")
console.log("  - /api/docs (API docs)")
console.log("  - /openapi.json")

export default app
