import { createTool } from "@inngest/agent-kit"
import { z } from "../../../lib/zod"
import { getSandbox } from "../../../lib/utils"
import { applyDiff } from "./diff_parser"
import { matchExpoDocs, matchNativeWindDocs } from "../../rag/db/functions"
import { createEmbedding } from "../../rag/utils"
const esc = (str: string) => `'${str.replace(/'/g, "'\\''")}'`;
const MAX_BYTES = 200 * 1024; // 200 KB
const cap = (output: string): string => {
  if (Buffer.byteLength(output, 'utf8') <= MAX_BYTES) return output;
  const truncated = Buffer.from(output).subarray(0, MAX_BYTES).toString('utf8');
  return truncated + '\n\n... [Output truncated at 200 KB]';
};
// Inngest step IDs must be unique within a function run. Same tool called N times
// would otherwise collide, so suffix every step with a fresh id.
const stepId = (tool: string) =>
  `${tool}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const grepTool = createTool({
  name: "grep",
  description: [
    "Search for a pattern in a directory. Built to avoid context-window blowouts.",
    "Modes:",
    " - 'content' (default): returns matching lines with line numbers.",
    " - 'files_with_matches': returns only file paths.",
    " - 'count': returns number of matches per file.",
  ].join("\n"),
  parameters: z.object({
    directory: z.string().describe("Absolute path to search"),
    pattern: z.string().describe("String or regex pattern"),
    mode: z.enum(["content", "files_with_matches", "count"]).default("content"),
    include: z.string().nullable().describe("Glob pattern to filter files (e.g., '*.ts', '*.tsx'). Pass null to search all files."),
    limit: z.number().int().default(100).describe("Max lines to return. Keep this low to avoid context explosion."),
  }),
  handler: async ({ directory, pattern, mode, include, limit }, { step, network }) => {
    return await step?.run(stepId("grep"), async () => {
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)
        
        let cmd = `grep -rI`;
        
        // 1. Exclude noisy dirs and generated/lock files
        cmd += ` --exclude-dir={node_modules,.git,.expo,dist,build,.next,.nuxt,out,coverage,.cache,__pycache__,.pytest_cache,venv,.venv,vendor,.turbo,.parcel-cache,storybook-static,.sass-cache,target,.gradle,Pods,.dart_tool,generated,.svelte-kit,.output,.vercel,.netlify,tmp,.tmp}`;
        cmd += ` --exclude=*{package-lock.json,yarn.lock,pnpm-lock.yaml,*.map,*.min.js}`;

        // 2. Mirror Claude's output modes
        if (mode === "files_with_matches") cmd += ` -l`;
        else if (mode === "count") cmd += ` -c`;
        else cmd += ` -n`; // content mode

        // 3. Optional glob filtering
        if (include) cmd += ` --include=${esc(include)}`;

        // 4. Hard cap the output. 2>/dev/null suppresses SIGPIPE errors if head closes early.
        const fullCmd = `${cmd} ${esc(pattern)} ${esc(directory)} 2>/dev/null | head -n ${limit}`;

        const result = await sandbox.commands.run(fullCmd)
        
        const out = result.stdout.trim()
        if (!out) return "(no matches)"

        const lines = out.split('\n')
        const lined = lines.length >= limit
          ? out + `\n\n... [Results truncated to ${limit} lines. Use a stricter pattern, an 'include' glob, or 'files_with_matches' mode.]`
          : out;
        return cap(lined);
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    })
  },
})

export const globTool = createTool({
  name: "glob",
  // Updated description to explicitly guide the LLM away from breaking patterns
  description: "Find files matching a filename pattern. Do NOT use brace expansion like '*.{ts,tsx}'. Keep it simple: '*.ts' or '**/*.ts'",
  parameters: z.object({
    directory: z
      .string()
      .describe("Root directory to search (e.g. /home/user/backend or /home/user/frontend)"),
    pattern: z
      .string()
      .describe("Filename glob pattern (e.g. '*.ts', '**/*.ts')"),
  }),
  handler: async ({ directory, pattern }, { step, network }) => {
    return await step?.run(stepId("glob"), async () => {
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)
        
        // If the LLM passes directories in the pattern (e.g. `**/*.ts`), -name fails.
        // We switch to -path and ensure it matches anywhere inside the directory.
        const isPathMatch = pattern.includes("/");
        const flag = isPathMatch ? "-path" : "-name";
        const searchPattern = isPathMatch ? `*/${pattern}`.replace('/*/**', '/**') : pattern;

        const PRUNE_LIST = [
          '.git', 'node_modules', '.expo', 'dist', 'build', '.next', '.nuxt',
          'out', 'coverage', '.cache', '__pycache__', '.pytest_cache', 'venv',
          '.venv', 'vendor', '.turbo', '.parcel-cache', 'storybook-static',
          '.sass-cache', 'target', '.gradle', 'Pods', '.dart_tool', 'generated',
          '.svelte-kit', '.output', '.vercel', '.netlify', 'tmp', '.tmp',
        ];
        const PRUNE_NAMES = PRUNE_LIST.map(d => `-name ${esc(d)}`).join(' -o ');

        // Shell-level prune (fast: find never descends into these dirs)
        const result = await sandbox.commands.run(
          `find ${esc(directory)} -type d \\( ${PRUNE_NAMES} \\) -prune -o -type f ${flag} ${esc(searchPattern)} -print 2>/dev/null`
        )

        if (result.exitCode !== 0 && !result.stdout) throw new Error(result.stderr)

        // Node-level post-filter (bulletproof: drops any path with a pruned segment, in case shell quoting fails)
        const pruneRegex = new RegExp(
          `(^|/)(${PRUNE_LIST.map(d => d.replace(/\./g, '\\.')).join('|')})(/|$)`
        );
        const files = result.stdout
          .split("\n")
          .filter(Boolean)
          .filter(path => !pruneRegex.test(path));

        const filesOut = files.length > 0 ? files.join("\n") : "(no matches)"
        return cap(filesOut)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : e}`
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
    return await step?.run(stepId("applyPatch"), async () => {
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
          
          let verify
          try {
            verify = await sandbox.commands.run(verifyCmd)
          } catch (e) {
            return {
              success: false,
              filePath,
              mode,
              //@ts-ignore
              verifyError: cap(verify.stdout + verify.stderr),
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
    return await step?.run(stepId("webSearch"), async () => {
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
          url: urlMatch[1] as string,
          //@ts-ignore
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
    return await step?.run(stepId("webFetch"), async () => {
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
      return cap(clean.substring(0, 10_000))
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
    return await step?.run(stepId("ragQuery"), async () => {
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
      return cap(JSON.stringify(results.slice(0, matchCount)))
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
    return await step?.run(stepId("terminal"), async () => {
      let result
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)
        result = await sandbox.commands.run(command)
        return {
          stdout: cap(result.stdout),
          stderr: cap(result.stderr),
          exitCode: result.exitCode,
        }
      } catch (e) {
        // @ts-ignore
        return { stdout: cap(result.stdout), stderr: cap(result.stderr), exitCode: result.exitCode }
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
    return await step?.run(stepId("readFiles"), async () =>{
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)
        const contents = []
        for (const file of files) {
          const content = await  sandbox.files.read(file)
          contents.push({path: file, content})
        }
        return cap(JSON.stringify(contents))
      } catch (e) {
        return "Error: "+e
      }
    })
  }
})