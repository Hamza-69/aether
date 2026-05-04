package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.content.res.ColorStateList;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.snackbar.BaseTransientBottomBar;
import com.google.android.material.snackbar.Snackbar;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import org.json.JSONObject;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.BackendProject;
import lb.edu.aub.cmps279spring26.amm125.aether.model.MessagesResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectMessage;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectWrapperResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.RequiredSecretSummary;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretSummary;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsWriteResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SendMessageRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertProjectSecretEntry;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertProjectSecretsRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.realtime.RealtimeClient;
import lb.edu.aub.cmps279spring26.amm125.aether.utils.SecretCryptoUtil;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChatActivity extends AppCompatActivity {
    private static final String STREAM_CODE_AGENT = "code-agent";
    private static final String STREAM_DEPLOY = "deploy";
    private static final String STREAM_EXPORT_APK = "export-apk";
    private static final String STREAM_GENERATE_KEYSTORE = "generate-keystore";
    private static final String STREAM_PREVIEW = "preview";
    private static final String SANDBOX_NOT_FOUND_MSG = "the sandbox was not found";
    private static final String CLOSED_PORT_MSG = "closed port error";
    private static final String CONNECTION_REFUSED_MSG = "connection refused on port";
    private static final String E2B_SANDBOX_HEADER = "x-e2b-sandbox-id";
    private static final long PREVIEW_STALE_THRESHOLD_MS = 20L * 60L * 1000L;
    private static final int PREVIEW_POST_MAX_RETRIES = 5;
    private static final long PREVIEW_POST_INITIAL_BACKOFF_MS = 1000L;
    private static final long PREVIEW_REQUEST_CLOCK_SKEW_MS = 3000L;
    private static final Set<String> SUPPRESSED_MISSING_REQUIRED_SECRETS =
            Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
                    "CORS_ALLOWED_ORIGINS",
                    "DATABASE_URL",
                    "PORT",
                    "PREVIEW_CORS_ORIGIN"
            )));

    private RecyclerView rvChat;
    private ChatAdapter adapter;
    private List<ChatMessage> messageList;
    private EditText etMessage;
    private MaterialCardView btnSend;
    private View inputContainer;
    private View previewContainer;
    private View previewLoadingOverlay;
    private View mockPhone;
    private View previewStatusCard;
    private WebView webPreview;
    private TextView tvPreviewHint;
    private TextView tvPreviewLoading;
    private TextView tvPreviewStatusTitle;
    private TextView tvPreviewStatusBody;
    private TextView tvPreviewStatusUrl;
    private MaterialButton btnChatToggle, btnViewToggle;
    private String currentPreviewUrl;
    private String projectTitle;
    private String projectDesc;
    private String projectStatus;
    private String projectId;
    private Project currentProject;
    private int projectIndex = -1;
    private boolean previewErrorShown = false;
    private boolean previewRecoveryInProgress = false;
    private boolean previewStarting = false;
    private boolean previewStatusMode = false;
    private boolean previewMarkedRunning = false;
    private boolean previewValidationInFlight = false;
    private String renderedPreviewUrl;
    private String lastPreviewStatusLine = "";
    private final StringBuilder previewStatusSteps = new StringBuilder();
    private final Set<String> previewStatusSeenLines = new HashSet<>();
    private long activePreviewRequestStartedAtMs = 0L;
    private boolean requirePreviewFreshness = true;
    private String activeAgentMessageId;
    private final ApiService apiService = ApiClient.getApiService();
    private final Map<String, RealtimeClient> realtimeClients = new HashMap<>();
    private final OkHttpClient previewHealthClient = new OkHttpClient.Builder().build();
    private final Handler previewRetryHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingPreviewRefetch;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat);

        projectTitle = getIntent().getStringExtra("PROJECT_TITLE");
        projectDesc = getIntent().getStringExtra("PROJECT_DESC");
        projectStatus = getIntent().getStringExtra("PROJECT_STATUS");
        projectId = getIntent().getStringExtra("PROJECT_ID");
        projectIndex = getIntent().getIntExtra("PROJECT_INDEX", -1);

        if (projectIndex != -1 && projectIndex < HomeActivity.userProjects.size()) {
            currentProject = HomeActivity.userProjects.get(projectIndex);
            if (projectId == null || projectId.trim().isEmpty()) {
                projectId = currentProject.getBackendId();
            }
        }

        if (projectTitle == null) projectTitle = "Project";
        if (projectStatus == null) projectStatus = "Not Published";

        TextView tvTitle = findViewById(R.id.tvChatTitle);
        tvTitle.setText(projectTitle);

        updateStatusUI();

        ImageView btnBack = findViewById(R.id.btnBack);
        btnBack.setOnClickListener(v -> finish());

        ImageView btnOptions = findViewById(R.id.btnOptions);
        btnOptions.setOnClickListener(this::showEnhancedOptionsMenu);

        rvChat = findViewById(R.id.rvChat);
        etMessage = findViewById(R.id.etChatMessage);
        btnSend = findViewById(R.id.btnSendChat);
        inputContainer = findViewById(R.id.inputContainer);
        previewContainer = findViewById(R.id.previewContainer);
        previewLoadingOverlay = findViewById(R.id.previewLoadingOverlay);
        mockPhone = findViewById(R.id.mockPhone);
        previewStatusCard = findViewById(R.id.previewStatusCard);
        webPreview = findViewById(R.id.webPreview);
        tvPreviewHint = findViewById(R.id.tvPreviewHint);
        tvPreviewLoading = findViewById(R.id.tvPreviewLoading);
        tvPreviewStatusTitle = findViewById(R.id.tvPreviewStatusTitle);
        tvPreviewStatusBody = findViewById(R.id.tvPreviewStatusBody);
        tvPreviewStatusUrl = findViewById(R.id.tvPreviewStatusUrl);
        btnChatToggle = findViewById(R.id.btnChatToggle);
        btnViewToggle = findViewById(R.id.btnViewToggle);

        btnChatToggle.setCheckable(false);
        btnViewToggle.setCheckable(false);
        btnChatToggle.setRippleColor(ColorStateList.valueOf(Color.TRANSPARENT));
        btnViewToggle.setRippleColor(ColorStateList.valueOf(Color.TRANSPARENT));

        webPreview.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request == null || !request.isForMainFrame() || errorResponse == null) return;
                int statusCode = errorResponse.getStatusCode();
                if (statusCode >= 500) {
                    if (previewStarting || previewRecoveryInProgress) {
                        tvPreviewHint.setText("Preview is starting...");
                        setPreviewLoading(true, "Preview is starting...");
                        return;
                    }
                    maybeRefetchPreviewAfterE2bError("Preview is still starting...");
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request == null || !request.isForMainFrame()) return;
                if (previewStarting || previewRecoveryInProgress) {
                    tvPreviewHint.setText("Waiting for preview...");
                    setPreviewLoading(true, "Waiting for preview...");
                    return;
                }
                maybeRefetchPreviewAfterE2bError("Preview is still starting...");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if ("about:blank".equals(url)) return;
                probeForSandboxErrorPage();
            }
        });
        webPreview.getSettings().setJavaScriptEnabled(true);
        webPreview.getSettings().setDomStorageEnabled(true);

        messageList = new ArrayList<>();
        adapter = new ChatAdapter(messageList);
        rvChat.setLayoutManager(new LinearLayoutManager(this));
        rvChat.setAdapter(adapter);

        btnChatToggle.setOnClickListener(v -> showChatMode());
        btnViewToggle.setOnClickListener(v -> showViewMode());
        showChatMode();

        btnSend.setOnClickListener(v -> {
            String text = etMessage.getText().toString().trim();
            if (!TextUtils.isEmpty(text)) {
                sendMessage(text);
            }
        });

        if (!TextUtils.isEmpty(projectId)) {
            loadMessages();
        } else if (!TextUtils.isEmpty(projectDesc)) {
            messageList.add(new ChatMessage(projectDesc, true));
            adapter.notifyItemInserted(messageList.size() - 1);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelPendingPreviewRefetch();
        for (RealtimeClient client : realtimeClients.values()) {
            client.disconnect();
        }
        realtimeClients.clear();
    }

    private void connectRealtimeForType(String streamType) {
        connectRealtimeForType(streamType, false);
    }

    private void connectRealtimeForType(String streamType, boolean forceReconnect) {
        if (TextUtils.isEmpty(projectId)) {
            return;
        }
        if (forceReconnect) {
            stopRealtimeForType(streamType);
        } else if (realtimeClients.containsKey(streamType)) {
            return;
        }
        RealtimeClient client = new RealtimeClient(apiService, new RealtimeClient.Listener() {
            @Override
            public void onData(String type, JSONObject payload) {
                handleRealtimePayload(type, payload);
            }

            @Override
            public void onStatus(String type, String status) {
                // Realtime reconnects automatically; avoid noisy snackbars for transient socket drops.
            }

            @Override
            public void onError(String type, String errorMessage) {
                // Token/socket errors are retried by RealtimeClient and should not interrupt the project page.
            }
        });
        realtimeClients.put(streamType, client);
        client.connect(projectId, streamType);
    }

    private void handleRealtimePayload(String streamType, JSONObject payload) {
        if (STREAM_CODE_AGENT.equals(streamType)) {
            handleCodeAgentPayload(payload);
            return;
        }

        String message = extractRealtimeMessage(payload);
        boolean done = payload.optBoolean("done", false);
        boolean error = payload.optBoolean("error", false);

        if (!TextUtils.isEmpty(message) && !STREAM_PREVIEW.equals(streamType)) {
            appendSystemMessage("[" + formatStreamLabel(streamType) + "] " + message);
        }
        if (error && !STREAM_PREVIEW.equals(streamType)) {
            showInfoSnackbar(formatStreamLabel(streamType) + " failed");
        }

        if (STREAM_PREVIEW.equals(streamType)) {
            String statusMessage = extractRealtimeMessage(payload);
            boolean previewCompleted = false;
            boolean previewRunning = false;
            String topLevelUrl = payload.optString("url", "");
            if (!TextUtils.isEmpty(topLevelUrl)) {
                previewStarting = payload.optBoolean("starting", true);
                setCurrentPreviewUrl(topLevelUrl);
            }

            JSONObject preview = payload.optJSONObject("preview");
            if (preview != null) {
                String previewUrl = preview.optString("url", "");
                String previewMessage = preview.optString("message", "");
                String previewStatus = preview.optString("status", "");
                String liveMessage = !TextUtils.isEmpty(previewMessage) ? previewMessage : statusMessage;
                if (!TextUtils.isEmpty(liveMessage)) {
                    appendPreviewStatusStep(liveMessage);
                } else if (!TextUtils.isEmpty(previewStatus)) {
                    appendPreviewStatusStep("Status: " + previewStatus);
                }
                if (!TextUtils.isEmpty(previewUrl)) {
                    boolean completed = preview.optBoolean("completed", false);
                    boolean running = "RUNNING".equalsIgnoreCase(previewStatus);
                    boolean doneEvent = payload.optBoolean("done", false);
                    boolean markRunningEvent = doneEvent && completed;
                    previewCompleted = completed;
                    previewRunning = running;
                    previewStarting = !(completed || running);
                    setCurrentPreviewUrl(previewUrl);
                    if (markRunningEvent || running) {
                        // On mark-running, transition to web preview surface in loading state,
                        // but keep health-gating + backoff before rendering the actual URL.
                        previewStatusMode = false;
                        requirePreviewFreshness = false;
                        previewStarting = true;
                        if (previewContainer.getVisibility() != View.VISIBLE) {
                            showViewMode();
                        } else {
                            setPreviewStatusModeUI(false);
                            setPreviewLoading(true, "Checking preview runtime...");
                            webPreview.stopLoading();
                            webPreview.loadUrl("about:blank");
                            renderedPreviewUrl = null;
                        }
                        confirmPreviewReady(previewUrl);
                    }
                    if (completed) {
                        previewRecoveryInProgress = false;
                    }
                }
            } else if (!TextUtils.isEmpty(statusMessage)) {
                appendPreviewStatusStep(statusMessage);
            }
            if (done && !previewStatusMode && !previewStarting && !previewRecoveryInProgress) {
                stopRealtimeForType(STREAM_PREVIEW);
            }
        }
    }

    private void handleCodeAgentPayload(JSONObject payload) {
        boolean done = payload.optBoolean("done", false);
        boolean error = payload.optBoolean("error", false);

        Object rawMessage = payload.opt("message");
        if (rawMessage instanceof JSONObject) {
            applyAgentMessageObject((JSONObject) rawMessage);
        } else if (payload.has("id") && payload.has("role") && payload.has("content")) {
            applyAgentMessageObject(payload);
        } else {
            String progress = payload.optString("message", "");
            appendAgentThinkingChunk(progress);
        }

        String tool = payload.optString("tool", "");
        String explanation = payload.optString("explanation", "");
        if (!TextUtils.isEmpty(tool) || !TextUtils.isEmpty(explanation)) {
            String prefix = TextUtils.isEmpty(tool) ? "" : tool + ": ";
            appendAgentThinkingChunk(prefix + explanation);
        }

        JSONObject preview = payload.optJSONObject("preview");
        if (preview != null) {
            String previewUrl = preview.optString("url", "");
            if (!TextUtils.isEmpty(previewUrl)) {
                setCurrentPreviewUrl(previewUrl);
                if (!previewStatusMode) {
                    loadPreviewUrl(previewUrl);
                }
            }
        }

        if (payload.has("fragment")) {
            appendAgentThinkingChunk("Saved code changes.");
        }

        if (error) {
            appendAgentThinkingChunk("The agent run failed.");
            showInfoSnackbar("CODE AGENT failed");
        }

        if (done) {
            stopRealtimeForType(STREAM_CODE_AGENT);
            loadMessages();
        }
    }

    private void applyAgentMessageObject(JSONObject messageObject) {
        String id = messageObject.optString("id", "");
        String content = messageObject.optString("content", "");
        boolean completed = messageObject.optBoolean("completed", false);
        ChatMessage message = findChatMessageById(id);
        if (message == null) {
            message = new ChatMessage(id, content, false, completed, null);
            messageList.add(message);
            adapter.notifyItemInserted(messageList.size() - 1);
        } else {
            message.setText(content);
            message.setCompleted(completed);
            adapter.notifyItemChanged(messageList.indexOf(message));
        }
        activeAgentMessageId = TextUtils.isEmpty(id) ? activeAgentMessageId : id;
        rvChat.scrollToPosition(messageList.size() - 1);
    }

    private void appendAgentThinkingChunk(String chunk) {
        if (TextUtils.isEmpty(chunk) || "null".equalsIgnoreCase(chunk)) return;
        ChatMessage message = findChatMessageById(activeAgentMessageId);
        if (message == null) {
            message = new ChatMessage(activeAgentMessageId, "", false, false, null);
            messageList.add(message);
            adapter.notifyItemInserted(messageList.size() - 1);
        }
        message.appendThinking(chunk);
        int index = messageList.indexOf(message);
        if (index >= 0) {
            adapter.notifyItemChanged(index);
            rvChat.scrollToPosition(index);
        }
    }

    private ChatMessage findChatMessageById(String id) {
        if (TextUtils.isEmpty(id)) return null;
        for (ChatMessage message : messageList) {
            if (id.equals(message.getId())) {
                return message;
            }
        }
        return null;
    }

    private String extractRealtimeMessage(JSONObject payload) {
        Object raw = payload.opt("message");
        if (raw instanceof JSONObject) {
            String content = ((JSONObject) raw).optString("content", "");
            return "null".equalsIgnoreCase(content) ? "" : content;
        }
        String message = payload.optString("message", "");
        return "null".equalsIgnoreCase(message) ? "" : message;
    }

    private void stopRealtimeForType(String streamType) {
        RealtimeClient existing = realtimeClients.remove(streamType);
        if (existing != null) {
            existing.disconnect();
        }
    }

    private String formatStreamLabel(String streamType) {
        return streamType.replace("-", " ").toUpperCase(Locale.US);
    }

    private void appendSystemMessage(String text) {
        messageList.add(new ChatMessage(text, false));
        adapter.notifyItemInserted(messageList.size() - 1);
        rvChat.scrollToPosition(messageList.size() - 1);
    }

    private void loadMessages() {
        apiService.getProjectMessages(projectId).enqueue(new Callback<MessagesResponse>() {
            @Override
            public void onResponse(Call<MessagesResponse> call, Response<MessagesResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().getMessages() == null) {
                    showInfoSnackbar("Failed to load messages");
                    return;
                }
                List<ProjectMessage> backendMessages = response.body().getMessages();
                messageList.clear();
                activeAgentMessageId = null;
                ProjectMessage latestIncompleteAssistant = null;
                for (ProjectMessage m : backendMessages) {
                    boolean isUser = "USER".equalsIgnoreCase(m.getRole());
                    boolean completed = !Boolean.FALSE.equals(m.getCompleted());
                    String thinking = isUser ? null : buildThinkingText(m);
                    String content = m.getContent();
                    if (TextUtils.isEmpty(content) && isUser) continue;
                    if (TextUtils.isEmpty(content) && !isUser && completed && TextUtils.isEmpty(thinking)) continue;
                    messageList.add(new ChatMessage(m.getId(), content, isUser, completed, thinking));
                    if (!isUser && !completed) {
                        latestIncompleteAssistant = m;
                    }
                }
                adapter.notifyDataSetChanged();
                if (!messageList.isEmpty()) {
                    rvChat.scrollToPosition(messageList.size() - 1);
                }
                if (latestIncompleteAssistant != null) {
                    activeAgentMessageId = latestIncompleteAssistant.getId();
                    connectRealtimeForType(STREAM_CODE_AGENT);
                }
            }

            @Override
            public void onFailure(Call<MessagesResponse> call, Throwable t) {
                showInfoSnackbar("Could not reach backend");
            }
        });
    }

    private String buildThinkingText(ProjectMessage message) {
        if (message.getStream() == null || message.getStream().getStreamChunks() == null) {
            return null;
        }

        StringBuilder sb = new StringBuilder();
        for (ProjectMessage.StreamChunk chunk : message.getStream().getStreamChunks()) {
            String text = streamChunkText(chunk.getData());
            if (TextUtils.isEmpty(text)) continue;
            if (sb.length() > 0) sb.append('\n');
            sb.append(text);
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    private String streamChunkText(JsonObject data) {
        if (data == null) return "";

        JsonElement message = data.get("message");
        if (message != null) {
            if (message.isJsonPrimitive()) {
                return message.getAsString();
            }
            if (message.isJsonObject()) {
                JsonObject messageObject = message.getAsJsonObject();
                if (Boolean.TRUE.toString().equalsIgnoreCase(optString(messageObject, "completed"))) {
                    return "";
                }
                return optString(messageObject, "content");
            }
        }

        String tool = optString(data, "tool");
        String explanation = optString(data, "explanation");
        if (!TextUtils.isEmpty(tool) || !TextUtils.isEmpty(explanation)) {
            return (TextUtils.isEmpty(tool) ? "" : tool + ": ") + explanation;
        }

        if (data.has("fragment")) return "Saved code changes.";
        if (data.has("preview")) return "Preview is ready.";
        return "";
    }

    private String optString(JsonObject object, String key) {
        JsonElement value = object.get(key);
        if (value == null || value.isJsonNull()) return "";
        return value.isJsonPrimitive() ? value.getAsString() : "";
    }

    private void updateStatusUI() {
        TextView tvStatus = findViewById(R.id.tvChatStatus);
        tvStatus.setText(projectStatus);

        MaterialCardView statusBadge = findViewById(R.id.statusBadgeCard);
        if ("Published".equalsIgnoreCase(projectStatus)) {
            statusBadge.setCardBackgroundColor(0xFF00BFA5);
        } else {
            statusBadge.setCardBackgroundColor(0xFFFFB300);
        }

        if (currentProject != null) {
            currentProject.setStatus(projectStatus);
        }
    }

    private void showEnhancedOptionsMenu(View v) {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_chat_options);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);

            Window window = dialog.getWindow();
            window.setGravity(Gravity.TOP | Gravity.END);

            android.view.WindowManager.LayoutParams params = window.getAttributes();
            params.x = 20;
            params.y = 120;
            window.setAttributes(params);

            window.setWindowAnimations(android.R.style.Animation_Dialog);
        }

        LinearLayout optDeploy = dialog.findViewById(R.id.optionDeploy);
        LinearLayout optKeystore = dialog.findViewById(R.id.optionRename);
        LinearLayout optPreview = dialog.findViewById(R.id.optionPublish);
        LinearLayout optPreviewRestart = dialog.findViewById(R.id.optionUpdate);
        LinearLayout optExport = dialog.findViewById(R.id.optionExport);
        LinearLayout optSecrets = dialog.findViewById(R.id.optionSecrets);
        LinearLayout optDelete = dialog.findViewById(R.id.optionDelete);
        ImageView ivPublishIcon = dialog.findViewById(R.id.ivPublishIcon);
        TextView tvPublishText = dialog.findViewById(R.id.tvPublishText);
        TextView tvPreviewRestart = dialog.findViewById(R.id.tvUpdateText);
        TextView tvExport = optExport != null ? (TextView) optExport.getChildAt(1) : null;
        boolean isPublished = "Published".equalsIgnoreCase(projectStatus);

        if (optDeploy != null) optDeploy.setVisibility(View.GONE);
        if (optKeystore != null) optKeystore.setVisibility(View.GONE);
        if (optPreview != null) optPreview.setVisibility(View.VISIBLE);
        if (tvPublishText != null) tvPublishText.setText(isPublished ? "Unpublish" : "Publish");
        if (ivPublishIcon != null) {
            ivPublishIcon.setImageResource(isPublished ? R.drawable.ic_back : R.drawable.ic_sparkle);
            ivPublishIcon.setImageTintList(ColorStateList.valueOf(isPublished ? Color.GRAY : Color.parseColor("#00BFA5")));
        }
        if (tvPreviewRestart != null) tvPreviewRestart.setText("Preview");
        if (tvExport != null) tvExport.setText("Export");
        optUpdateVisible(optPreviewRestart, true);

        if (optPreview != null) {
            optPreview.setOnClickListener(view -> {
                dialog.dismiss();
                if (TextUtils.isEmpty(projectId)) {
                    showInfoSnackbar("This project is not linked to backend yet");
                    return;
                }
                if (isPublished) {
                    triggerAction("Project unpublished and removed from Discover", apiService.unpublishProject(projectId), () -> {
                        projectStatus = "Not Published";
                        if (currentProject != null) {
                            currentProject.setStatus(projectStatus);
                            currentProject.setHasUnpublishedChanges(false);
                        }
                        updateStatusUI();
                    });
                } else {
                    triggerAction("Project published successfully!", apiService.publishProject(projectId), () -> {
                        projectStatus = "Published";
                        if (currentProject != null) {
                            currentProject.setStatus(projectStatus);
                            currentProject.setHasUnpublishedChanges(false);
                        }
                        updateStatusUI();
                    });
                }
            });
        }

        optPreviewRestart.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            previewStarting = true;
            triggerPreviewAction("Preview requested", apiService.restartPreview(projectId));
            showViewMode();
        });

        optExport.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            Intent intent = new Intent(this, ExportActivity.class);
            intent.putExtra("PROJECT_ID", projectId);
            intent.putExtra("PROJECT_TITLE", projectTitle);
            startActivity(intent);
        });

        if (optSecrets != null) {
            optSecrets.setOnClickListener(view -> {
                dialog.dismiss();
                showProjectSecretsDialog();
            });
        }

        optDelete.setOnClickListener(view -> {
            dialog.dismiss();
            showDeleteConfirmationDialog();
        });

        dialog.show();
    }

    private void showProjectSecretsDialog() {
        if (TextUtils.isEmpty(projectId)) {
            showInfoSnackbar("This project is not linked to backend yet");
            return;
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        root.setPadding(pad, pad, pad, 0);

        EditText etName = new EditText(this);
        etName.setHint("Secret name (UPPER_SNAKE_CASE)");
        root.addView(etName);

        EditText etValue = new EditText(this);
        etValue.setHint("Secret value");
        root.addView(etValue);

        CheckBox cbUseAccountSecret = new CheckBox(this);
        cbUseAccountSecret.setText("Use matching account secret");
        root.addView(cbUseAccountSecret);

        TextView tvSecrets = new TextView(this);
        tvSecrets.setPadding(0, dp(12), 0, dp(8));
        root.addView(tvSecrets);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Project Secrets")
                .setView(root)
                .setPositiveButton("Save", null)
                .setNegativeButton("Delete", null)
                .setNeutralButton("Refresh", null)
                .create();
        dialog.setOnShowListener(d -> {
            loadProjectSecretsInto(tvSecrets);

            Button save = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            Button delete = dialog.getButton(AlertDialog.BUTTON_NEGATIVE);
            Button refresh = dialog.getButton(AlertDialog.BUTTON_NEUTRAL);

            save.setOnClickListener(v -> {
                String name = etName.getText().toString().trim().toUpperCase(Locale.US);
                String value = etValue.getText().toString();
                boolean useAccountSecret = cbUseAccountSecret.isChecked();

                if (!name.matches("^[A-Z_][A-Z0-9_]*$")) {
                    showInfoSnackbar("Secret name must be UPPER_SNAKE_CASE");
                    return;
                }
                if (!useAccountSecret && TextUtils.isEmpty(value)) {
                    showInfoSnackbar("Secret value is required");
                    return;
                }

                String encryptedValue = null;
                if (!useAccountSecret) {
                    try {
                        encryptedValue = SecretCryptoUtil.encryptForServer(value);
                    } catch (IllegalStateException e) {
                        showInfoSnackbar("Invalid CLIENT_SECRET_KEY configuration");
                        return;
                    }
                }

                UpsertProjectSecretEntry entry = new UpsertProjectSecretEntry(name, encryptedValue, useAccountSecret);
                apiService.upsertProjectSecrets(projectId, new UpsertProjectSecretsRequest(Collections.singletonList(entry)))
                        .enqueue(new Callback<SecretsWriteResponse>() {
                            @Override
                            public void onResponse(Call<SecretsWriteResponse> call, Response<SecretsWriteResponse> response) {
                                if (!response.isSuccessful()) {
                                    showInfoSnackbar("Failed to save project secret");
                                    return;
                                }
                                showSuccessSnackbar("Project secret saved");
                                loadProjectSecretsInto(tvSecrets);
                            }

                            @Override
                            public void onFailure(Call<SecretsWriteResponse> call, Throwable t) {
                                showInfoSnackbar("Could not reach backend");
                            }
                        });
            });

            delete.setOnClickListener(v -> {
                String name = etName.getText().toString().trim().toUpperCase(Locale.US);
                if (!name.matches("^[A-Z_][A-Z0-9_]*$")) {
                    showInfoSnackbar("Enter a valid secret name to delete");
                    return;
                }
                apiService.deleteProjectSecret(projectId, name).enqueue(new Callback<Void>() {
                    @Override
                    public void onResponse(Call<Void> call, Response<Void> response) {
                        if (!response.isSuccessful()) {
                            showInfoSnackbar("Failed to delete project secret");
                            return;
                        }
                        showSuccessSnackbar("Project secret deleted");
                        loadProjectSecretsInto(tvSecrets);
                    }

                    @Override
                    public void onFailure(Call<Void> call, Throwable t) {
                        showInfoSnackbar("Could not reach backend");
                    }
                });
            });

            refresh.setOnClickListener(v -> loadProjectSecretsInto(tvSecrets));
        });
        dialog.show();
    }

    private void loadProjectSecretsInto(TextView target) {
        apiService.getProjectSecrets(projectId).enqueue(new Callback<SecretsResponse>() {
            @Override
            public void onResponse(Call<SecretsResponse> call, Response<SecretsResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().getSecrets() == null) {
                    target.setText("Could not load secrets.");
                    return;
                }
                List<SecretSummary> secrets = response.body().getSecrets();
                List<RequiredSecretSummary> requiredSecrets = response.body().getRequiredSecrets();
                StringBuilder sb = new StringBuilder();

                if (requiredSecrets != null && !requiredSecrets.isEmpty()) {
                    sb.append("Required backend secrets:\n");
                    for (RequiredSecretSummary secret : requiredSecrets) {
                        boolean isSet = Boolean.TRUE.equals(secret.getIsSet());
                        String secretName = secret.getName();
                        if (!isSet && shouldSuppressMissingRequiredSecret(secretName)) {
                            continue;
                        }
                        sb.append(isSet ? "[set] " : "[missing] ");
                        sb.append(secretName);
                        if (isSet) {
                            sb.append(" (set");
                            if (Boolean.TRUE.equals(secret.getUseUserSecret())) {
                                sb.append(", uses account secret");
                            }
                            sb.append(")");
                        } else {
                            sb.append(" (missing)");
                        }
                        sb.append('\n');
                    }
                }

                if (!secrets.isEmpty()) {
                    if (sb.length() > 0) {
                        sb.append('\n');
                    }
                    sb.append("Current project secrets:\n");
                    for (SecretSummary secret : secrets) {
                        sb.append("• ").append(secret.getName());
                        if (Boolean.TRUE.equals(secret.getUseUserSecret())) {
                            sb.append(" (uses account secret)");
                        }
                        sb.append('\n');
                    }
                }

                target.setText(sb.length() > 0 ? sb.toString().trim() : "No project secrets.");
            }

            @Override
            public void onFailure(Call<SecretsResponse> call, Throwable t) {
                target.setText("Could not reach backend.");
            }
        });
    }

    private boolean shouldSuppressMissingRequiredSecret(String secretName) {
        if (secretName == null) {
            return false;
        }
        return SUPPRESSED_MISSING_REQUIRED_SECRETS.contains(secretName.trim().toUpperCase(Locale.US));
    }

    private int dp(int value) {
        return Math.round(getResources().getDisplayMetrics().density * value);
    }

    private void optUpdateVisible(LinearLayout optPreviewRestart, boolean isVisible) {
        if (optPreviewRestart != null) {
            optPreviewRestart.setVisibility(isVisible ? View.VISIBLE : View.GONE);
        }
    }

    private void triggerAction(String successMessage, Call<ActionResponse> call) {
        triggerAction(successMessage, call, null);
    }

    private void triggerPreviewAction(String successMessage, Call<ActionResponse> call) {
        previewRecoveryInProgress = true;
        startPreviewStatus(successMessage);
        call.enqueue(new Callback<ActionResponse>() {
            @Override
            public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                if (!response.isSuccessful()) {
                    previewRecoveryInProgress = false;
                    previewStarting = false;
                    appendPreviewStatusStep("Action failed (" + response.code() + ")");
                    if (tvPreviewStatusTitle != null) {
                        tvPreviewStatusTitle.setText("Preview failed");
                    }
                    setPreviewLoading(false, null);
                    return;
                }

                connectRealtimeForType(STREAM_PREVIEW, true);
                ActionResponse body = response.body();
                String previewUrl = body != null ? body.getUrl() : null;
                boolean alreadyRunning = body != null && Boolean.TRUE.equals(body.getAlreadyRunning());
                if (!TextUtils.isEmpty(previewUrl)) {
                    setCurrentPreviewUrl(previewUrl);
                    if (alreadyRunning) {
                        requirePreviewFreshness = false;
                        checkPreviewHealth(null, previewUrl, runningNow -> {
                            if (runningNow) {
                                showPreviewStatusReady(previewUrl);
                                return;
                            }
                            previewRecoveryInProgress = false;
                            previewStarting = true;
                            cancelPendingPreviewRefetch();
                            schedulePreviewRefetchAttempt(0, "Preview is still starting...");
                        });
                    }
                }
            }

            @Override
            public void onFailure(Call<ActionResponse> call, Throwable t) {
                previewRecoveryInProgress = false;
                previewStarting = false;
                appendPreviewStatusStep("Could not reach backend");
                if (tvPreviewStatusTitle != null) {
                    tvPreviewStatusTitle.setText("Preview failed");
                }
                setPreviewLoading(false, null);
            }
        });
    }

    private void triggerAction(String successMessage, Call<ActionResponse> call, Runnable onSuccess) {
        call.enqueue(new Callback<ActionResponse>() {
            @Override
            public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                if (response.isSuccessful()) {
                    if (onSuccess != null) {
                        onSuccess.run();
                    }
                    ActionResponse body = response.body();
                    if (body != null && body.getUrl() != null && !body.getUrl().trim().isEmpty()) {
                        showSuccessSnackbar(successMessage + "\n" + body.getUrl());
                    } else {
                        showSuccessSnackbar(successMessage);
                    }
                } else {
                    showInfoSnackbar("Action failed (" + response.code() + ")");
                }
            }

            @Override
            public void onFailure(Call<ActionResponse> call, Throwable t) {
                showInfoSnackbar("Could not reach backend");
            }
        });
    }

    private void showSuccessSnackbar(String message) {
        View contextView = findViewById(android.R.id.content);
        Snackbar snackbar = Snackbar.make(contextView, message, Snackbar.LENGTH_SHORT);
        snackbar.setBackgroundTint(Color.parseColor("#323232"));
        snackbar.setTextColor(Color.WHITE);
        snackbar.setAnimationMode(BaseTransientBottomBar.ANIMATION_MODE_SLIDE);
        snackbar.show();
    }

    private void showInfoSnackbar(String message) {
        View contextView = findViewById(android.R.id.content);
        Snackbar snackbar = Snackbar.make(contextView, message, Snackbar.LENGTH_SHORT);
        snackbar.setBackgroundTint(Color.parseColor("#323232"));
        snackbar.setTextColor(Color.WHITE);
        snackbar.setAnimationMode(BaseTransientBottomBar.ANIMATION_MODE_SLIDE);
        snackbar.show();
    }

    private void showDeleteConfirmationDialog() {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_confirm_delete);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        Button btnDelete = dialog.findViewById(R.id.btnConfirmDelete);
        Button btnCancel = dialog.findViewById(R.id.btnCancelDelete);

        btnDelete.setOnClickListener(v -> {
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("Project is not linked to backend");
                dialog.dismiss();
                return;
            }

            apiService.deleteProject(projectId).enqueue(new Callback<ActionResponse>() {
                @Override
                public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                    if (!response.isSuccessful()) {
                        showInfoSnackbar("Failed to delete project");
                        return;
                    }
                    if (currentProject != null) {
                        HomeActivity.userProjects.remove(currentProject);
                    }
                    Toast.makeText(ChatActivity.this, "Project deleted", Toast.LENGTH_SHORT).show();
                    dialog.dismiss();
                    finish();
                }

                @Override
                public void onFailure(Call<ActionResponse> call, Throwable t) {
                    showInfoSnackbar("Could not reach backend");
                }
            });
        });

        btnCancel.setOnClickListener(v -> dialog.dismiss());
        dialog.show();
    }

    private void showChatMode() {
        setToggleState(true);

        rvChat.setVisibility(View.VISIBLE);
        inputContainer.setVisibility(View.VISIBLE);
        previewContainer.setVisibility(View.GONE);
    }

    private void showViewMode() {
        setToggleState(false);

        rvChat.setVisibility(View.GONE);
        inputContainer.setVisibility(View.GONE);
        previewContainer.setVisibility(View.VISIBLE);

        if (previewStatusMode) {
            setPreviewStatusModeUI(true);
            setPreviewLoading(false, null);
            if (!TextUtils.isEmpty(projectId) && !previewRecoveryInProgress) {
                connectRealtimeForType(STREAM_PREVIEW);
            }
            return;
        }

        if (previewStarting && !TextUtils.isEmpty(currentPreviewUrl)) {
            setPreviewStatusModeUI(false);
            setPreviewLoading(true, "Checking preview runtime...");
            webPreview.stopLoading();
            webPreview.loadUrl("about:blank");
            renderedPreviewUrl = null;
            confirmPreviewReady(currentPreviewUrl);
            return;
        }

        if (TextUtils.isEmpty(projectId)) {
            if (!TextUtils.isEmpty(currentPreviewUrl)) {
                setPreviewStatusModeUI(false);
                setPreviewLoading(true, "Loading preview...");
                webPreview.loadUrl(currentPreviewUrl);
            } else {
                setPreviewLoading(false, null);
            }
            return;
        }

        setPreviewStatusModeUI(false);
        setPreviewLoading(true, "Checking preview...");
        hydratePreviewUrl();
    }

    private void setToggleState(boolean chatActive) {
        int activeBg = Color.WHITE;
        int inactiveBg = Color.parseColor("#00000000");
        int activeText = Color.parseColor("#1A1A1A");
        int inactiveText = Color.parseColor("#757575");

        btnChatToggle.setSelected(chatActive);
        btnViewToggle.setSelected(!chatActive);

        btnChatToggle.setBackgroundTintList(null);
        btnViewToggle.setBackgroundTintList(null);
        btnChatToggle.setBackgroundColor(chatActive ? activeBg : inactiveBg);
        btnViewToggle.setBackgroundColor(chatActive ? inactiveBg : activeBg);

        btnChatToggle.setTextColor(chatActive ? activeText : inactiveText);
        btnViewToggle.setTextColor(chatActive ? inactiveText : activeText);

        btnChatToggle.setAlpha(chatActive ? 1f : 0.75f);
        btnViewToggle.setAlpha(chatActive ? 0.75f : 1f);

        btnChatToggle.setStrokeWidth(0);
        btnViewToggle.setStrokeWidth(0);
        btnChatToggle.setChecked(false);
        btnViewToggle.setChecked(false);
    }

    private void loadPreviewUrl(String rawUrl) {
        loadPreviewUrl(rawUrl, false);
    }

    private void loadPreviewUrl(String rawUrl, boolean starting) {
        if (TextUtils.isEmpty(rawUrl)) return;
        String url = normalizeUrl(rawUrl);
        boolean sameRenderedUrl = url.equals(renderedPreviewUrl);
        if (!previewStatusMode && sameRenderedUrl && !starting && previewContainer.getVisibility() == View.VISIBLE) {
            setPreviewLoading(false, null);
            return;
        }
        currentPreviewUrl = url;
        previewStatusMode = false;
        previewStarting = starting;
        previewErrorShown = false;
        renderedPreviewUrl = url;
        tvPreviewHint.setText(url);
        setPreviewStatusModeUI(false);
        if (previewContainer.getVisibility() == View.VISIBLE) {
            setPreviewLoading(true, starting ? "Preview is starting..." : "Loading preview...");
            webPreview.loadUrl(url);
        }
    }

    private String normalizeUrl(String rawUrl) {
        return rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
                ? rawUrl
                : "https://" + rawUrl;
    }

    private void setCurrentPreviewUrl(String rawUrl) {
        if (TextUtils.isEmpty(rawUrl)) return;
        currentPreviewUrl = normalizeUrl(rawUrl);
    }

    private void startPreviewStatus(String title) {
        stopRealtimeForType(STREAM_PREVIEW);
        cancelPendingPreviewRefetch();
        previewValidationInFlight = false;
        activePreviewRequestStartedAtMs = System.currentTimeMillis();
        requirePreviewFreshness = true;
        previewStatusMode = true;
        previewStarting = true;
        previewMarkedRunning = false;
        previewErrorShown = false;
        renderedPreviewUrl = null;
        previewStatusSteps.setLength(0);
        previewStatusSeenLines.clear();
        lastPreviewStatusLine = "";
        setPreviewStatusModeUI(true);
        if (tvPreviewStatusTitle != null) {
            tvPreviewStatusTitle.setText("Starting preview");
        }
        if (tvPreviewStatusBody != null) {
            tvPreviewStatusBody.setText("");
        }
        if (tvPreviewStatusUrl != null) {
            tvPreviewStatusUrl.setVisibility(View.GONE);
            tvPreviewStatusUrl.setText("");
        }
        appendPreviewStatusStep(title);
        if (previewContainer.getVisibility() == View.VISIBLE) {
            webPreview.stopLoading();
            webPreview.loadUrl("about:blank");
        }
        setPreviewLoading(false, null);
    }

    private void appendPreviewStatusStep(String line) {
        if (TextUtils.isEmpty(line)) return;
        String trimmed = line.trim();
        if (trimmed.isEmpty() || trimmed.equals(lastPreviewStatusLine) || previewStatusSeenLines.contains(trimmed)) return;
        lastPreviewStatusLine = trimmed;
        previewStatusSeenLines.add(trimmed);
        if (previewStatusSteps.length() > 0) {
            previewStatusSteps.append('\n');
        }
        previewStatusSteps.append("• ").append(trimmed);
        if (tvPreviewStatusBody != null) {
            tvPreviewStatusBody.setText(previewStatusSteps.toString());
        }
    }

    private void showPreviewStatusReady(String rawUrl) {
        if (previewContainer != null && previewContainer.getVisibility() != View.VISIBLE) {
            // Keep users on the preview surface once the stream reaches ready/running.
            showViewMode();
        }
        cancelPendingPreviewRefetch();
        previewValidationInFlight = false;
        activePreviewRequestStartedAtMs = 0L;
        requirePreviewFreshness = true;
        previewStatusMode = false;
        previewStarting = false;
        previewRecoveryInProgress = false;
        previewMarkedRunning = true;
        previewErrorShown = false;
        String normalizedUrl = normalizeUrl(rawUrl);
        setPreviewStatusModeUI(false);
        currentPreviewUrl = normalizedUrl;
        loadPreviewUrl(normalizedUrl, false);
        stopRealtimeForType(STREAM_PREVIEW);
    }

    private void setPreviewStatusModeUI(boolean statusModeVisible) {
        if (previewStatusCard != null) {
            previewStatusCard.setVisibility(statusModeVisible ? View.VISIBLE : View.GONE);
        }
        if (mockPhone != null) {
            mockPhone.setVisibility(statusModeVisible ? View.GONE : View.VISIBLE);
        }
    }

    private void probeForSandboxErrorPage() {
        if (previewContainer.getVisibility() != View.VISIBLE) return;
        webPreview.evaluateJavascript(
                "(function(){var t=(document.title||'')+'\\n'+((document.body&&document.body.innerText)||'');return t.toLowerCase().slice(0,4000);})();",
                value -> {
                    if (value == null) return;
                    String lower = value.toLowerCase();
                    boolean closedPort = lower.contains(CLOSED_PORT_MSG) || lower.contains(CONNECTION_REFUSED_MSG);
                    if (lower.contains(SANDBOX_NOT_FOUND_MSG) || lower.contains("bad gateway") || closedPort) {
                        if (previewStarting || previewRecoveryInProgress) {
                            tvPreviewHint.setText("Preview is starting...");
                            setPreviewLoading(true, "Preview is starting...");
                            return;
                        }
                        String errorMessage = lower.contains(SANDBOX_NOT_FOUND_MSG)
                                ? "Preview sandbox is restarting..."
                                : closedPort
                                ? "Preview server is not listening yet"
                                : "Preview is still starting...";
                        if (pendingPreviewRefetch != null) {
                            setPreviewLoading(true, "Waiting for preview to post...");
                            return;
                        }
                        maybeRefetchPreviewAfterE2bError(errorMessage);
                    } else {
                        previewStarting = false;
                        previewRecoveryInProgress = false;
                        previewMarkedRunning = true;
                        cancelPendingPreviewRefetch();
                        setPreviewLoading(false, null);
                    }
                }
        );
    }

    private void markInvalidPreview(String message) {
        cancelPendingPreviewRefetch();
        previewValidationInFlight = false;
        if (previewErrorShown) return;
        previewErrorShown = true;
        previewStarting = false;
        previewRecoveryInProgress = false;
        previewMarkedRunning = false;
        currentPreviewUrl = null;
        renderedPreviewUrl = null;
        previewStatusMode = true;
        setPreviewStatusModeUI(true);
        if (tvPreviewStatusTitle != null) {
            tvPreviewStatusTitle.setText("Preparing preview");
        }
        appendPreviewStatusStep(message);
        setPreviewLoading(false, null);
        if (!TextUtils.isEmpty(projectId)) {
            connectRealtimeForType(STREAM_PREVIEW, true);
        }
    }

    private interface PreviewHealthListener {
        void onResult(boolean running);
    }

    private boolean isPreviewStale(String previewStartedAt) {
        long startedAtMs = parseIsoUtcMillis(previewStartedAt);
        if (startedAtMs <= 0L) return false;
        return System.currentTimeMillis() - startedAtMs >= PREVIEW_STALE_THRESHOLD_MS;
    }

    private long parseIsoUtcMillis(String isoText) {
        if (TextUtils.isEmpty(isoText)) return -1L;
        String[] patterns = {
                "yyyy-MM-dd'T'HH:mm:ss.SSSX",
                "yyyy-MM-dd'T'HH:mm:ssX",
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat parser = new SimpleDateFormat(pattern, Locale.US);
                parser.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date parsed = parser.parse(isoText);
                if (parsed != null) {
                    return parsed.getTime();
                }
            } catch (ParseException ignored) {
                // Try the next format.
            }
        }
        return -1L;
    }

    private boolean isProjectPreviewFreshForCurrentRequest(BackendProject project) {
        if (!requirePreviewFreshness) {
            return true;
        }
        if (activePreviewRequestStartedAtMs <= 0L || project == null) {
            return true;
        }
        long startedAtMs = parseIsoUtcMillis(project.getPreviewStartedAt());
        if (startedAtMs <= 0L) {
            return false;
        }
        return startedAtMs + PREVIEW_REQUEST_CLOCK_SKEW_MS >= activePreviewRequestStartedAtMs;
    }

    private void verifyRunningPreview(BackendProject project, String rawUrl) {
        checkPreviewHealth(project, rawUrl, running -> {
            if (running) {
                previewStarting = false;
                previewRecoveryInProgress = false;
                loadPreviewUrl(rawUrl, false);
                return;
            }
            triggerPreviewAction("Preview needs a restart", apiService.restartPreview(projectId));
        });
    }

    private void confirmPreviewReady(String fallbackUrl) {
        if (previewValidationInFlight) {
            return;
        }
        if (TextUtils.isEmpty(projectId)) {
            showPreviewStatusReady(fallbackUrl);
            return;
        }

        previewValidationInFlight = true;
        apiService.getProject(projectId).enqueue(new Callback<ProjectWrapperResponse>() {
            @Override
            public void onResponse(Call<ProjectWrapperResponse> call, Response<ProjectWrapperResponse> response) {
                previewValidationInFlight = false;
                if (!response.isSuccessful() || response.body() == null) {
                    schedulePreviewRefetchAttempt(0, "Preview is still starting...");
                    return;
                }
                BackendProject project = response.body().getProject();
                if (!isProjectPreviewFreshForCurrentRequest(project)) {
                    schedulePreviewRefetchAttempt(0, "Preview is still starting...");
                    return;
                }
                String backendUrl = project != null ? project.getPreviewUrl() : null;
                String candidateUrl = TextUtils.isEmpty(backendUrl) ? fallbackUrl : backendUrl;
                if (TextUtils.isEmpty(candidateUrl)) {
                    schedulePreviewRefetchAttempt(0, "Preview is still starting...");
                    return;
                }
                setCurrentPreviewUrl(candidateUrl);
                checkPreviewHealth(project, candidateUrl, running -> {
                    if (running) {
                        showPreviewStatusReady(candidateUrl);
                        return;
                    }
                    schedulePreviewRefetchAttempt(0, "Preview is still starting...");
                });
            }

            @Override
            public void onFailure(Call<ProjectWrapperResponse> call, Throwable t) {
                previewValidationInFlight = false;
                schedulePreviewRefetchAttempt(0, "Preview is still starting...");
            }
        });
    }

    private void maybeRefetchPreviewAfterE2bError(String finalErrorMessage) {
        if (TextUtils.isEmpty(projectId)) {
            setPreviewLoading(true, "Waiting for preview...");
            return;
        }
        if (previewStarting || previewRecoveryInProgress) {
            setPreviewLoading(true, "Waiting for preview...");
            return;
        }
        setPreviewLoading(true, "Waiting for preview to post...");
        schedulePreviewRefetchAttempt(0, finalErrorMessage);
    }

    private void schedulePreviewRefetchAttempt(int attempt, String finalErrorMessage) {
        if (attempt >= PREVIEW_POST_MAX_RETRIES) {
            markInvalidPreview("Preview is still starting. Tap Preview to retry.");
            return;
        }

        long delayMs = PREVIEW_POST_INITIAL_BACKOFF_MS << attempt;
        pendingPreviewRefetch = () -> {
            pendingPreviewRefetch = null;
            if (isFinishing() || isDestroyed()) {
                return;
            }
            apiService.getProject(projectId).enqueue(new Callback<ProjectWrapperResponse>() {
                @Override
                public void onResponse(Call<ProjectWrapperResponse> call, Response<ProjectWrapperResponse> response) {
                    if (!response.isSuccessful() || response.body() == null) {
                        schedulePreviewRefetchAttempt(attempt + 1, finalErrorMessage);
                        return;
                    }
                    BackendProject project = response.body().getProject();
                    if (!isProjectPreviewFreshForCurrentRequest(project)) {
                        schedulePreviewRefetchAttempt(attempt + 1, finalErrorMessage);
                        return;
                    }
                    String refreshedStatus = project != null ? project.getPreviewStatus() : null;
                    String refreshedUrl = project != null ? project.getPreviewUrl() : null;
                    if (!"RUNNING".equalsIgnoreCase(refreshedStatus) || TextUtils.isEmpty(refreshedUrl)) {
                        schedulePreviewRefetchAttempt(attempt + 1, finalErrorMessage);
                        return;
                    }
                    setCurrentPreviewUrl(refreshedUrl);
                    checkPreviewHealth(project, refreshedUrl, running -> {
                        if (running) {
                            previewStarting = false;
                            previewRecoveryInProgress = false;
                            previewMarkedRunning = true;
                            loadPreviewUrl(refreshedUrl, false);
                            return;
                        }
                        schedulePreviewRefetchAttempt(attempt + 1, finalErrorMessage);
                    });
                }

                @Override
                public void onFailure(Call<ProjectWrapperResponse> call, Throwable t) {
                    schedulePreviewRefetchAttempt(attempt + 1, finalErrorMessage);
                }
            });
        };
        previewRetryHandler.postDelayed(pendingPreviewRefetch, delayMs);
    }

    private void cancelPendingPreviewRefetch() {
        if (pendingPreviewRefetch != null) {
            previewRetryHandler.removeCallbacks(pendingPreviewRefetch);
            pendingPreviewRefetch = null;
        }
    }

    private void checkPreviewHealth(BackendProject project, String rawUrl, PreviewHealthListener listener) {
        String url = normalizeUrl(rawUrl);
        Request request = new Request.Builder().url(url).get().build();
        previewHealthClient.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call call, IOException e) {
                runOnUiThread(() -> listener.onResult(false));
            }

            @Override
            public void onResponse(okhttp3.Call call, okhttp3.Response response) {
                boolean running = false;
                boolean successful = response.isSuccessful();
                String expectedSandboxId = project != null ? project.getPreviewSandboxId() : null;
                String observedSandboxId = response.header(E2B_SANDBOX_HEADER);
                if (!TextUtils.isEmpty(observedSandboxId)) {
                    running = TextUtils.isEmpty(expectedSandboxId)
                            || expectedSandboxId.equalsIgnoreCase(observedSandboxId);
                }

                String pageContent = "";
                try (okhttp3.Response ignored = response) {
                    ResponseBody body = response.body();
                    if (body != null) {
                        pageContent = body.string();
                    }
                } catch (IOException e) {
                    runOnUiThread(() -> listener.onResult(false));
                    return;
                }
                String lowerContent = pageContent.toLowerCase(Locale.US);
                boolean knownError = lowerContent.contains(SANDBOX_NOT_FOUND_MSG)
                        || lowerContent.contains("bad gateway")
                        || lowerContent.contains(CLOSED_PORT_MSG)
                        || lowerContent.contains(CONNECTION_REFUSED_MSG);
                if (!running) {
                    running = successful && !knownError;
                }

                boolean finalRunning = running;
                runOnUiThread(() -> listener.onResult(finalRunning));
            }
        });
    }

    private void setPreviewLoading(boolean loading, String message) {
        if (previewLoadingOverlay == null) return;
        previewLoadingOverlay.setVisibility(loading ? View.VISIBLE : View.GONE);
        if (loading && tvPreviewLoading != null && !TextUtils.isEmpty(message)) {
            tvPreviewLoading.setText(message);
        }
    }

    private void hydratePreviewUrl() {
        apiService.getProject(projectId).enqueue(new Callback<ProjectWrapperResponse>() {
            @Override
            public void onResponse(Call<ProjectWrapperResponse> call, Response<ProjectWrapperResponse> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    setPreviewLoading(false, null);
                    return;
                }
                BackendProject project = response.body().getProject();
                String url = project != null ? project.getPreviewUrl() : null;
                String previewStatus = project != null ? project.getPreviewStatus() : null;
                boolean scheduled = "SCHEDULED".equalsIgnoreCase(previewStatus);
                boolean running = "RUNNING".equalsIgnoreCase(previewStatus);

                if (scheduled) {
                    previewStarting = true;
                    startPreviewStatus("Preview is queued");
                    if (!TextUtils.isEmpty(url)) {
                        setCurrentPreviewUrl(url);
                    }
                    connectRealtimeForType(STREAM_PREVIEW);
                    setPreviewLoading(false, null);
                    return;
                }

                if (running) {
                    if (TextUtils.isEmpty(url)) {
                        triggerPreviewAction("Preview needs a restart", apiService.restartPreview(projectId));
                        return;
                    }
                    setCurrentPreviewUrl(url);
                    if (isPreviewStale(project != null ? project.getPreviewStartedAt() : null)) {
                        triggerPreviewAction("Preview is stale. Restarting...", apiService.restartPreview(projectId));
                        return;
                    }
                    setPreviewLoading(true, "Checking preview runtime...");
                    verifyRunningPreview(project, url);
                    return;
                }

                if (!TextUtils.isEmpty(url)) {
                    loadPreviewUrl(url, false);
                } else {
                    tvPreviewHint.setText("Run preview to load your app");
                    setPreviewLoading(false, null);
                }
            }

            @Override
            public void onFailure(Call<ProjectWrapperResponse> call, Throwable t) {
                setPreviewLoading(false, null);
                // Non-fatal: realtime/manual actions can still populate preview later.
            }
        });
    }

    private void sendMessage(String text) {
        messageList.add(new ChatMessage(text, true));
        adapter.notifyItemInserted(messageList.size() - 1);
        rvChat.scrollToPosition(messageList.size() - 1);
        etMessage.setText("");

        if (TextUtils.isEmpty(projectId)) {
            showInfoSnackbar("Project is not linked to backend");
            return;
        }

        activeAgentMessageId = null;
        connectRealtimeForType(STREAM_CODE_AGENT);
        apiService.sendProjectMessage(projectId, new SendMessageRequest(text)).enqueue(new Callback<ActionResponse>() {
            @Override
            public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                if (!response.isSuccessful()) {
                    showInfoSnackbar("Message failed to send");
                    return;
                }
                loadMessages();
            }

            @Override
            public void onFailure(Call<ActionResponse> call, Throwable t) {
                showInfoSnackbar("Could not reach backend");
            }
        });
    }
}
