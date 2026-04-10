import { createTool } from "@inngest/agent-kit"
import { z } from "zod"
import { getSandbox } from "../../../lib/utils"
import { applyDiff } from "./diff_parser"
import { matchExpoDocs, matchNativeWindDocs } from "../../rag/db/functions"
import { createEmbedding } from "../../rag/utils"

export const grepTool = createTool({
  name: "grep",
  description:
    "Search for a pattern recursively in a directory. Returns matching lines with file paths and line numbers.",
  parameters: z.object({
    directory: z
      .string()
      .describe("Absolute path in the sandbox to search (e.g. /home/user/backend/src)"),
    pattern: z.string().describe("String or regex pattern to search for"),
  }),
  handler: async ({ directory, pattern }, { step, network }) => {
    return await step?.run(`grep:${directory}:${pattern}`, async () => {
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)
        // -r recursive, -n line numbers, -I skip binaries
        const result = await sandbox.commands.run(
          `grep -rnI "${pattern}" ${directory}`,
        )
        // exit code 1 means no matches — not an error
        if (result.exitCode !== 0 && result.exitCode !== 1)
          throw new Error(result.stderr)
        return result.stdout || "(no matches)"
      } catch (e) {
        return `Error: ${e}`
      }
    })
  },
})



export const globTool = createTool({
  name: "glob",
  description: "Find files matching a filename pattern inside a directory.",
  parameters: z.object({
    directory: z
      .string()
      .describe("Root directory to search (e.g. /home/user/backend or /home/user/frontend)"),
    pattern: z
      .string()
      .describe("Filename glob pattern (e.g. '*.ts', '*.tsx')"),
  }),
  handler: async ({ directory, pattern }, { step, network }) => {
    return await step?.run(`glob:${directory}:${pattern}`, async () => {
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)
        const result = await sandbox.commands.run(
          `find ${directory} -name "${pattern}" -type f`,
        )
        if (result.exitCode !== 0) throw new Error(result.stderr)
        return result.stdout.split("\n").filter(Boolean)
      } catch (e) {
        return `Error: ${e}`
      }
    })
  },
})

export const applyPatchTool = createTool({
  name: "applyPatch",
  description: [
    "Create, delete, or patch a file in the sandbox.",
    "  • create – write a new file (supply full content in contentOrDiff).",
    "  • delete – remove a file.",
    "  • patch  – apply a V4A diff to an existing file (supply the diff in contentOrDiff).",
    "After a successful write the affected project is type-checked automatically.",
    "If type-checking fails the tool returns success:false with the compiler output.",
  ].join("\n"),
  parameters: z.object({
    filePath: z
      .string()
      .describe(
        "Absolute path in the sandbox, must begin with /home/user/backend or /home/user/frontend",
      ),
    mode: z
      .enum(["create", "delete", "patch"])
      .describe("Operation to perform"),
    contentOrDiff: z
      .string()
      .nullable()
      .describe(
        "Full file content for 'create', or V4A diff string for 'patch'. Pass null for 'delete'.",
      ),
  }),
  handler: async ({ filePath, mode, contentOrDiff }, { step, network }) => {
    return await step?.run(`applyPatch-${mode}:${filePath}`, async () => {
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)

        if (mode === "create") {
          if (!contentOrDiff) throw new Error("contentOrDiff required for create")
          await sandbox.files.write(filePath, contentOrDiff)
        } else if (mode === "delete") {
          await sandbox.commands.run(`rm -f ${filePath}`)
        } else {
          // patch — read current content, apply V4A diff, write back
          if (!contentOrDiff) throw new Error("contentOrDiff required for patch")
          const current = await sandbox.files.read(filePath)
          const patched = applyDiff(current, contentOrDiff, "default")
          await sandbox.files.write(filePath, patched)
        }

        // Skip verification for deletes — nothing left to type-check
        if (mode === "delete") return { success: true, filePath, mode }

        // Determine which project owns the file
        const isBackend = filePath.startsWith("/home/user/backend")
        const isFrontend = filePath.startsWith("/home/user/frontend")

        if (isBackend || isFrontend) {
          // backend: tsup build catches TS errors (matches `npm run build` in setup-backend.sh)
          // frontend: tsc --noEmit is lighter than a full Expo export
          const verifyCmd = isBackend
            ? "cd /home/user/backend && npm run build 2>&1"
            : "cd /home/user/frontend && npx tsc --noEmit 2>&1 && npx expo prebuild --platform android --clean && rm -rf android"

          const verify = await sandbox.commands.run(verifyCmd)
          if (verify.exitCode !== 0) {
            return {
              success: false,
              filePath,
              mode,
              verifyError: verify.stdout + verify.stderr,
            }
          }
        }

        return { success: true, filePath, mode }
      } catch (e) {
        return `Error: ${e}`
      }
    })
  },
})

