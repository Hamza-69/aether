import { matchExpoDocs } from "../db/functions"

export async function findNearestMatchExpoDocs(embedding: Array<number>): Promise<string> {
  const data = await matchExpoDocs(embedding, 0.5, 10)

  if (!data || data.length === 0) {
    console.warn("No data returned from matchExpoDocs")
    return ""
  }

  return data.map((obj) => obj.content).join('\n')
}
