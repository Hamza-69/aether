import { openai } from '../config'
import { prisma } from "../../../lib/prisma"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { fileURLToPath } from "url"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const docsPath = path.join(__dirname, "./data/llms-full.txt")

async function generateAndPublish(): Promise<void> {
  const text = fs.readFileSync(docsPath, "utf8")
  if (!text.trim()) {
    console.log("llms-full.txt is empty, nothing to index.")
    return
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 150,
  })
  const documents = await splitter.createDocuments([text])
  console.log(`Split into ${documents.length} chunks`)

  await prisma.expoDocs.deleteMany({})

  const BATCH_SIZE = 1000
  const allEmbeddings: { index: number; embedding: number[] }[] = []

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(documents.length / BATCH_SIZE)
    console.log(`Embedding batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`)

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch.map((doc) => doc.pageContent),
    })

    allEmbeddings.push(...response.data.map((e) => ({ index: i + e.index, embedding: e.embedding })))
  }

  for (const { index, embedding } of allEmbeddings) {
    const embeddingStr = `[${embedding.join(",")}]`
    await prisma.$executeRaw`
      INSERT INTO "ExpoDocs" (id, content, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${documents[index].pageContent}, ${embeddingStr}::vector, NOW())
    `
  }

  console.log(`Inserted ${documents.length} chunks into ExpoDocs`)
  await prisma.$disconnect()
}

generateAndPublish().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
