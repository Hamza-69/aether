import { openai } from "./config"

export async function createEmbedding(input: string): Promise<Array<number>> {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input
  })
  const firstEmbedding = embeddingResponse.data[0]
  if (!firstEmbedding) {
    throw new Error("OpenAI returned no embedding data")
  }
  return firstEmbedding.embedding
}
