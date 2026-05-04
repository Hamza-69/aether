# Inngest Realtime — Handoff Brief

Self-contained guide for porting Inngest realtime subscriptions to a new
project (target stack: **Express + Inngest backend**, **Java/Android mobile
client**). All findings below were verified end-to-end against a running
Inngest dev server on `localhost:8288` and the cloud gateway at
`api.inngest.com`.

---

## TL;DR

```
┌──────────────┐  1. GET /subscribe-token       ┌─────────────────┐
│ Mobile (Java)│ ─────────────────────────────► │ Express backend │
│              │ ◄───────────────────────────── │  (Inngest SDK)  │
│              │     { token: { key: JWT, … } } └────────┬────────┘
│              │                                         │ getSubscriptionToken()
│              │                                         ▼
│              │                                  POST /v1/realtime/token
│              │                                  (signed w/ INNGEST_SIGNING_KEY)
│              │                                         │
│              │  2. WS /v1/realtime/connect?token=JWT   ▼
│              │ ─────────────────────────────► ┌──────────────────┐
│              │ ◄───────────────────────────── │ Inngest gateway  │
│              │   {kind, channel, topic, data} │ api.inngest.com  │
└──────────────┘                                └──────────────────┘
```

Three pieces:

1. **Backend mints a short-lived JWT** scoped to a channel + topics.
2. **Client opens a plain WebSocket** with that JWT in the query string.
3. **Server pushes JSON frames**; client switches on `kind` and `data.type`.

No subprotocols, no auth message, no subscribe frame. The token alone scopes
the subscription.

---

## 1. Backend — minting a subscription token

### With the SDK (recommended)

In an Express handler (TypeScript):

```ts
import { Inngest } from "inngest";
import { realtimeMiddleware, getSubscriptionToken } from "@inngest/realtime";

export const inngest = new Inngest({
  id: "your-app-id",
  middleware: [realtimeMiddleware()],
});

// GET /subscribe-token?channelKeyA=...&channelKeyB=...
app.get("/subscribe-token", requireAuth, async (req, res) => {
  const { clubId, projectId } = req.query;          // adapt to your scheme
  const channel = `club:${clubId}:project:${projectId}`;

  const token = await getSubscriptionToken(inngest, {
    channel,
    topics: ["ai"],                                 // whatever topics you publish to
  });

  res.json({ token });    // shape: { token: { key: "<JWT>", channel, topics } }
});
```

**Auth this endpoint.** The JWT it returns gives the bearer read access to
that channel for ~60s. Anyone with the JWT can subscribe — that's fine, but
anyone able to call `/subscribe-token` for an arbitrary `channel` parameter
can subscribe to anything. So:

- Don't accept the channel string directly from the client. Build it from
  parameters you authorize (e.g. verify the user is a member of `clubId`).
- Treat `INNGEST_SIGNING_KEY` like a secret. **Never ship it to the mobile
  client.** It can mint tokens for any channel.

### Without the SDK (raw HTTP, if you ever need it)

```bash
curl -X POST https://api.inngest.com/v1/realtime/token \
  -H "Authorization: Bearer signkey-<env>-<your-key>" \
  -H "Content-Type: application/json" \
  -d '{"channel":"…","topics":["ai"]}'
```

The SDK does this for you, including signing-key rotation handling. Prefer
the SDK unless you're in a language without one.

### Token shape

The "key" is a JWT (HS256). Decoded payload from a real token:

```json
{
  "iss": "rt.inngest.com",
  "sub": "<inngest-account-id>",
  "iat": 1777639074,
  "exp": 1777639134,
  "jti": "01KQHRQAA9YW9NZSH52Y9FZCRE",
  "env": "<env-id>",
  "topics": [
    {
      "kind": "run",
      "env_id": "<env-id>",
      "channel": "club:<clubId>:project:<projectId>",
      "name": "ai"
    }
  ],
  "publish": false
}
```

- `exp - iat ≈ 60s` — tokens expire fast. Re-fetch on every reconnect.
- `publish: false` — subscribe-only token. Cannot be used to publish.

---

