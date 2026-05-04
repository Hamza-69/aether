#!/usr/bin/env node
// Interactive CLI subscriber for the aether backend's Inngest realtime stream.
//
// Prompts for backend URL, dev-server URL, projectId, and stream type, then:
//   1. POST {projectId, type} to <BACKEND>/api/realtime  -> { token, channel, topic }
//   2. Open ws://<INNGEST_DEV>/v1/realtime/connect?token=<JWT>
//   3. Print every frame; reconnect when the token expires (~60s).
//
// Defaults can also be supplied via env vars (BACKEND, INNGEST_DEV,
// PROJECT_ID, TYPE) and accepted by pressing Enter at the prompt.

import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const STREAM_TYPES = [
  "code-agent",
  "deploy",
  "export-apk",
  "generate-keystore",
  "preview",
]

async function prompt() {
  const rl = readline.createInterface({ input, output })
  const ask = async (label, def) => {
    const suffix = def ? ` [${def}]` : ""
    const answer = (await rl.question(`${label}${suffix}: `)).trim()
    return answer || def || ""
  }

  const backend    = process.env.BACKEND     ?? "http://localhost:3000"
  const inngestDev = process.env.INNGEST_DEV ?? "ws://localhost:8288"
  const projectId  = await ask("Project ID",             process.env.PROJECT_ID)
  const type       = await ask(`Stream type (${STREAM_TYPES.join("|")})`, process.env.TYPE ?? "code-agent")

  rl.close()

  if (!projectId) {
    console.error("Project ID is required")
    process.exit(1)
  }
  if (!STREAM_TYPES.includes(type)) {
    console.error(`Invalid type: ${type}. Must be one of ${STREAM_TYPES.join(", ")}`)
    process.exit(1)
  }

  return { backend, inngestDev, projectId, type }
}

async function fetchToken({ backend, projectId, type }) {
  const res = await fetch(`${backend}/api/realtime`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ projectId, type }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`token fetch failed: ${res.status} ${text}`)
  }

  const body = await res.json()
  const jwt = body?.token?.key ?? body?.key
  if (!jwt) throw new Error(`no token in response: ${JSON.stringify(body)}`)
  return { jwt, channel: body.channel, topic: body.topic }
}

function connect(inngestDev, jwt) {
  return new Promise((resolve) => {
    const url = `${inngestDev}/v1/realtime/connect?token=${encodeURIComponent(jwt)}`
    const ws  = new WebSocket(url)

    ws.addEventListener("open",    () => console.log(`[ws] open  ${url}`))
    ws.addEventListener("message", (ev) => {
      try {
        const frame = JSON.parse(ev.data)
        console.log(`[${frame.kind}] ${frame.channel} :: ${frame.topic}`)
        console.dir(frame.data, { depth: null })
      } catch {
        console.log("[raw]", ev.data)
      }
    })
    ws.addEventListener("close", (ev) => { console.log(`[ws] close code=${ev.code} reason=${ev.reason || "(none)"}`); resolve() })
    ws.addEventListener("error", (ev) => console.log(`[ws] error`, ev?.message ?? ev))
  })
}

async function main() {
  const cfg = await prompt()
  console.log(`\nSubscribing: ${cfg.backend} -> ${cfg.inngestDev} project=${cfg.projectId} type=${cfg.type}\n`)

  for (;;) {
    try {
      const { jwt, channel, topic } = await fetchToken(cfg)
      console.log(`[token] channel=${channel} topic=${topic}`)
      await connect(cfg.inngestDev, jwt)
    } catch (err) {
      console.error("[loop]", err.message)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
}

main()
