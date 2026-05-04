# Android Frontend ↔ Backend Correspondence Task List

- `[x]` 1. Setup API/Auth prerequisites
  - `[x]` `ApiClient.java`: Bearer token interceptor (`Authorization: Bearer <token>`) exists.
  - `[x]` `build.gradle.kts`: `BuildConfig.CLIENT_SECRET_KEY` wired from `local.properties`.
  - `[x]` `build.gradle.kts`: Glide dependency added.

- `[x]` 2. Expand Retrofit API surface
  - `[x]` Add project/discover/messages endpoints to `ApiService.java`.
  - `[x]` Add realtime token endpoint (`POST /api/realtime`).
  - `[x]` Add deploy/keystore/export/preview endpoints.
  - `[x]` Add secrets + profile picture endpoints.
  - `[x]` Add missing DTOs for new responses/requests.

- `[x]` 3. Connect core screens to backend data
  - `[x]` `HomeFragment` / `ProjectAdapter`: replace local seed data with `GET /api/projects`.
  - `[x]` `DiscoverFragment`: use `GET /api/discover`.
  - `[x]` `DiscoverAdapter` action: wire `POST /api/discover/{id}/clone`.
  - `[x]` `ChatActivity`: load messages from `GET /api/projects/{projectId}/messages`.
  - `[x]` `ChatActivity`: send prompts via `POST /api/projects/{projectId}/messages`.

- `[x]` 4. Implement realtime streaming
  - `[x]` Create `RealtimeClient.java` (OkHttp WebSocket).
  - `[x]` Fetch short-lived token via `POST /api/realtime` before each connection.
  - `[x]` Connect to `wss://api.inngest.com/v1/realtime/connect?token=<JWT>`.
  - `[x]` Parse frames (`kind`, then `data.type`) and dispatch to UI.
  - `[x]` Implement reconnect loop with fresh token refresh on socket close/failure.

- `[x]` 5. Wire background jobs in UI
  - `[x]` `ChatActivity` options: trigger Deploy/Keystore/Export/Preview/Preview Restart APIs.
  - `[x]` Surface progress/completion/failure events from realtime stream.
  - `[x]` Keep publish/update/unpublish UX consistent with backend state.

- `[x]` 6. Implement secrets management
  - `[x]` Add account-level secrets screen (profile area).
  - `[x]` Add project-level secrets screen (project settings/chat options entry).
  - `[x]` Implement AES-GCM client encryption for `encryptedValue` using `BuildConfig.CLIENT_SECRET_KEY`.
  - `[x]` Support `useUserSecret` toggle for project secrets.

- `[x]` 7. Implement profile/project image flows
  - `[x]` `ProfileFragment`: image picker + base64 upload to `PUT /api/auth/me/profile-picture`.
  - `[x]` `ProfileFragment`: support `DELETE /api/auth/me/profile-picture`.
  - `[x]` `ProjectAdapter`: load `screenshotUrl` when present, initials fallback otherwise.
