import OpenAI from 'openai'
import { OPENAI_API_KEY } from '../../config'

/** OpenAI config */
if (!OPENAI_API_KEY) throw new Error("OpenAI API key is missing or invalid.")
export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
})