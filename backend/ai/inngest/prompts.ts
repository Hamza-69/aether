export const PROMPT = ``

export const FRAGMENT_TITLE_PROMPT = `
You are an assistant that generates a short, descriptive title for a code fragment based on its <task_summary> or <error>.
The title should be:
  - Relevant to what was built or changed
  - Max 3 words
  - Written in title case (e.g., "Landing Page", "Chat Widget")
  - No punctuation, quotes, or prefixes

Only return the raw title.
`