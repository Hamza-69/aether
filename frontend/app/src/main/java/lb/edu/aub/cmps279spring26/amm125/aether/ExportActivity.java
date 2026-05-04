package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.snackbar.BaseTransientBottomBar;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.google.gson.JsonElement;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ApkDownloadUrlResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ApksResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.BackendProject;
import lb.edu.aub.cmps279spring26.amm125.aether.model.DeploymentsResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.GenerateKeystoreRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.KeystoreSummaryResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectWrapperResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.RealtimeTokenRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.RealtimeTokenResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.realtime.RealtimeClient;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ExportActivity extends AppCompatActivity {
    private static final String STREAM_DEPLOY = "deploy";
    private static final String STREAM_GENERATE_KEYSTORE = "generate-keystore";
    private static final String STREAM_EXPORT_APK = "export-apk";

    private final ApiService apiService = ApiClient.getApiService();
    private final Map<String, RealtimeClient> realtimeClients = new HashMap<>();
    private final Map<String, StreamViews> streamViews = new HashMap<>();
    private final Map<String, StringBuilder> progressLogs = new HashMap<>();
    private final Map<String, Set<String>> progressSeenLines = new HashMap<>();

    private String projectId;
    private String latestApkId;
    private boolean hasDeploymentForApk = false;
    private boolean hasKeystoreForApk = false;
    private boolean keystoreLocked = false;

    private static class StreamViews {
        final MaterialButton actionButton;
        final ProgressBar progress;
        final TextView status;
        final MaterialButton toggleProgressButton;
        final TextView progressLog;

        StreamViews(
                MaterialButton actionButton,
                ProgressBar progress,
                TextView status,
                MaterialButton toggleProgressButton,
                TextView progressLog
        ) {
            this.actionButton = actionButton;
            this.progress = progress;
            this.status = status;
            this.toggleProgressButton = toggleProgressButton;
            this.progressLog = progressLog;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_export);

        projectId = getIntent().getStringExtra("PROJECT_ID");
        String projectTitle = getIntent().getStringExtra("PROJECT_TITLE");

        TextView tvTitle = findViewById(R.id.tvExportTitle);
        tvTitle.setText(TextUtils.isEmpty(projectTitle) ? "Export Project" : projectTitle);

        ImageView btnBack = findViewById(R.id.btnBackExport);
        btnBack.setOnClickListener(v -> finish());

        MaterialButton btnDeploy = findViewById(R.id.btnDeployExport);
        ProgressBar progressDeploy = findViewById(R.id.progressDeploy);
        TextView tvDeployStatus = findViewById(R.id.tvDeployStatus);
        MaterialButton btnToggleDeployProgress = findViewById(R.id.btnToggleDeployProgress);
        TextView tvDeployProgressLog = findViewById(R.id.tvDeployProgressLog);

        MaterialButton btnKeystore = findViewById(R.id.btnGenerateKeystore);
        ProgressBar progressKeystore = findViewById(R.id.progressKeystore);
        TextView tvKeystoreStatus = findViewById(R.id.tvKeystoreStatus);
        MaterialButton btnToggleKeystoreProgress = findViewById(R.id.btnToggleKeystoreProgress);
        TextView tvKeystoreProgressLog = findViewById(R.id.tvKeystoreProgressLog);

        MaterialButton btnApk = findViewById(R.id.btnExportApk);
        ProgressBar progressApk = findViewById(R.id.progressApk);
        TextView tvApkStatus = findViewById(R.id.tvApkStatus);
        MaterialButton btnInstallLatestApk = findViewById(R.id.btnInstallLatestApk);
        MaterialButton btnToggleApkProgress = findViewById(R.id.btnToggleApkProgress);
        TextView tvApkProgressLog = findViewById(R.id.tvApkProgressLog);

        streamViews.put(STREAM_DEPLOY, new StreamViews(btnDeploy, progressDeploy, tvDeployStatus, btnToggleDeployProgress, tvDeployProgressLog));
        streamViews.put(STREAM_GENERATE_KEYSTORE, new StreamViews(btnKeystore, progressKeystore, tvKeystoreStatus, btnToggleKeystoreProgress, tvKeystoreProgressLog));
        streamViews.put(STREAM_EXPORT_APK, new StreamViews(btnApk, progressApk, tvApkStatus, btnToggleApkProgress, tvApkProgressLog));

        setupProgressToggle(STREAM_DEPLOY);
        setupProgressToggle(STREAM_GENERATE_KEYSTORE);
        setupProgressToggle(STREAM_EXPORT_APK);

        if (TextUtils.isEmpty(projectId)) {
            showInfoSnackbar("Project is not linked to backend");
            setActionsEnabled(false);
            return;
        }

        btnDeploy.setOnClickListener(v ->
                triggerExportAction(
                        STREAM_DEPLOY,
                        apiService.deployProject(projectId),
                        "Deploy scheduled",
                        "Deploy failed"
                )
        );

        btnKeystore.setOnClickListener(v -> showKeystorePromptDialog());

        btnApk.setOnClickListener(v ->
                triggerExportAction(
                        STREAM_EXPORT_APK,
                        apiService.exportApk(projectId),
                        "APK export started",
                        "APK export failed"
                )
        );
        btnInstallLatestApk.setOnClickListener(v -> openLatestApkInstallLink());

        setActionButtonEnabled(btnDeploy, true);
        setActionButtonEnabled(btnKeystore, true);
        updateExportApkAvailabilityUi();
        hydrateProgressFromStreamChunks(STREAM_DEPLOY);
        hydrateProgressFromStreamChunks(STREAM_GENERATE_KEYSTORE);
        hydrateProgressFromStreamChunks(STREAM_EXPORT_APK);
        hydrateRunningStreamsState();
        refreshApkPrerequisites();
        refreshLatestApkAvailability();
        hydrateKeystoreState();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        for (RealtimeClient client : realtimeClients.values()) {
            client.disconnect();
        }
        realtimeClients.clear();
    }

    private void setupProgressToggle(String streamType) {
        StreamViews views = streamViews.get(streamType);
        if (views == null) return;
        views.toggleProgressButton.setOnClickListener(v -> {
            boolean show = views.progressLog.getVisibility() != View.VISIBLE;
            views.progressLog.setVisibility(show ? View.VISIBLE : View.GONE);
            views.toggleProgressButton.setText(show ? "Hide progress" : "Show progress");
        });
    }

    private void triggerExportAction(
            String streamType,
            Call<ActionResponse> call,
            String successMessage,
            String failureMessage
    ) {
        StreamViews views = streamViews.get(streamType);
        if (views == null) return;

        setLoading(streamType, true, "Working...");
        connectRealtimeForType(streamType);

        call.enqueue(new Callback<ActionResponse>() {
            @Override
            public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                if (!response.isSuccessful()) {
                    if (response.code() == 409) {
                        views.status.setText("Already in progress. Listening for updates...");
                        showInfoSnackbar("Already in progress");
                        return;
                    }
                    stopRealtimeForType(streamType);
                    setLoading(streamType, false, null);
                    String backendError = extractBackendErrorMessage(response);
                    String line = buildFailureLine(streamType, failureMessage, response.code(), backendError);
                    views.status.setText(line);
                    appendProgress(streamType, line);
                    showInfoSnackbar(line);
                    return;
                }

                ActionResponse body = response.body();
                if (body == null || !Boolean.TRUE.equals(body.getScheduled())) {
                    stopRealtimeForType(streamType);
                    setLoading(streamType, false, null);
                    if (body != null && Boolean.TRUE.equals(body.getAlreadyExists())) {
                        views.status.setText("Already generated");
                        appendProgress(streamType, "Keystore already exists and cannot be regenerated.");
                        if (STREAM_GENERATE_KEYSTORE.equals(streamType)) {
                            lockKeystoreGenerationUi();
                        }
                        showSuccessSnackbar("Already generated");
                    } else if (body != null && !TextUtils.isEmpty(body.getMessage())) {
                        views.status.setText(body.getMessage());
                        appendProgress(streamType, body.getMessage());
                        showSuccessSnackbar(body.getMessage());
                    } else {
                        views.status.setText(successMessage);
                        appendProgress(streamType, successMessage);
                        showSuccessSnackbar(successMessage);
                    }
                    return;
                }

                String url = body.getUrl();
                if (!TextUtils.isEmpty(url)) {
                    views.status.setText(successMessage + "\n" + url);
                    appendProgress(streamType, "URL: " + url);
                } else {
                    views.status.setText(successMessage);
                }
                showSuccessSnackbar(successMessage);
            }

            @Override
            public void onFailure(Call<ActionResponse> call, Throwable t) {
                stopRealtimeForType(streamType);
                setLoading(streamType, false, null);
                StreamViews localViews = streamViews.get(streamType);
                if (localViews != null) {
                    localViews.status.setText("Could not reach backend");
                }
                appendProgress(streamType, "Could not reach backend");
                showInfoSnackbar("Could not reach backend");
            }
        });
    }

    private void connectRealtimeForType(String streamType) {
        StreamViews views = streamViews.get(streamType);
        if (views == null) return;
        stopRealtimeForType(streamType);
        RealtimeClient client = new RealtimeClient(apiService, new RealtimeClient.Listener() {
            @Override
            public void onData(String type, JSONObject payload) {
                applyStreamPayload(type, payload, false);
            }

            @Override
            public void onStatus(String type, String realtimeStatus) {
                // RealtimeClient already handles reconnects; keep progress focused on stream chunks.
            }

            @Override
            public void onError(String type, String errorMessage) {
                // Avoid adding client-generated noise into chunk history.
            }
        });
        realtimeClients.put(streamType, client);
        client.connect(projectId, streamType);
    }

    private void applyStreamPayload(String streamType, JSONObject payload, boolean historicalHydration) {
        StreamViews views = streamViews.get(streamType);
        if (views == null) return;

        boolean done = payload.optBoolean("done", false);
        boolean error = payload.optBoolean("error", false);
        String message = extractRealtimeMessage(payload);
        String url = extractRealtimeUrl(payload);

        if (TextUtils.isEmpty(message)) {
            String content = payload.optString("content", "");
            if (!TextUtils.isEmpty(content) && !"null".equalsIgnoreCase(content)) {
                message = content;
            } else {
                String status = payload.optString("status", "");
                if (!TextUtils.isEmpty(status) && !"null".equalsIgnoreCase(status)) {
                    message = "Status: " + status;
                }
            }
        }

        if (!TextUtils.isEmpty(message)) {
            views.status.setText(message);
            appendProgress(streamType, message);
        }

        if (!TextUtils.isEmpty(url)) {
            boolean messageAlreadyHasUrl = !TextUtils.isEmpty(message) && message.contains(url);
            if (!TextUtils.isEmpty(message) && !messageAlreadyHasUrl) {
                views.status.setText(message + "\n" + url);
            } else if (TextUtils.isEmpty(message)) {
                views.status.setText(url);
            }
            if (!messageAlreadyHasUrl) {
                appendProgress(streamType, "URL: " + url);
            }
        }

        if (error || done) {
            if (historicalHydration) {
                if (done && STREAM_GENERATE_KEYSTORE.equals(streamType)) {
                    lockKeystoreGenerationUi();
                }
                return;
            }
            setLoading(streamType, false, null);
            stopRealtimeForType(streamType);
            if (error) {
                appendProgress(streamType, "Failed.");
                showInfoSnackbar(formatStreamLabel(streamType) + " failed");
            } else {
                appendProgress(streamType, "Completed.");
                if (STREAM_GENERATE_KEYSTORE.equals(streamType)) {
                    lockKeystoreGenerationUi();
                    refreshApkPrerequisites();
                }
                if (STREAM_DEPLOY.equals(streamType)) {
                    refreshApkPrerequisites();
                }
                if (STREAM_EXPORT_APK.equals(streamType)) {
                    refreshLatestApkAvailability();
                }
                showSuccessSnackbar(formatStreamLabel(streamType) + " finished");
            }
        }
    }

    private String extractRealtimeMessage(JSONObject payload) {
        Object raw = payload.opt("message");
        if (raw instanceof JSONObject) {
            return ((JSONObject) raw).optString("content", "");
        }
        String message = payload.optString("message", "");
        return "null".equalsIgnoreCase(message) ? "" : message;
    }

    private String extractRealtimeUrl(JSONObject payload) {
        String topLevelUrl = payload.optString("url", "");
        if (!TextUtils.isEmpty(topLevelUrl)) return topLevelUrl;

        JSONObject deployment = payload.optJSONObject("deployment");
        if (deployment != null) {
            String url = deployment.optString("url", "");
            if (!TextUtils.isEmpty(url)) return url;
        }

        JSONObject apk = payload.optJSONObject("apk");
        if (apk != null) {
            String url = apk.optString("url", "");
            if (!TextUtils.isEmpty(url)) return url;
        }

        JSONObject message = payload.optJSONObject("message");
        if (message != null) {
            String content = message.optString("content", "");
            if (!TextUtils.isEmpty(content)) return content;
        }

        return "";
    }

    private void appendProgress(String streamType, String line) {
        if (TextUtils.isEmpty(line)) return;
        String trimmed = line.trim();
        if (trimmed.isEmpty()) return;

        StreamViews views = streamViews.get(streamType);
        if (views == null) return;

        Set<String> seen = progressSeenLines.computeIfAbsent(streamType, ignored -> new HashSet<>());
        if (seen.contains(trimmed)) {
            return;
        }
        seen.add(trimmed);

        StringBuilder builder = progressLogs.computeIfAbsent(streamType, ignored -> new StringBuilder());
        if (builder.length() > 0) builder.append('\n');
        builder.append("• ").append(trimmed);
        views.progressLog.setText(builder.toString());
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

    private void setLoading(String streamType, boolean loading, String message) {
        StreamViews views = streamViews.get(streamType);
        if (views == null) return;
        boolean disableAction = loading || (STREAM_GENERATE_KEYSTORE.equals(streamType) && keystoreLocked);
        if (STREAM_EXPORT_APK.equals(streamType)) {
            setActionButtonEnabled(views.actionButton, !loading && hasDeploymentForApk && hasKeystoreForApk);
        } else {
            setActionButtonEnabled(views.actionButton, !disableAction);
        }
        views.progress.setVisibility(loading ? View.VISIBLE : View.GONE);
        if (loading && !TextUtils.isEmpty(message)) {
            views.status.setText(message);
        }
    }

    private void setActionsEnabled(boolean enabled) {
        StreamViews deploy = streamViews.get(STREAM_DEPLOY);
        StreamViews keystore = streamViews.get(STREAM_GENERATE_KEYSTORE);
        StreamViews apk = streamViews.get(STREAM_EXPORT_APK);
        if (deploy != null) setActionButtonEnabled(deploy.actionButton, enabled);
        if (keystore != null) setActionButtonEnabled(keystore.actionButton, enabled && !keystoreLocked);
        if (apk != null) setActionButtonEnabled(apk.actionButton, enabled && hasDeploymentForApk && hasKeystoreForApk);
    }

    private void lockKeystoreGenerationUi() {
        keystoreLocked = true;
        hasKeystoreForApk = true;
        StreamViews keystore = streamViews.get(STREAM_GENERATE_KEYSTORE);
        if (keystore == null) return;
        setActionButtonEnabled(keystore.actionButton, false);
        keystore.actionButton.setText("Keystore Generated");
        keystore.status.setText("Keystore already generated. Regeneration is blocked.");
        updateExportApkAvailabilityUi();
    }

    private void setActionButtonEnabled(MaterialButton button, boolean enabled) {
        if (button == null) return;
        button.setEnabled(enabled);
        applyPrimaryActionStyle(button, enabled);
    }

    private void applyPrimaryActionStyle(MaterialButton button, boolean enabled) {
        if (button == null) return;
        if (enabled) {
            button.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#7A4DF3")));
            button.setTextColor(Color.WHITE);
            button.setStrokeWidth(0);
            return;
        }
        button.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#E5E7EB")));
        button.setTextColor(Color.parseColor("#374151"));
        button.setStrokeColor(ColorStateList.valueOf(Color.parseColor("#D1D5DB")));
        button.setStrokeWidth((int) (1 * getResources().getDisplayMetrics().density));
    }

    private void hydrateProgressFromStreamChunks(String streamType) {
        apiService.createRealtimeToken(new RealtimeTokenRequest(projectId, streamType))
                .enqueue(new Callback<RealtimeTokenResponse>() {
                    @Override
                    public void onResponse(Call<RealtimeTokenResponse> call, Response<RealtimeTokenResponse> response) {
                        if (!response.isSuccessful() || response.body() == null) return;
                        List<JsonElement> chunks = response.body().getStreamChunks();
                        if (chunks == null) return;
                        for (JsonElement chunk : chunks) {
                            JSONObject payload = toBusinessPayload(chunk);
                            if (payload != null && payload.length() > 0) {
                                applyStreamPayload(streamType, payload, true);
                            }
                        }
                    }

                    @Override
                    public void onFailure(Call<RealtimeTokenResponse> call, Throwable t) {
                        // Best-effort hydration only.
                    }
                });
    }

    private void hydrateRunningStreamsState() {
        apiService.getProject(projectId).enqueue(new Callback<ProjectWrapperResponse>() {
            @Override
            public void onResponse(Call<ProjectWrapperResponse> call, Response<ProjectWrapperResponse> response) {
                if (!response.isSuccessful() || response.body() == null) return;
                BackendProject project = response.body().getProject();
                if (project == null) return;
                resumeStreamIfRunning(STREAM_DEPLOY, project.getDeploymentStatus());
                resumeStreamIfRunning(STREAM_EXPORT_APK, project.getApkStatus());
            }

            @Override
            public void onFailure(Call<ProjectWrapperResponse> call, Throwable t) {
                // Keep page usable even when state hydration fails.
            }
        });
    }

    private void resumeStreamIfRunning(String streamType, String status) {
        if (!"SCHEDULED".equalsIgnoreCase(status) && !"RUNNING".equalsIgnoreCase(status)) {
            return;
        }
        setLoading(streamType, true, "Resuming progress...");
        connectRealtimeForType(streamType);
    }

    private JSONObject toBusinessPayload(JsonElement chunk) {
        if (chunk == null || chunk.isJsonNull()) return null;
        try {
            if (chunk.isJsonPrimitive()) {
                String primitive = chunk.getAsString().trim();
                if (primitive.startsWith("{")) {
                    return unwrapEnvelope(new JSONObject(primitive));
                }
                JSONObject wrapped = new JSONObject();
                wrapped.put("message", primitive);
                return wrapped;
            }
            JSONObject payload = new JSONObject(chunk.toString());
            return unwrapEnvelope(payload);
        } catch (JSONException ignored) {
            return null;
        }
    }

    private JSONObject unwrapEnvelope(JSONObject payload) throws JSONException {
        JSONObject current = payload;
        for (int i = 0; i < 4; i++) {
            if (looksLikeBusinessPayload(current)) return current;
            Object nested = current.has("data") ? current.opt("data") : current.opt("payload");
            if (nested instanceof JSONObject) {
                current = (JSONObject) nested;
            } else if (nested instanceof String) {
                String text = ((String) nested).trim();
                if (text.startsWith("{")) {
                    current = new JSONObject(text);
                } else {
                    JSONObject wrapped = new JSONObject();
                    wrapped.put("message", text);
                    return wrapped;
                }
            } else {
                break;
            }
        }
        return current;
    }

    private boolean looksLikeBusinessPayload(JSONObject value) {
        return value.has("message")
                || value.has("done")
                || value.has("error")
                || value.has("url")
                || value.has("deployment")
                || value.has("apk")
                || value.has("status");
    }

    private void hydrateKeystoreState() {
        apiService.getKeystoreSummary(projectId).enqueue(new Callback<KeystoreSummaryResponse>() {
            @Override
            public void onResponse(Call<KeystoreSummaryResponse> call, Response<KeystoreSummaryResponse> response) {
                if (!response.isSuccessful() || response.body() == null) return;

                KeystoreSummaryResponse body = response.body();
                String status = body.getStatus();
                hasKeystoreForApk = body.isExists();
                updateExportApkAvailabilityUi();
                if (body.isExists()) {
                    lockKeystoreGenerationUi();
                    return;
                }

                if ("SCHEDULED".equalsIgnoreCase(status) || "RUNNING".equalsIgnoreCase(status)) {
                    setLoading(STREAM_GENERATE_KEYSTORE, true, "Resuming progress...");
                    connectRealtimeForType(STREAM_GENERATE_KEYSTORE);
                }
            }

            @Override
            public void onFailure(Call<KeystoreSummaryResponse> call, Throwable t) {
                // Ignore and keep UI usable.
            }
        });
    }

    private void refreshApkPrerequisites() {
        apiService.getProjectDeployments(projectId).enqueue(new Callback<DeploymentsResponse>() {
            @Override
            public void onResponse(Call<DeploymentsResponse> call, Response<DeploymentsResponse> response) {
                hasDeploymentForApk =
                        response.isSuccessful()
                                && response.body() != null
                                && response.body().getDeployments() != null
                                && !response.body().getDeployments().isEmpty();
                updateExportApkAvailabilityUi();
            }

            @Override
            public void onFailure(Call<DeploymentsResponse> call, Throwable t) {
                hasDeploymentForApk = false;
                updateExportApkAvailabilityUi();
            }
        });
    }

    private void updateExportApkAvailabilityUi() {
        StreamViews apk = streamViews.get(STREAM_EXPORT_APK);
        if (apk == null) return;
        boolean enabled = hasDeploymentForApk && hasKeystoreForApk && apk.progress.getVisibility() != View.VISIBLE;
        setActionButtonEnabled(apk.actionButton, enabled);
        if (!enabled && apk.progress.getVisibility() != View.VISIBLE) {
            if (!hasDeploymentForApk && !hasKeystoreForApk) {
                apk.status.setText("Requires deployment and keystore");
            } else if (!hasDeploymentForApk) {
                apk.status.setText("Requires deployment");
            } else if (!hasKeystoreForApk) {
                apk.status.setText("Requires keystore");
            }
        }
    }

    private void refreshLatestApkAvailability() {
        apiService.getProjectApks(projectId).enqueue(new Callback<ApksResponse>() {
            @Override
            public void onResponse(Call<ApksResponse> call, Response<ApksResponse> response) {
                if (!response.isSuccessful() || response.body() == null || response.body().getApks() == null || response.body().getApks().isEmpty()) {
                    latestApkId = null;
                    setInstallLatestApkVisible(false);
                    return;
                }
                latestApkId = response.body().getApks().get(0).getId();
                setInstallLatestApkVisible(!TextUtils.isEmpty(latestApkId));
            }

            @Override
            public void onFailure(Call<ApksResponse> call, Throwable t) {
                latestApkId = null;
                setInstallLatestApkVisible(false);
            }
        });
    }

    private void setInstallLatestApkVisible(boolean visible) {
        View button = findViewById(R.id.btnInstallLatestApk);
        if (button != null) {
            button.setVisibility(visible ? View.VISIBLE : View.GONE);
        }
    }

    private void openLatestApkInstallLink() {
        if (TextUtils.isEmpty(latestApkId)) {
            showInfoSnackbar("No downloadable APK yet");
            return;
        }

        apiService.getApkDownloadUrl(projectId, latestApkId).enqueue(new Callback<ApkDownloadUrlResponse>() {
            @Override
            public void onResponse(Call<ApkDownloadUrlResponse> call, Response<ApkDownloadUrlResponse> response) {
                if (!response.isSuccessful() || response.body() == null || TextUtils.isEmpty(response.body().getUrl())) {
                    showInfoSnackbar("Could not get APK download link");
                    return;
                }

                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(response.body().getUrl()));
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                try {
                    startActivity(intent);
                } catch (Exception e) {
                    showInfoSnackbar("No app found to open APK link");
                }
            }

            @Override
            public void onFailure(Call<ApkDownloadUrlResponse> call, Throwable t) {
                showInfoSnackbar("Could not reach backend");
            }
        });
    }

    private void showKeystorePromptDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_keystore_subject, null, false);

        TextInputLayout inputCommonName = dialogView.findViewById(R.id.inputCommonName);
        TextInputLayout inputOrganizationalUnit = dialogView.findViewById(R.id.inputOrganizationalUnit);
        TextInputLayout inputOrganization = dialogView.findViewById(R.id.inputOrganization);
        TextInputLayout inputLocality = dialogView.findViewById(R.id.inputLocality);
        TextInputLayout inputState = dialogView.findViewById(R.id.inputState);
        TextInputLayout inputCountryCode = dialogView.findViewById(R.id.inputCountryCode);

        TextInputEditText etCommonName = dialogView.findViewById(R.id.etCommonName);
        TextInputEditText etOrganizationalUnit = dialogView.findViewById(R.id.etOrganizationalUnit);
        TextInputEditText etOrganization = dialogView.findViewById(R.id.etOrganization);
        TextInputEditText etLocality = dialogView.findViewById(R.id.etLocality);
        TextInputEditText etState = dialogView.findViewById(R.id.etState);
        TextInputEditText etCountryCode = dialogView.findViewById(R.id.etCountryCode);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Generate Keystore")
                .setMessage("All fields are required.")
                .setView(dialogView)
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Generate", null)
                .create();

        dialog.setOnShowListener(d -> {
            android.widget.Button positive = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            positive.setOnClickListener(v -> {
                String commonName = requiredField(inputCommonName, etCommonName, "Common Name");
                String organizationalUnit = requiredField(inputOrganizationalUnit, etOrganizationalUnit, "Organizational Unit");
                String organization = requiredField(inputOrganization, etOrganization, "Organization");
                String locality = requiredField(inputLocality, etLocality, "Locality");
                String state = requiredField(inputState, etState, "State");
                String countryCode = requiredField(inputCountryCode, etCountryCode, "Country Code");

                if (commonName == null || organizationalUnit == null || organization == null
                        || locality == null || state == null || countryCode == null) {
                    return;
                }

                String normalizedCountry = countryCode.toUpperCase(Locale.US);
                if (!normalizedCountry.matches("^[A-Z]{2}$")) {
                    inputCountryCode.setError("Country Code must be exactly 2 letters");
                    return;
                }
                inputCountryCode.setError(null);

                Map<String, String> subject = new LinkedHashMap<>();
                subject.put("commonName", commonName);
                subject.put("organizationalUnit", organizationalUnit);
                subject.put("organization", organization);
                subject.put("locality", locality);
                subject.put("state", state);
                subject.put("countryCode", normalizedCountry);

                dialog.dismiss();
                triggerExportAction(
                        STREAM_GENERATE_KEYSTORE,
                        apiService.generateKeystore(projectId, new GenerateKeystoreRequest(subject)),
                        "Keystore generation started",
                        "Keystore generation failed"
                );
            });
        });

        dialog.show();
    }

    private String buildFailureLine(String streamType, String baseMessage, int code, String backendError) {
        String line = baseMessage + " (" + code + ")";
        if (code == 400 && STREAM_DEPLOY.equals(streamType)) {
            return line + "\nMissing env var: FLY_API_TOKEN";
        }
        if (code == 400 && STREAM_EXPORT_APK.equals(streamType)) {
            return line + "\nMissing env var: EXPO_TOKEN";
        }
        return TextUtils.isEmpty(backendError) ? line : line + "\n" + backendError;
    }

    private String extractBackendErrorMessage(Response<?> response) {
        if (response.errorBody() == null) return "";
        try {
            String raw = response.errorBody().string();
            if (TextUtils.isEmpty(raw)) return "";
            JSONObject json = new JSONObject(raw);
            String message = json.optString("error", "");
            if (TextUtils.isEmpty(message)) {
                message = json.optString("message", "");
            }
            return message.trim();
        } catch (IOException | JSONException ignored) {
            return "";
        }
    }

    private String requiredField(TextInputLayout inputLayout, EditText editText, String label) {
        String value = editText.getText() == null ? "" : editText.getText().toString().trim();
        if (value.isEmpty()) {
            inputLayout.setError(label + " is required");
            return null;
        }
        inputLayout.setError(null);
        return value;
    }

    private void showSuccessSnackbar(String message) {
        Snackbar snackbar = Snackbar.make(findViewById(android.R.id.content), message, Snackbar.LENGTH_SHORT);
        snackbar.setBackgroundTint(Color.parseColor("#323232"));
        snackbar.setTextColor(Color.WHITE);
        snackbar.setAnimationMode(BaseTransientBottomBar.ANIMATION_MODE_SLIDE);
        snackbar.show();
    }

    private void showInfoSnackbar(String message) {
        Snackbar snackbar = Snackbar.make(findViewById(android.R.id.content), message, Snackbar.LENGTH_SHORT);
        snackbar.setBackgroundTint(Color.parseColor("#323232"));
        snackbar.setTextColor(Color.WHITE);
        snackbar.setAnimationMode(BaseTransientBottomBar.ANIMATION_MODE_SLIDE);
        snackbar.show();
    }
}