## 2. Backend — publishing messages

Inside an Inngest function, the realtime middleware injects a `publish()`
helper. Channel and topic on the publish side **must match** what the token
authorizes:

```ts
import { inngest } from "./client";

export const myFn = inngest.createFunction(
  { id: "my-fn" },
  { event: "app/something.happened" },
  async ({ event, step, publish }) => {
    const channel = `club:${event.data.clubId}:project:${event.data.projectId}`;

    await publish({
      channel,
      topic: "ai",
      data: { type: "chunk", text: "hello", sequence: 1 },
    });
  }
);
```

Publish calls inside a `step.run(...)` body are covered by that step — do not
wrap them in a nested step.

---

## 3. Client — connecting

### WebSocket URL

```
wss://api.inngest.com/v1/realtime/connect?token=<JWT>          # cloud
ws://localhost:8288/v1/realtime/connect?token=<JWT>            # dev server
```

- No `Sec-WebSocket-Protocol`.
- No headers required beyond standard upgrade.
- No first message to send. Just open and read.

### Reference: minimal Node CLI

See `subscribe.mjs` next to this file for a ~60-line working subscriber using
Node's native `WebSocket`. Run with either a raw token or a token-fetch URL.

### Java (Android) sketch

Using `OkHttp`:

```java
String wsUrl = baseUrl + "/v1/realtime/connect?token=" + jwt;

Request req = new Request.Builder().url(wsUrl).build();
client.newWebSocket(req, new WebSocketListener() {
  @Override public void onOpen(WebSocket ws, Response r) { /* ready */ }

  @Override public void onMessage(WebSocket ws, String text) {
    JSONObject frame = new JSONObject(text);
    String kind = frame.getString("kind");
    if ("data".equals(kind)) {
      JSONObject data = frame.getJSONObject("data");
      String type = data.optString("type");
      // dispatch on type: "chunk", "fragment_update", "hil_completed", …
    }
  }

  @Override public void onClosed(WebSocket ws, int code, String reason) { /* … */ }
  @Override public void onFailure(WebSocket ws, Throwable t, Response r) { /* … */ }
});
```

`java.net.http.WebSocket` works just as well — pick whichever matches the
project's HTTP stack.

### Reconnect loop

Tokens die in ~60s. The WS will close (code 1006 or 1000 with reason
"token expired") and you re-fetch. Reference pattern:

```
loop:
  token = fetch /subscribe-token
  ws = open(token)
  read frames until close
  sleep 1.5s
  retry
```

This mirrors what the React SDK does — see `useInngestSubscription` /
`TokenSubscription`.

---

## 4. Wire format — frame reference

Every text frame is one JSON object with these top-level fields:

| field        | type    | notes                                                                |
|--------------|---------|----------------------------------------------------------------------|
| `kind`       | string  | `"data"`, `"datastream-start"`, `"datastream-end"`, `"chunk"`        |
| `channel`    | string  | echoes the channel the publisher used                                |
| `topic`      | string  | echoes the topic                                                     |
| `data`       | any     | for `kind:"data"`, this is your `publish({ data })` payload          |
| `created_at` | string  | ISO-8601 timestamp                                                   |
| `run_id`     | string? | Inngest run that emitted it (ULID)                                   |
| `fn_id`      | string? | function ID                                                          |
| `env_id`     | string? | Inngest env UUID                                                     |
| `stream_id`  | string? | only on `datastream-*` and `chunk` kinds                             |

### `kind: "data"` (the common case)

What you'll see 99% of the time. `data` is whatever you passed to `publish`.
Real example captured from the aub-clubs reference project:

```json
{
  "kind": "data",
  "channel": "club:77d2119b-…:project:978819fe-…",
  "topic": "ai",
  "data": {
    "type": "chunk",
    "clubId": "77d2119b-…",
    "projectId": "978819fe-…",
    "messageId": "e6401d65-…",
    "text": "Great choice — I'm locking in MedVision Challenge…",
    "chunkId": "844fbf3c-…",
    "sequence": 3354
  },
  "created_at": "2026-05-01T12:59:40.079058Z",
  "env_id": "00000000-0000-4000-b000-000000000000",
  "run_id": "01KQHSV6PNTY5K5559EWSF17QZ"
}
```

