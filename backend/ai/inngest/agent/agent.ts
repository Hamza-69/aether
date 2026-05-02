import { createAgent } from "@inngest/agent-kit"
import { model } from "../../../config"
import { PROMPT } from "../prompts"
import { lastAssistantTextMessageContent } from "../../../lib/utils"
import { conversationHistoryAdapter } from "./history"
import {
  grepTool,
  globTool,
  editFileTool,
  createFileTool,
  deleteFileTool,
  webSearchTool,
  webFetchTool,
  ragQueryTool,
  readFilesTool,
  terminalTool,
} from "./tools"

export interface AgentState {
  summary: string
  error: string
  SandboxId: string
  publishCallback: Function
  messageId: string
  streamId: string
  projectId: string
}

export const tools = [
  grepTool,
  globTool,
  editFileTool,
  createFileTool,
  deleteFileTool,
  webSearchTool,
  webFetchTool,
  ragQueryTool,
  readFilesTool,
  terminalTool,
]

export const codeAgent = createAgent<AgentState>({
  name: "code-agent",
  description: "An expert coding agent",
  system: PROMPT,
  model: model,
  tools: tools, 
  history: conversationHistoryAdapter,
  lifecycle: {
    onResponse: async ({result, network}) => {
      const lastAssistantMessageText = 
        lastAssistantTextMessageContent(result)
      if (lastAssistantMessageText && network) {
        if (lastAssistantMessageText.includes("<task_summary>")) {
          network.state.data.summary = lastAssistantMessageText
        } else if (lastAssistantMessageText.includes("<error>")) {
          network.state.data.error = lastAssistantMessageText
        }
      }
      return result
    }
  }
})
