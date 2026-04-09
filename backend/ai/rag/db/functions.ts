import { prisma } from "../../../lib/prisma"

interface MatchedDoc {
  id: string
  content: string | null
  similarity: number
}

export async function matchExpoDocs(
  queryEmbedding: number[],
  matchThreshold: number,
  matchCount: number
): Promise<MatchedDoc[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`

  return prisma.$queryRaw<MatchedDoc[]>`
    SELECT
      id,
      content,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM "ExpoDocs"
    WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${matchCount}
  `
}

export async function matchNativeWindDocs(
  queryEmbedding: number[],
  matchThreshold: number,
  matchCount: number
): Promise<MatchedDoc[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`

  return prisma.$queryRaw<MatchedDoc[]>`
    SELECT
      id,
      content,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM "NativeWindDocs"
    WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${matchCount}
  `
}
