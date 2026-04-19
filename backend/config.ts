import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { openai } from "@inngest/agent-kit"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, './.env') })

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY
export const MODEL_NAME = process.env.MODEL_NAME || "gpt-5.4"
export const REASONING_EFFORT = process.env.REASONING_EFFORT || "medium"
export const INNGEST_SIGNING_KEY = process.env.INNGEST_SIGNING_KEY
export const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY
export const INNGEST_BASE_URL = process.env.INNGEST_BASE_URL || "http://127.0.0.1:8288"
export const NODE_ENV = process.env.NODE_ENV || 'DEV'
export const AI_IDE_PORT = process.env.AI_IDE_PORT ? parseInt(process.env.AI_IDE_PORT) : 3000

export const model = openai({
  apiKey: OPENAI_API_KEY as string,
  model: MODEL_NAME, 
  reasoning: {
    "effort": REASONING_EFFORT,
  } 
})