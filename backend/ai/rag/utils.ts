import { openai } from "./config.ts"

export async function createEmbedding(input: string): Promise<Array<number>> {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input
  })
  return embeddingResponse.data[0].embedding
}