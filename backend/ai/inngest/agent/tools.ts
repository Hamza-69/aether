import { createTool } from "@inngest/agent-kit"
import { z } from "../../../lib/zod"
import { getSandbox } from "../../../lib/utils"
import { matchExpoDocs, matchNativeWindDocs } from "../../rag/db/functions"
import { createEmbedding } from "../../rag/utils"
const esc = (str: string) => `'${str.replace(/'/g, "'\\''")}'`;

// Fly.io deployment artifacts are owned by the deploy pipeline (deploy.sh / flyctl).
// The agent must NEVER create, edit, delete, or shell-touch these — doing so corrupts
// deploys. Enforced in editFile, createFile, deleteFile, and terminal.
const FLY_PROTECTED_BASENAMES = new Set([
  "fly.toml",
  "Dockerfile",
  ".dockerignore",
  "litestream.yml",
  "fly.json",
]);
const FLY_PROTECTED_DIR_SEGMENTS = [".fly"];

const isFlyProtectedPath = (path: string): boolean => {
  const normalized = path.replace(/\\/g, "/").trim();
  const base = normalized.split("/").filter(Boolean).pop() ?? "";
  if (FLY_PROTECTED_BASENAMES.has(base)) return true;
  for (const seg of FLY_PROTECTED_DIR_SEGMENTS) {
    if (normalized.split("/").includes(seg)) return true;
  }
  return false;
};

const FLY_PROTECTED_COMMAND_TOKENS = [
  "fly.toml",
  "Dockerfile",
  ".dockerignore",
  "litestream.yml",
  ".fly/",
  "flyctl",
  " fly ",
];

const detectFlyProtectedInCommand = (command: string): string | null => {
  const padded = ` ${command} `;
  for (const token of FLY_PROTECTED_COMMAND_TOKENS) {
    if (padded.includes(token)) return token;
  }
  if (/^\s*fly(\s|$)/.test(command)) return "fly";
  return null;
};

const FLY_BLOCKED_MESSAGE =
  "Blocked: Fly.io deployment artifacts (fly.toml, Dockerfile, .dockerignore, litestream.yml, .fly/, flyctl) are managed by the deploy pipeline and must not be modified by the agent. If the user asks to change Fly configuration, refuse and explain that Fly config is out of scope.";
const MAX_BYTES = 200 * 1024; // 200 KB
const cap = (output: string): string => {
  if (Buffer.byteLength(output, 'utf8') <= MAX_BYTES) return output;
  const truncated = Buffer.from(output).subarray(0, MAX_BYTES).toString('utf8');
  return truncated + '\n\n... [Output truncated at 200 KB]';
};

// e2b throws CommandExitError on non-zero exit; stdout/stderr/exitCode live on the error itself.
const asCommandResult = (e: unknown): { stdout: string; stderr: string; exitCode: number } => {
  const err = e as { stdout?: string; stderr?: string; exitCode?: number; message?: string };
  return {
    stdout: err?.stdout ?? "",
    stderr: err?.stderr ?? err?.message ?? String(e),
    exitCode: typeof err?.exitCode === "number" ? err.exitCode : 1,
  };
};

// Noisy dirs/files excluded from every grep. Listed plainly (not brace-expanded) so
// we work under any POSIX shell — some sandbox shells don't brace-expand.
const GREP_EXCLUDE_DIRS = [
  'node_modules', '.git', '.expo', 'dist', 'build', '.next', '.nuxt',
  'out', 'coverage', '.cache', '__pycache__', '.pytest_cache', 'venv',
  '.venv', 'vendor', '.turbo', '.parcel-cache', 'storybook-static',
  '.sass-cache', 'target', '.gradle', 'Pods', '.dart_tool', 'generated',
  '.svelte-kit', '.output', '.vercel', '.netlify', 'tmp', '.tmp',
];
const GREP_EXCLUDE_FILES = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '*.map', '*.min.js',
];

