import {
  AgentResult,
  HistoryConfig,
} from "@inngest/agent-kit"
import {prisma} from "../../../lib/prisma"
import { AgentState } from "./agent"

// Define your history adapter with all four methods
export const conversationHistoryAdapter: HistoryConfig<AgentState> = {
  // 1. Create new conversation threads (or ensure they exist)
  createThread: ({ state }) => {
    console.log(`[conversationHistoryAdapter/createThread] Creating/ensuring thread exists: ${state.threadId}`)
    // No need to do anything here since threads are managed externally
    return { threadId: state.threadId as string }
  },

  // 2. Load conversation history (including user messages)
  get: async ({ step, threadId }) => {
    console.log(`[conversationHistoryAdapter/get] Fetching conversation history for thread: ${threadId}`)

    if (!threadId || !step) {
      console.warn(`[conversationHistoryAdapter/get] Missing threadId or step, returning empty history`)
      return []
    }

    let results: AgentResult[] = []

    await step.run("fetch-history-messages", async () => {
      console.log(`[conversationHistoryAdapter/get] Loading messages from database for project: ${threadId}`)
      const messages = await prisma.message.findMany({
        where: { projectId: threadId },
        orderBy: { createdAt: "asc" },
      })

      if (messages[messages.length - 1]?.role === "ASSISTANT") {
        messages.pop()
      }
      
      // Transform ALL messages (user + agent) to AgentResult format
      // This preserves the complete conversation order
      results = messages.map((msg) => {
        
        if (!(msg.role === "ASSISTANT")) {
          // Convert user messages to AgentResult with agentName: "user"
          return new AgentResult(
            "user",
            [
              {
                type: "text" as const,
                role: "user" as const,
                content: msg.content,
                stop_reason: "stop",
              },
            ],
            [],
            new Date(msg.createdAt)
          )
        } else {
          // Return agent results
          return new AgentResult(
            "code-agent",
            [
              {
                type: "text" as const,
                role: "assistant" as const,
                content: msg.content,
              },
            ],
            [],
            new Date(msg.createdAt)
          )
        }
      })
      return results
    })
    console.log(`[conversationHistoryAdapter/get] Returning ${results.length} conversation results`)
    return results
  },

  // 3. Save user message immediately (before agents run)
  appendUserMessage: async (_) => {
    console.log(`[conversationHistoryAdapter/appendUserMessage] Called (no-op, messages saved externally)`)
    // User messages are already saved externally, so no action needed here
    return
  },

  // 4. Save agent results after the run
  appendResults: async (_) => {
    console.log(`[conversationHistoryAdapter/appendResults] Called (no-op, results saved in function)`)
    // Agent messages are already saved in function, so no action needed here
    return
  },
}