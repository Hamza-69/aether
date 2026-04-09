import { matchNativeWindDocs } from "../db/functions"

export async function findNearestMatchNativeWindDocs(embedding: Array<number>): Promise<string> {
  const data = await matchNativeWindDocs(embedding, 0.5, 10)

  if (!data || data.length === 0) {
    console.warn("No data returned from matchNativeWindDocs")
    return ""
  }

  return data.map((obj) => obj.content).join('\n')
}
