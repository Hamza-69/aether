import { openai, createAgent, createTool, createNetwork, Tool, Message, createState } from "@inngest/agent-kit"
import {Sandbox} from '@e2b/code-interpreter'
import { inngest } from "./client"
import { getSandbox, lastAssistantTextMessageContent } from "./utils"
import z from "zod"
import { FRAGMENT_TITLE_PROMPT, PROMPT, } from "@/prompt"
import { prisma } from "@/lib/db"

interface  AgentState {
  summary: string;
  files: {[path:string]:string};
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => { 
    const SandboxId = await step.run("get-sandbox-id", async () =>{
      const sandbox = await Sandbox.create("vibable-nexjs-hamza-3")
      await sandbox.setTimeout(60_000*10*3) // 30 mins
      return sandbox.sandboxId
    })

    const state = createState<AgentState>(
      {
        summary: "",
        files:{}
      }
    )

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({network}) => {
        const summary = network.state.data.summary

        if (summary) {
          return
        }

        return codeAgent
      }
    })

    const result = await network.run(event.data.value, {state})

    const fragmentTitleGenerator = createAgent({
      name:"fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({
        model: "gpt-5"
      })
    })

    const {output: fragmentTitleOutput} = (await fragmentTitleGenerator.run(result.state.data.summary)) as any

    const generateFragmentTitle = () => {
      if (fragmentTitleOutput[0].type !== "text") {
        return "Here you go."
      }

      if (Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt: any)=> txt).join("")
      } else {
        return fragmentTitleOutput[0].content
      }
    }

    const isError = 
      !result.state.data.summary || 
      Object.keys(result.state.data.files || {}).length === 0

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(SandboxId)
      const host = sandbox.getHost(3000)
      return `https://${host}`
    })

    await step.run("save-result", async () =>{

      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong. Please try again.",
            role: "ASSISTANT",
            type: "ERROR"
          }
        })
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: generateResponse(),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create:{
              sandboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
              files: result.state.data.files,
            }
          }
        }
      })
    })

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary
    }
  },
)
