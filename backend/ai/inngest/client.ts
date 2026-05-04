import { Inngest } from "inngest"
import { NODE_ENV, INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY } from "../../config"
import { realtimeMiddleware } from "@inngest/realtime/middleware"

const data: any = {
  id: "AI-dev" ,
  name: "AI Dev",
  middleware: [realtimeMiddleware()]
}

if (NODE_ENV === 'PROD' && INNGEST_SIGNING_KEY && INNGEST_EVENT_KEY) {
  data.signingKey = INNGEST_SIGNING_KEY!
  data.eventKey = INNGEST_EVENT_KEY!
}

// Create a client to send and receive events
export const inngest = new Inngest(data)
