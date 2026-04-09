#!/usr/bin/env npx tsx

import { execFileSync } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const EXPO_DIR = path.join(__dirname, "..", "expo-docs")
const NATIVEWIND_DIR = path.join(__dirname, "..", "nativewind-docs")

function run(script: string, cwd: string): void {
  execFileSync("npx", ["tsx", script], {
    cwd,
    stdio: "inherit",
  })
}

console.log("==========================================")
console.log(" RAG Embeddings Update Pipeline")
console.log("==========================================")
console.log("")

console.log("Step 1: Indexing Expo Docs...")
run("index.ts", EXPO_DIR)
console.log("")

console.log("Step 2: Indexing NativeWind Docs...")
run("index.ts", NATIVEWIND_DIR)
console.log("")

console.log("==========================================")
console.log(" Pipeline completed successfully!")
console.log("==========================================")
