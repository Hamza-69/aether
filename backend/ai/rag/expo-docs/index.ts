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

  for (const doc of documents) {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: doc.pageContent,
    })
    const embedding = embeddingResponse.data[0].embedding
    const embeddingStr = `[${embedding.join(",")}]`

    await prisma.$executeRaw`
      INSERT INTO "ExpoDocs" (id, content, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${doc.pageContent}, ${embeddingStr}::vector, NOW())
    `
  }

  console.log(`Inserted ${documents.length} chunks into ExpoDocs`)
  await prisma.$disconnect()
}

generateAndPublish().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
