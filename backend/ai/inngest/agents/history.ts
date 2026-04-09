import {
  AgentResult,
  HistoryConfig,
} from "@inngest/agent-kit"
import {prisma} from "../../../lib/prisma"

// Define your history adapter with all four methods
export const conversationHistoryAdapter: HistoryConfig<any> = {
  // 1. Create new conversation threads (or ensure they exist)
  createThread: ({ state }) => {
    console.log(`[conversationHistoryAdapter/createThread] Creating/ensuring thread exists: ${state.threadId}`)
    // No need to do anything here since threads are managed externally
    return { threadId: state.threadId as string }
  },

  // 2. Load conversation history (including user messages)
  get: async ({ step, network, threadId }) => {
    console.log(`[conversationHistoryAdapter/get] Fetching conversation history for thread: ${threadId}`)

    if (!threadId || !step) {
      console.warn(`[conversationHistoryAdapter/get] Missing threadId or step, returning empty history`)
      return []
    }

    let results: AgentResult[] = []

    await step.run("fetch-history-messages", async () => {
      console.log(`[conversationHistoryAdapter/get] Loading messages from database for project: ${threadId}`)
      const stepId = await network.state.data.stepStartPublisher("fetch-history-messages", network.state.data.agentRunID)

      const messages = await prisma.Message.findMany({
        where: { projectId: threadId },
        orderBy: { createdAt: "asc" },
      })

      if (messages[messages.length - 1].role === "ASSISTANT") {
        messages.pop()
      }
      
      console.log(`[conversationHistoryAdapter/get] Retrieved ${messages.length} messages from database`)

      console.log(`[conversationHistoryAdapter/get] Fetching project details`)
      const project = await prisma.Project.findUnique({ where: { id: threadId } })
      console.log(`[conversationHistoryAdapter/get] Project type: ${project?.projectType}`)
      
      // Transform ALL messages (user + agent) to AgentResult format
      // This preserves the complete conversation order
      console.log(`[conversationHistoryAdapter/get] Transforming messages to AgentResult format`)
      results = messages.map((msg) => {
        
        if (!(msg.role === "ASSISTANT")) {
          console.log(`[conversationHistoryAdapter/get] Transforming user message (ID: ${msg.id})`)
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
          console.log(`[conversationHistoryAdapter/get] Transforming assistant message (ID: ${msg.id}, type: ${msg.type})`)
          // Return agent results
          return new AgentResult(
            project?.projectType === "NORMAL" ? "code-agent" : "provisioning-agent",
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
      console.log(`[conversationHistoryAdapter/get] Transformed ${results.length} messages`)

      await network.state.data.stepEndPublisher("fetch-history-messages", JSON.stringify(results), network.state.data.agentRunID, stepId as unknown as string)
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