export const webSearchTool = createTool({
  name: "webSearch",
  description:
    "Search the web via DuckDuckGo and return the top 5 result URLs and snippets.",
  parameters: z.object({
    query: z.string().describe("Search query"),
  }),
  handler: async ({ query }, { step }) => {
    return await step?.run("webSearch", async () => {
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
      )
      const html = await response.text()
      const results: Array<{ url: string; snippet: string }> = []
      const snippetRegex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g
      const urlRegex = /<a class="result__url" href="([^"]+)">/g
      let snippetMatch: RegExpExecArray | null
      let urlMatch: RegExpExecArray | null
      while (
        (snippetMatch = snippetRegex.exec(html)) !== null &&
        (urlMatch = urlRegex.exec(html)) !== null
      ) {
        results.push({
          url: urlMatch[1],
          snippet: snippetMatch[1]
            .replace(/<[^>]+>/g, "")
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .trim(),
        })
        if (results.length >= 5) break
      }
      return results
    })
  },
})

export const webFetchTool = createTool({
  name: "webFetch",
  description:
    "Fetch a URL and return its readable text content (scripts/styles stripped, truncated to 10 000 chars).",
  parameters: z.object({
    url: z.string().describe("URL to fetch"),
  }),
  handler: async ({ url }, { step }) => {
    return await step?.run("webFetch", async () => {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })
      if (!response.ok)
        throw new Error(`Fetch failed with status: ${response.status}`)
      const text = await response.text()
      const clean = text
        .replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          " ",
        )
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      return clean.substring(0, 10_000)
    })
  },
})

export const ragQueryTool = createTool({
  name: "ragQuery",
  description:
    "Semantic search over the embedded Expo and/or NativeWind documentation. Prefer this over webSearch for React Native / Expo / NativeWind questions.",
  parameters: z.object({
    query: z
      .string()
      .describe("Natural-language question or description of what you need"),
    source: z
      .enum(["expo", "nativewind", "both"])
      .default("both")
      .describe("Which knowledge base to query"),
    matchCount: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of results to return"),
  }),
  handler: async ({ query, source, matchCount }, { step }) => {
    return await step?.run("ragQuery", async () => {
      const embedding = await createEmbedding(query)
      const threshold = 0.5
      const results: Array<{
        source: string
        content: string
        similarity: number
      }> = []

      if (source === "expo" || source === "both") {
        const docs = await matchExpoDocs(embedding, threshold, matchCount)
        for (const doc of docs) {
          results.push({
            source: "expo",
            content: doc.content ?? "",
            similarity: doc.similarity,
          })
        }
      }

      if (source === "nativewind" || source === "both") {
        const docs = await matchNativeWindDocs(embedding, threshold, matchCount)
        for (const doc of docs) {
          results.push({
            source: "nativewind",
            content: doc.content ?? "",
            similarity: doc.similarity,
          })
        }
      }

      results.sort((a, b) => b.similarity - a.similarity)
      return results.slice(0, matchCount)
    })
  },
})

export const terminalTool = createTool({
  name: "terminal",
  description: "Run a shell command in the sandbox. Returns stdout, stderr, and the exit code.",
  parameters: z.object({
    command: z.string(),
  }),
  handler: async ({ command }, { step, network }) => {
    return await step?.run(`terminal:${command}`, async () => {
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)
        const result = await sandbox.commands.run(command)
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        }
      } catch (e) {
        return { stdout: "", stderr: `Command failed: ${e}`, exitCode: 1 }
      }
    })
  },
})
  
export const readFilesTool = createTool({
  name: "readFiles",
  description: "Read files from sandbox.",
  parameters: z.object({
    files: z.array(z.string()),
  }),
  handler: async ({files}, {step, network}) => {
    return await step?.run(`readFiles:${files.join(",")}`, async () =>{
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