import { createAgent, createTool } from "@inngest/agent-kit"
import { z } from "zod"
import { model } from "../../../config"
import { PROMPT } from "../prompts"
import { lastAssistantTextMessageContent, getSandbox } from "../../../lib/utils"
import {conversationHistoryAdapter} from "./history"
export interface AgentState {
  summary: string
  error: string
  SandboxId: string
}

export const tools = [
  createTool({
    name:"terminal",
    description: "Use the terminal to run commands",
    parameters: z.object({
      command: z.string(),
    }),
    handler : async ({command}, {step, network}) => {
      return await step?.run("terminal", async () =>{
        const buffers = {stdout: "", stderr: ""}

        try {
          const sandbox = await getSandbox(network.state.data.SandboxId)
          const result = await sandbox.commands.run(command, {
            onStdout: (data: string) => {
              buffers.stdout += data
            },
            onStderr: (data: string) => {
              buffers.stderr += data
            }
          })
          return result.stdout
        } catch (e) {
          console.error(
            `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`
          )
          return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`
        }
      })
    }
  }),
  createTool({
    name: "createOrUpdateFiles",
    description: "Create or update files in the sandbox",
    parameters: z.object({
      files: z.array(
        z.object({
          path: z.string(),
          content: z.string(),
        }),
      )
    }),
    handler: async ({files}, {step, network}) => {
      const newFiles = await step?.run("createOrUpdateFiles", async () => {
        try {
          const updatedFiles = network.state.data.files || {}
          const sandbox = await getSandbox(network.state.data.SandboxId)
          for (const file of files) {
            await sandbox.files.write(file.path, file.content)
            updatedFiles[file.path] = file.content
          }

          return updatedFiles
        } catch (e) {
          return "Error: "+e
        }
      })

      if (typeof newFiles === "object") {
        network.state.data.files = newFiles
      }
    }
  }),
  createTool({
    name: "readFiles",
    description: "Read files from sandbox.",
    parameters: z.object({
      files: z.array(z.string()),
    }),
    handler: async ({files}, {step, network}) => {
      return await step?.run("readFiles", async () =>{
        try {
          const sandbox = await getSandbox(network.state.data.SandboxId)
          const contents = []
          for (const file of files) {
            const content = await  sandbox.files.read(file)
            contents.push({path: file, content})
          }
          return JSON.stringify(contents)
        } catch (e) {
          return "Error: "+e
        }
      })
    }
  })
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
