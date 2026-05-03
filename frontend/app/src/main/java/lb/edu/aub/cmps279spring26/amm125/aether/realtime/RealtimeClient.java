package lb.edu.aub.cmps279spring26.amm125.aether.realtime;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONException;
import org.json.JSONObject;

import com.google.gson.JsonElement;

import java.util.List;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
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
    public interface Listener {
        void onData(String streamType, JSONObject payload);
        void onStatus(String streamType, String status);
        void onError(String streamType, String errorMessage);
    }

    private static final String INNGEST_WS_URL = "wss://api.inngest.com/v1/realtime/connect?token=";

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
        this.okHttpClient = ApiClient.getOkHttpClient();
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
                                    notifyData(new JSONObject(chunk.toString()));
                                } catch (JSONException ignored) {
                                    // Ignore malformed historical chunks.
                                }
                            }
                        }

                        String token = body.getToken();
                        String url = INNGEST_WS_URL + URLEncoder.encode(token, StandardCharsets.UTF_8);
                        Request request = new Request.Builder().url(url).build();
                        webSocket = okHttpClient.newWebSocket(request, new InngestWebSocketListener());
                    }

                    @Override
                    public void onFailure(Call<RealtimeTokenResponse> call, Throwable t) {
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
            notifyStatus("connected");
        }

        @Override
        public void onMessage(WebSocket webSocket, String text) {
            try {
                JSONObject root = new JSONObject(text);
                String kind = root.optString("kind", "");
                if (!"data".equalsIgnoreCase(kind)) return;

                JSONObject payload;
                Object data = root.opt("data");
                if (data instanceof JSONObject) {
                    payload = (JSONObject) data;
                } else if (data instanceof String) {
                    payload = new JSONObject();
                    payload.put("message", data);
                } else {
                    payload = new JSONObject();
                }
                notifyData(payload);
            } catch (JSONException ignored) {
                // Non-JSON frames are ignored.
            }
        }

        @Override
        public void onClosed(WebSocket webSocket, int code, String reason) {
            notifyStatus("closed");
            scheduleReconnect();
        }

        @Override
        public void onFailure(WebSocket webSocket, Throwable t, Response response) {
            notifyStatus("failed");
            scheduleReconnect();
        }
    }
}
