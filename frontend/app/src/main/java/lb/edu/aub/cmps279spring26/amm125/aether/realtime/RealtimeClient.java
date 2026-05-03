package lb.edu.aub.cmps279spring26.amm125.aether.realtime;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import com.google.gson.JsonElement;

import java.util.List;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.RealtimeTokenRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.RealtimeTokenResponse;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import retrofit2.Call;
import retrofit2.Callback;

public class RealtimeClient {
    private static final String TAG = "RealtimeClient";

    public interface Listener {
        void onData(String streamType, JSONObject payload);
        void onStatus(String streamType, String status);
        void onError(String streamType, String errorMessage);
    }

    private static final String INNGEST_WS_URL = "ws://10.0.2.2:8288/v1/realtime/connect?token=";

    private final ApiService apiService;
    private final OkHttpClient okHttpClient;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Listener listener;

    private String projectId;
    private String streamType;
    private WebSocket webSocket;
    private boolean reconnectEnabled = false;
    private int reconnectDelayMs = 1000;

    public RealtimeClient(ApiService apiService, Listener listener) {
        this.apiService = apiService;
        this.okHttpClient = new OkHttpClient.Builder().build();
        this.listener = listener;
    }

    public void connect(String projectId, String streamType) {
        this.projectId = projectId;
        this.streamType = streamType;
        this.reconnectEnabled = true;
        this.reconnectDelayMs = 1000;
        fetchTokenAndConnect();
    }

    public void disconnect() {
        reconnectEnabled = false;
        mainHandler.removeCallbacksAndMessages(null);
        if (webSocket != null) {
            webSocket.close(1000, "client disconnect");
            webSocket = null;
        }
    }

    private void fetchTokenAndConnect() {
        if (projectId == null || streamType == null) return;

        apiService.createRealtimeToken(new RealtimeTokenRequest(projectId, streamType))
                .enqueue(new Callback<RealtimeTokenResponse>() {
                    @Override
                    public void onResponse(Call<RealtimeTokenResponse> call, retrofit2.Response<RealtimeTokenResponse> response) {
                        if (!response.isSuccessful() || response.body() == null || response.body().getToken() == null) {
                            notifyError("Failed to get realtime token");
                            scheduleReconnect();
                            return;
                        }

                        RealtimeTokenResponse body = response.body();
                        List<JsonElement> streamChunks = body.getStreamChunks();
                        if (streamChunks != null) {
                            for (JsonElement chunk : streamChunks) {
                                if (chunk == null || chunk.isJsonNull()) continue;
                                try {
                                    JSONObject payload = coerceObject(chunk.toString());
                                    if (payload != null && payload.length() > 0) {
                                        notifyData(payload);
                                    }
                                } catch (JSONException ignored) {
                                    // Ignore malformed historical chunks.
                                }
                            }
                        }

                        String token = body.getToken();
                        String url = INNGEST_WS_URL + URLEncoder.encode(token, StandardCharsets.UTF_8);
                        Log.d(TAG, "Connecting realtime stream " + streamType + " to " + INNGEST_WS_URL + "<token>");
                        Request request = new Request.Builder().url(url).build();
                        webSocket = okHttpClient.newWebSocket(request, new InngestWebSocketListener());
                    }

                    @Override
                    public void onFailure(Call<RealtimeTokenResponse> call, Throwable t) {
                        Log.w(TAG, "Realtime token request failed for " + streamType, t);
                        notifyError("Realtime token request failed");
                        scheduleReconnect();
                    }
                });
    }

    private void scheduleReconnect() {
        if (!reconnectEnabled) return;
        int delay = reconnectDelayMs;
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10_000);
        mainHandler.postDelayed(this::fetchTokenAndConnect, delay);
    }

    private void notifyStatus(String status) {
        mainHandler.post(() -> listener.onStatus(streamType, status));
    }

    private void notifyError(String error) {
        mainHandler.post(() -> listener.onError(streamType, error));
    }

    private void notifyData(JSONObject payload) {
        mainHandler.post(() -> listener.onData(streamType, payload));
    }

    private class InngestWebSocketListener extends WebSocketListener {
        @Override
        public void onOpen(WebSocket webSocket, Response response) {
            reconnectDelayMs = 1000;
            Log.d(TAG, "Realtime websocket opened for " + streamType);
            notifyStatus("connected");
        }

        @Override
        public void onMessage(WebSocket webSocket, String text) {
            try {
                JSONObject root = new JSONObject(text);
                String kind = root.optString("kind", "");
                if ("datastream-start".equalsIgnoreCase(kind) || "datastream-end".equalsIgnoreCase(kind)) {
                    return;
                }
                JSONObject payload = extractPayload(root);
                if (payload.length() > 0) {
                    notifyData(payload);
                }
            } catch (JSONException e) {
                Log.w(TAG, "Ignoring malformed realtime frame for " + streamType + ": " + text, e);
            }
        }

        @Override
        public void onClosed(WebSocket webSocket, int code, String reason) {
            Log.d(TAG, "Realtime websocket closed for " + streamType + " code=" + code + " reason=" + reason);
            notifyStatus("closed");
            scheduleReconnect();
        }

        @Override
        public void onFailure(WebSocket webSocket, Throwable t, Response response) {
            Log.w(TAG, "Realtime websocket failed for " + streamType, t);
            notifyStatus("failed");
            scheduleReconnect();
        }
    }

    private JSONObject extractPayload(JSONObject root) throws JSONException {
        Object candidate = root.has("data") ? root.opt("data") : root.opt("payload");
        JSONObject payload = coerceObject(candidate);
        if (payload == null && root.has("chunk")) {
            payload = new JSONObject();
            payload.put("message", root.optString("chunk", ""));
            return payload;
        }
        if (payload == null) {
            return new JSONObject();
        }
        return unwrapEnvelope(payload);
    }

    private JSONObject unwrapEnvelope(JSONObject payload) throws JSONException {
        JSONObject current = payload;
        for (int i = 0; i < 4; i++) {
            if (looksLikeBusinessPayload(current)) {
                return current;
            }
            Object nested = current.has("data") ? current.opt("data") : current.opt("payload");
            JSONObject next = coerceObject(nested);
            if (next == null) break;
            current = next;
        }
        return current;
    }

    private boolean looksLikeBusinessPayload(JSONObject value) {
        return value.has("message")
                || value.has("done")
                || value.has("error")
                || value.has("url")
                || value.has("preview")
                || value.has("deployment")
                || value.has("apk")
                || value.has("screenshotUrl")
                || value.has("id")
                || value.has("role")
                || value.has("content")
                || value.has("tool")
                || value.has("explanation")
                || value.has("fragment")
                || value.has("starting")
                || value.has("status")
                || value.has("completed");
    }

    private JSONObject coerceObject(Object value) throws JSONException {
        if (value instanceof JSONObject) {
            return (JSONObject) value;
        }
        if (!(value instanceof String)) {
            return null;
        }
        String text = ((String) value).trim();
        if (text.isEmpty()) {
            return null;
        }
        if (text.startsWith("{")) {
            return new JSONObject(text);
        }
        JSONObject wrapped = new JSONObject();
        wrapped.put("message", text);
        return wrapped;
    }
}
