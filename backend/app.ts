import express from "express"
import { serve } from "inngest/express"
import { inngest } from "./ai/inngest/client"
import cors from "cors"
import morgan from "morgan"
import { projectsRouter } from "./controllers/projects"
import { codeAgentFunction } from "./ai/inngest/jobs/agent"

const app = express()

app.use(cors())
app.use(express.json({ limit: "500mb" }))

morgan.token('body', (req: express.Request) => {
  return JSON.stringify(req.body)
})

app.use(morgan(':method :url :status :res[content-length] :response-time ms :body'))

app.use("/api/inngest", serve({ client: inngest, functions: [codeAgentFunction] }))
app.use("/api/projects", projectsRouter)

console.log("[app] Registered routes:")
console.log("  - /api/inngest")
console.log("  - /api/projects")

export default app
