# Android Frontend ↔ Backend Correspondence Plan

## Objective

Align the Android frontend with the current backend APIs for projects, discover, chat/messages, realtime job streams, secrets, deployments/keystore/APK export, and profile picture management.

## Confirmed Backend Contract (Resolved)

- Auth header: `Authorization: Bearer <token>` is required on protected routes.
- Realtime token endpoint: `POST /api/realtime` with body `{ projectId, type }` where `type ∈ {"code-agent","deploy","export-apk","generate-keystore","preview"}`.
- Inngest websocket endpoint: `wss://api.inngest.com/v1/realtime/connect?token=<JWT>` (from token response).
- Profile picture endpoint: `PUT /api/auth/me/profile-picture` with JSON body `{ image, mimeType }` (base64 image), not multipart.
- Account secrets: `GET/POST/DELETE /api/secrets`.
- Project secrets: `GET/POST/DELETE /api/projects/{projectId}/secrets/{name?}`.
- Deploy/keystore/export/preview:
  - `POST /api/projects/{projectId}/deploy`
  - `POST /api/projects/{projectId}/keystore`
  - `POST /api/projects/{projectId}/export-apk`
  - `POST /api/projects/{projectId}/preview`
  - `POST /api/projects/{projectId}/preview/restart`
- Publish lifecycle:
  - `POST /api/projects/{projectId}/publish`
  - `POST /api/projects/{projectId}/unpublish`
- Project image source: use backend `project.screenshotUrl`; fallback to initials avatar when absent.

## Current State Snapshot

- `ApiClient` already injects Bearer token via `SessionManager`.
- `build.gradle.kts` already exposes `BuildConfig.CLIENT_SECRET_KEY` from `local.properties`.
- Glide dependency is already added.
- Core screens (`HomeFragment`, `DiscoverFragment`, `ChatActivity`, `ProfileFragment`) still run mostly local/mock data and are not fully wired to backend APIs.
- `ApiService` now includes auth + projects/discover/messages/realtime + deploy/keystore/export/preview + profile picture endpoints.
- `HomeFragment`, `DiscoverFragment`, and `ChatActivity` are now wired to backend list/message endpoints.
- `ChatActivity` options now trigger deploy/keystore/export-apk/preview/restart preview APIs.
- `ProfileFragment` now supports backend profile picture upload/delete.

## Implementation Plan

### 1. API Surface Expansion

1. Extend `ApiService.java` with typed endpoints for:
   - projects/discover/messages
   - deploy/keystore/export/preview
   - account and project secrets
   - profile-picture update/delete
   - realtime token acquisition
2. Add request/response DTOs where missing (messages, jobs, secrets, realtime token, preview/deployment/apk summaries).

### 2. Data Wiring for Home + Discover + Chat

1. Replace static project seed logic with `GET /api/projects`.
2. Replace static discover feed with `GET /api/discover`.
3. Wire clone action to `POST /api/discover/{id}/clone`.
4. Load chat history using `GET /api/projects/{projectId}/messages`.
5. Send follow-ups through `POST /api/projects/{projectId}/messages`.

### 3. Realtime Streaming Integration

1. Add `RealtimeClient.java` using OkHttp WebSocket.
2. Before each socket connect, fetch token from `POST /api/realtime`.
3. Connect to Inngest websocket URL and parse frames by `kind`; handle app events from `kind = "data"` and `data.type`.
4. Auto-reconnect by fetching a new token when connection closes/fails (token lifetime is short).
5. Deliver events into UI through listener callbacks or LiveData bridge.

### Progress Notes (Finalized)

1. API expansion completed for project/discover/messages/realtime/job/profile-picture/secrets plus publish/unpublish flows, with required DTOs.
2. Core screens are wired to backend data for Home, Discover, clone action, and Chat history/send.
3. Realtime websocket stream is integrated with token refresh reconnect and job-event UI surfacing.
4. Account/project secrets are implemented with AES-GCM encryption and `useUserSecret` handling.
5. Publish/update/unpublish actions now call backend endpoints to keep Discover state consistent.

### 4. Background Jobs in Chat UI

1. Connect Chat options menu actions to backend calls:
   - Deploy / Keystore / Export APK / Preview / Preview Restart.
2. Render job state/progress updates from realtime frames in the chat timeline.
3. Reflect backend failures directly in UI messages/snackbars.

### 5. Secrets Management

1. Add account-level secrets UI (in profile area).
2. Add project-level secrets UI (from project/chat settings).
3. Implement client encryption for `encryptedValue` using `BuildConfig.CLIENT_SECRET_KEY` (AES-256-GCM payload format expected by backend).
4. Support `useUserSecret` toggle for project secrets.

### 6. Profile + Project Images

1. In `ProfileFragment`, add image picker, base64 conversion, and `PUT /api/auth/me/profile-picture`.
2. Display returned profile URL with Glide and support delete action.
3. In project lists, render `screenshotUrl` with Glide and initials fallback when missing.

## Validation Checklist

1. Authenticated requests include bearer token.
2. Home/Discover render backend data (including clone path).
3. Chat shows persisted messages and can send new prompts.
4. Realtime connects and recovers across token expiry.
5. Deploy/keystore/export/preview flows trigger and surface progress.
6. Account/project secrets can be created/updated/deleted; `useUserSecret` works.
7. Profile picture upload/delete works with base64 payload.
8. Project image fallback is correct when `screenshotUrl` is null.