export const grepTool = createTool({
  name: "grep",
  description: [
    "Search for a pattern in a directory. Built to avoid context-window blowouts.",
    "Pattern is an EXTENDED regex by default (|, (), +, ?, {} work unescaped).",
    "Set fixedStrings=true to match the pattern literally.",
    "Smart-case: an all-lowercase pattern matches case-insensitively; any uppercase",
    "flips it back to case-sensitive. Override with caseSensitive.",
    "Modes:",
    " - 'content' (default): returns matching lines with line numbers.",
    " - 'files_with_matches': returns only file paths.",
    " - 'count': returns number of matches per file.",
  ].join("\n"),
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
    directory: z.string().describe("Absolute path to search"),
    pattern: z.string().describe("Extended-regex pattern, or a literal string if fixedStrings=true"),
    include: z.string().nullable().describe("Glob pattern to filter files (e.g., '*.ts', '*.tsx'). Pass null to search all files."),
    limit: z.number().int().default(100).describe("Max lines to return. Keep this low to avoid context explosion."),
    fixedStrings: z.boolean().default(false).describe("Treat pattern as a literal string instead of a regex. Use this when searching for code that contains [, ], (, ), |, etc."),
    caseSensitive: z.boolean().nullable().describe("Force case sensitivity on/off. Pass null for smart-case (sensitive only if pattern contains uppercase)."),
  }),
  handler: async ({ directory, pattern, include, limit, fixedStrings, caseSensitive }, { step, network }) => {
    return await step?.run("grep", async () => {
      try {
        const sandbox = await getSandbox(network.state.data.SandboxId)

        // -r recursive, -I skip binaries, -E extended regex (sane |, (), +, ?, {})
        // Swap -E for -F when the caller wants a literal match.
        let cmd = fixedStrings ? `grep -rIF` : `grep -rIE`;

        // Smart-case: lowercase pattern → case-insensitive; otherwise case-sensitive.
        // caseSensitive=true/false forces the choice.
        const effectiveCaseSensitive = caseSensitive === null || caseSensitive === undefined
          ? /[A-Z]/.test(pattern)
          : caseSensitive;
        if (!effectiveCaseSensitive) cmd += ` -i`;

        // Excludes — one flag per entry so it works under sh/dash (no brace expansion).
        for (const dir of GREP_EXCLUDE_DIRS) cmd += ` --exclude-dir=${esc(dir)}`;
        for (const file of GREP_EXCLUDE_FILES) cmd += ` --exclude=${esc(file)}`;
        
        cmd += ` -n`; // content mode

        // Optional glob filtering
        if (include) cmd += ` --include=${esc(include)}`;

        // Hard cap the output. 2>/dev/null suppresses SIGPIPE if head closes early.
        const fullCmd = `${cmd} -e ${esc(pattern)} ${esc(directory)} 2>/dev/null | head -n ${limit}`;

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
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
    directory: z
      .string()
      .describe("Root directory to search (e.g. /home/user/backend or /home/user/frontend)"),
    pattern: z
      .string()
      .describe("Filename glob pattern (e.g. '*.ts', '**/*.ts')"),
  }),
  handler: async ({ directory, pattern }, { step, network }) => {
    return await step?.run("glob", async () => {
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

// Shared verification for create/edit writes. Runs the project-appropriate
// type-check after a write; returns ok:false with compiler output on failure.
type VerifyResult =
  | { ok: true }
  | { ok: false; verifyStdout: string; verifyStderr: string; verifyExitCode: number }

async function verifyAfterWrite(
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  filePath: string,
): Promise<VerifyResult> {
  const isBackend = filePath.startsWith("/home/user/backend")
  const isFrontend = filePath.startsWith("/home/user/frontend")
  if (!isBackend && !isFrontend) return { ok: true }

  const verifyCmd = isBackend
    ? "cd /home/user/backend && npm run build 2>&1"
    : "cd /home/user/frontend && npx tsc --noEmit 2>&1 && npx expo prebuild --platform android --clean && rm -rf android"

  try {
    await sandbox.commands.run(verifyCmd)
    return { ok: true }
  } catch (e) {
    const v = asCommandResult(e)
    return {
      ok: false,
      verifyStdout: cap(v.stdout),
      verifyStderr: cap(v.stderr),
      verifyExitCode: v.exitCode,
    }
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let idx = 0
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count += 1
    idx += needle.length
  }
  return count
}

function buildFrontendEndpointGuardrailNote(filePath: string, content: string): string | undefined {
  if (!filePath.startsWith("/home/user/frontend")) return undefined

  const hardcodedTargets = new Set<string>()

  for (const match of content.matchAll(/https?:\/\/(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?(?:\/[^\s"'`)]*)?/gi)) {
    hardcodedTargets.add(match[0])
  }
  for (const match of content.matchAll(/\blocalhost(?::\d+)?(?:\/[^\s"'`)]*)?/gi)) {
    hardcodedTargets.add(match[0])
  }
  for (const match of content.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s"'`)]*)?/g)) {
    hardcodedTargets.add(match[0])
  }

  const envRouteMatches = new Set<string>()
  for (const match of content.matchAll(/EXPO_PUBLIC_API_URL\s*=\s*https?:\/\/[^\s/]+\/[^\s]+/g)) {
    envRouteMatches.add(match[0])
  }
  for (const match of content.matchAll(/EXPO_PUBLIC_API_URL[^\n]*https?:\/\/[^\s"'`/]+\/[^\s"'`]+/g)) {
    envRouteMatches.add(match[0])
  }

  if (hardcodedTargets.size === 0 && envRouteMatches.size === 0) return undefined

  const details: string[] = []
  if (hardcodedTargets.size > 0) {
    const samples = Array.from(hardcodedTargets).slice(0, 3).join(", ")
    details.push(`hardcoded localhost/IP endpoint(s): ${samples}`)
  }
  if (envRouteMatches.size > 0) {
    const samples = Array.from(envRouteMatches).slice(0, 2).join(" | ")
    details.push(`EXPO_PUBLIC_API_URL includes route path: ${samples}`)
  }

  return `Frontend endpoint guardrail note: detected ${details.join("; ")}. Keep frontend API config on EXPO_PUBLIC_API_URL in .env (example: EXPO_PUBLIC_API_URL=https://api.example.com) and keep the env value origin-only (no routes).`
}

async function buildBackendEnvExampleGuardrailNote(
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  filePath: string,
): Promise<string | undefined> {
  if (!filePath.startsWith("/home/user/backend")) return undefined
  if (filePath === "/home/user/backend/.env.example") return undefined
  try {
    const result = await sandbox.commands.run(`test -f /home/user/backend/.env.example`)
    if (result.exitCode === 0) return undefined
  } catch {
    // test -f returns non-zero on missing; treat as missing and fall through
  }
  return [
    "Backend .env.example guardrail: /home/user/backend/.env.example is MISSING.",
    "This is non-negotiable — every backend change must be accompanied by a committed .env.example",
    "listing every environment variable the backend reads (keys only, placeholder/empty values).",
    "Create /home/user/backend/.env.example now (before more backend edits) so preview runs can",
    "resolve the project's secret vault by key name.",
  ].join(" ")
}

export const editFileTool = createTool({
  name: "editFile",
  description: [
    "Edit an existing file by exact string replacement.",
    "oldString must appear VERBATIM in the file (whitespace-sensitive, including",
    "leading indentation and trailing newlines you intend to match).",
    "With replaceAll=false (default) oldString must be UNIQUE in the file — include",
    "enough surrounding lines to disambiguate. With replaceAll=true every occurrence",
    "is replaced (at least one must match).",
    "After the write, the affected project is type-checked; returns success:false",
    "with compiler output on failure.",
  ].join("\n"),
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
    filePath: z
      .string()
      .describe("Absolute path in the sandbox (/home/user/backend/... or /home/user/frontend/...)."),
    oldString: z
      .string()
      .describe("Exact text to find. Must be unique in the file unless replaceAll=true."),
    newString: z
      .string()
      .describe("Replacement text. May be empty to delete oldString."),
    replaceAll: z
      .boolean()
      .default(false)
      .describe("Replace every occurrence instead of requiring a unique match."),
  }),
  handler: async ({ filePath, oldString, newString, replaceAll }, { step, network }) => {
    return await step?.run("editFile", async () => {
      try {
        if (isFlyProtectedPath(filePath)) {
          return `Error: ${FLY_BLOCKED_MESSAGE}`
        }
        const sandbox = await getSandbox(network.state.data.SandboxId)
        const current = await sandbox.files.read(filePath)

        if (oldString === newString) {
          return `Error: oldString and newString are identical for ${filePath}.`
        }
        if (!current.includes(oldString)) {
          return `Error: oldString not found in ${filePath}. Re-read the file and include more surrounding context, or check whitespace.`
        }

        let updated: string
        if (replaceAll) {
          updated = current.split(oldString).join(newString)
        } else {
          const occurrences = countOccurrences(current, oldString)
          if (occurrences > 1) {
            return `Error: oldString matches ${occurrences} places in ${filePath}. Extend oldString with surrounding lines to make it unique, or pass replaceAll=true.`
          }
          const idx = current.indexOf(oldString)
          updated = current.slice(0, idx) + newString + current.slice(idx + oldString.length)
        }

        const guardrailNote = buildFrontendEndpointGuardrailNote(filePath, updated)
        await sandbox.files.write(filePath, updated)

        const backendEnvNote = await buildBackendEnvExampleGuardrailNote(sandbox, filePath)
        const notes = [guardrailNote, backendEnvNote].filter(Boolean) as string[]
        const noteField = notes.length > 0 ? { note: notes.join("\n\n") } : {}

        const verify = await verifyAfterWrite(sandbox, filePath)
        if (!verify.ok) {
          return {
            success: false,
            filePath,
            mode: "edit" as const,
            verifyStdout: verify.verifyStdout,
            verifyStderr: verify.verifyStderr,
            verifyExitCode: verify.verifyExitCode,
            ...noteField,
          }
        }
        return {
          success: true,
          filePath,
          mode: "edit" as const,
          ...noteField,
        }
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    })
  },
})

export const createFileTool = createTool({
  name: "createFile",
  description: [
    "Create a new file (or overwrite an existing one) with the given full content.",
    "After the write, the affected project is type-checked; returns success:false",
    "with compiler output on failure.",
  ].join("\n"),
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
    filePath: z
      .string()
      .describe("Absolute path in the sandbox (/home/user/backend/... or /home/user/frontend/...)."),
    content: z
      .string()
      .describe("Full file contents, exactly as they should appear on disk."),
  }),
  handler: async ({ filePath, content }, { step, network }) => {
    return await step?.run("createFile", async () => {
      try {
        if (isFlyProtectedPath(filePath)) {
          return `Error: ${FLY_BLOCKED_MESSAGE}`
        }
        const sandbox = await getSandbox(network.state.data.SandboxId)
        const guardrailNote = buildFrontendEndpointGuardrailNote(filePath, content)
        await sandbox.files.write(filePath, content)

        const backendEnvNote = await buildBackendEnvExampleGuardrailNote(sandbox, filePath)
        const notes = [guardrailNote, backendEnvNote].filter(Boolean) as string[]
        const noteField = notes.length > 0 ? { note: notes.join("\n\n") } : {}

        const verify = await verifyAfterWrite(sandbox, filePath)
        if (!verify.ok) {
          return {
            success: false,
            filePath,
            mode: "create" as const,
            verifyStdout: verify.verifyStdout,
            verifyStderr: verify.verifyStderr,
            verifyExitCode: verify.verifyExitCode,
            ...noteField,
          }
        }
        return {
          success: true,
          filePath,
          mode: "create" as const,
          ...noteField,
        }
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    })
  },
})

export const deleteFileTool = createTool({
  name: "deleteFile",
  description: "Delete a file from the sandbox. No type-check runs after deletion.",
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
    filePath: z
      .string()
      .describe("Absolute path in the sandbox."),
  }),
  handler: async ({ filePath }, { step, network }) => {
    return await step?.run("deleteFile", async () => {
      try {
        if (isFlyProtectedPath(filePath)) {
          return `Error: ${FLY_BLOCKED_MESSAGE}`
        }
        const sandbox = await getSandbox(network.state.data.SandboxId)
        await sandbox.commands.run(`rm -f ${esc(filePath)}`)
        return { success: true, filePath, mode: "delete" as const }
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    })
  },
})

export const webSearchTool = createTool({
  name: "webSearch",
  description:
    "Search the web via DuckDuckGo and return the top 5 result URLs and snippets.",
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
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
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
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
      return cap(clean.substring(0, 10_000))
    })
  },
})

export const ragQueryTool = createTool({
  name: "ragQuery",
  description:
    "Semantic search over the embedded Expo and/or NativeWind documentation. Prefer this over webSearch for React Native / Expo / NativeWind questions.",
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
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
      return cap(JSON.stringify(results.slice(0, matchCount)))
    })
  },
})

export const terminalTool = createTool({
  name: "terminal",
  description: "Run a shell command in the sandbox. Returns stdout, stderr, and the exit code.",
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
    command: z.string(),
  }),
  handler: async ({ command }, { step, network }) => {
    return await step?.run("terminal", async () => {
      try {
        const blockedToken = detectFlyProtectedInCommand(command)
        if (blockedToken) {
          return {
            stdout: "",
            stderr: `${FLY_BLOCKED_MESSAGE} (matched token: ${blockedToken})`,
            exitCode: 126,
          }
        }
        const sandbox = await getSandbox(network.state.data.SandboxId)
        const result = await sandbox.commands.run(command)
        return {
          stdout: cap(result.stdout),
          stderr: cap(result.stderr),
          exitCode: result.exitCode,
        }
      } catch (e) {
        const r = asCommandResult(e)
        return { stdout: cap(r.stdout), stderr: cap(r.stderr), exitCode: r.exitCode }
      }
    })
  },
})
  
export const readFilesTool = createTool({
  name: "readFiles",
  description: "Read files from sandbox.",
  parameters: z.object({
    explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool. The input to this tool should be in a casual chat like way."),
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
        return cap(JSON.stringify(contents))
      } catch (e) {
        return "Error: "+e
      }
    })
  }
})