Note the **two layers**:

- **Outer envelope** (`kind`, `channel`, `topic`, …) is Inngest's transport.
- **Inner `data`** is your application payload. Its shape is whatever your
  publisher chose. In the reference project the convention is
  `{ type: "<event-name>", …rest }` — the client switches on `data.type`.

### `kind: "datastream-start"` / `"chunk"` / `"datastream-end"`

Inngest's chunked-stream feature. Used when a publisher streams a large
payload as many small chunks under a single logical stream:

1. `datastream-start` — `data` is the new stream's ID; create a buffer.
2. `chunk` — `stream_id` identifies which buffer; `data` is the chunk.
3. `datastream-end` — close that buffer.

If you don't use streaming publishes, you can ignore these and only handle
`kind: "data"`.

---

## 5. Application-layer payload conventions

The reference project (aub-clubs) uses these `data.type` values inside
`kind:"data"` frames. Adopt or adapt for your own project — these are not
part of Inngest's protocol, just an app-level contract.

| `data.type`         | meaning                                                |
|---------------------|--------------------------------------------------------|
| `chunk`             | streaming a piece of an LLM/agent text response        |
| `fragment_started`  | new "fragment" (workspace artifact) is being built     |
| `fragment_update`   | updated artifact data (event_details, posts, etc.)    |
| `fragment_completed`| fragment is finalized; refetch DB                      |
| `awaiting_*_approval` | human-in-the-loop gate is waiting on user input      |
| `hil_completed`     | HIL gate cleared                                       |

See `src/inngest/event-generator/publishers.ts` in the reference repo for the
exact publisher functions, and `src/modules/event-generator/ui/EventGeneratorPage.tsx`
for the consumer switch statement.

---

## 6. Gotchas

- **`exp` is short.** ~60s. Don't cache the token; refetch on every connect.
- **Middleware will swallow your endpoint.** In Next.js the global auth
  middleware redirects `/api/*` requests without a session to `/auth`. In
  Express you'll have your own middleware — make sure your auth check
  returns 401 (JSON) rather than a redirect, otherwise the mobile client
  will see HTML it can't parse.
- **Dev vs cloud base URL.** The Inngest SDK picks the gateway from
  `INNGEST_DEV` / `NODE_ENV`. The mobile client needs to know which base to
  hit — pass it from your Express config rather than hard-coding.
- **Channel string is opaque to Inngest.** It's just a key. Pick a scheme
  that maps cleanly to your authorization model so the backend can verify
  the user is allowed before minting a token.
- **WebSocket close code 1006 with no reason** almost always = expired/
  invalid token. Re-fetch and retry.
- **Don't validate frames against the official Zod schema** unless you
  actually need to — it's not stable across SDK versions and the shape above
  is what's on the wire today.

---

## 7. What's in this demo directory

- `subscribe.mjs` — Node CLI subscriber, ~60 LOC, no deps. Use as a
  reference implementation.
- `README.md` — usage of the CLI itself.
- `HANDOFF.md` — this file.

---

## 8. Where the reference implementation lives

In the aub-clubs Next.js repo (which this demo lives inside):

| concern                       | file                                                        |
|-------------------------------|-------------------------------------------------------------|
| Inngest client + middleware   | `src/inngest/client.ts`                                     |
| Token endpoint                | `src/app/api/event-generator/subscribe-token/route.ts`      |
| Publisher helpers             | `src/inngest/event-generator/publishers.ts`                 |
| Inngest function (publisher)  | `src/inngest/event-generator/function.ts`                   |
| Frontend subscribe loop       | `src/modules/event-generator/ui/EventGeneratorPage.tsx` (~L479) |
| SDK source consulted          | `node_modules/@inngest/realtime/subscribe/TokenSubscription.mjs` |

When in doubt about wire behavior, that `TokenSubscription.mjs` file is the
ground truth — it's the official client and shows exactly which frame kinds
exist and how they're parsed.

