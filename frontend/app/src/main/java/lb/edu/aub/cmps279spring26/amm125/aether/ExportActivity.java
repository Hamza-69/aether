package lb.edu.aub.cmps279spring26.amm125.aether;

import android.graphics.Color;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.snackbar.BaseTransientBottomBar;
import com.google.android.material.snackbar.Snackbar;

import org.json.JSONObject;

import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.GenerateKeystoreRequest;
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

    private String projectId;
    private TextView tvDeployStatus;
    private TextView tvKeystoreStatus;
    private TextView tvApkStatus;
    private ProgressBar progressDeploy;
    private ProgressBar progressKeystore;
    private ProgressBar progressApk;
    private MaterialButton btnDeploy;
    private MaterialButton btnKeystore;
    private MaterialButton btnApk;

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

        tvDeployStatus = findViewById(R.id.tvDeployStatus);
        tvKeystoreStatus = findViewById(R.id.tvKeystoreStatus);
        tvApkStatus = findViewById(R.id.tvApkStatus);
        progressDeploy = findViewById(R.id.progressDeploy);
        progressKeystore = findViewById(R.id.progressKeystore);
        progressApk = findViewById(R.id.progressApk);
        btnDeploy = findViewById(R.id.btnDeployExport);
        btnKeystore = findViewById(R.id.btnGenerateKeystore);
        btnApk = findViewById(R.id.btnExportApk);

        if (TextUtils.isEmpty(projectId)) {
            showInfoSnackbar("Project is not linked to backend");
            setActionsEnabled(false);
            return;
        }

        btnDeploy.setOnClickListener(v ->
                triggerExportAction(
                        STREAM_DEPLOY,
                        apiService.deployProject(projectId),
                        btnDeploy,
                        progressDeploy,
                        tvDeployStatus,
                        "Deploy scheduled",
                        "Deploy failed"
                )
        );

        btnKeystore.setOnClickListener(v ->
                triggerExportAction(
                        STREAM_GENERATE_KEYSTORE,
                        apiService.generateKeystore(projectId, new GenerateKeystoreRequest(Collections.emptyMap())),
                        btnKeystore,
                        progressKeystore,
                        tvKeystoreStatus,
                        "Keystore generation started",
                        "Keystore generation failed"
                )
        );

        btnApk.setOnClickListener(v ->
                triggerExportAction(
                        STREAM_EXPORT_APK,
                        apiService.exportApk(projectId),
                        btnApk,
                        progressApk,
                        tvApkStatus,
                        "APK export started",
                        "APK export failed"
                )
        );
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        for (RealtimeClient client : realtimeClients.values()) {
            client.disconnect();
        }
        realtimeClients.clear();
    }

    private void triggerExportAction(
            String streamType,
            Call<ActionResponse> call,
            MaterialButton button,
            ProgressBar progress,
            TextView status,
            String successMessage,
            String failureMessage
    ) {
        setLoading(button, progress, status, true, "Working...");
        connectRealtimeForType(streamType, button, progress, status);
        call.enqueue(new Callback<ActionResponse>() {
            @Override
            public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                if (!response.isSuccessful()) {
                    if (response.code() == 409) {
                        status.setText("Already in progress. Listening for updates...");
                        showInfoSnackbar("Already in progress");
                        return;
                    }
                    stopRealtimeForType(streamType);
                    setLoading(button, progress, status, false, null);
                    status.setText(failureMessage + " (" + response.code() + ")");
                    showInfoSnackbar(failureMessage);
                    return;
                }

                ActionResponse body = response.body();
                if (body == null || !Boolean.TRUE.equals(body.getScheduled())) {
                    stopRealtimeForType(streamType);
                    setLoading(button, progress, status, false, null);
                    if (body != null && Boolean.TRUE.equals(body.getAlreadyExists())) {
                        status.setText("Already generated");
                        showSuccessSnackbar("Already generated");
                    } else if (body != null && !TextUtils.isEmpty(body.getMessage())) {
                        status.setText(body.getMessage());
                        showSuccessSnackbar(body.getMessage());
                    } else {
                        status.setText(successMessage);
                        showSuccessSnackbar(successMessage);
                    }
                    return;
                }

                String url = body != null ? body.getUrl() : null;
                if (!TextUtils.isEmpty(url)) {
                    status.setText(successMessage + "\n" + url);
                } else {
                    status.setText(successMessage);
                }
                showSuccessSnackbar(successMessage);
            }

            @Override
            public void onFailure(Call<ActionResponse> call, Throwable t) {
                stopRealtimeForType(streamType);
                setLoading(button, progress, status, false, null);
                status.setText("Could not reach backend");
                showInfoSnackbar("Could not reach backend");
            }
        });
    }

    private void connectRealtimeForType(
            String streamType,
            MaterialButton button,
            ProgressBar progress,
            TextView status
    ) {
        stopRealtimeForType(streamType);
        RealtimeClient client = new RealtimeClient(apiService, new RealtimeClient.Listener() {
            @Override
            public void onData(String type, JSONObject payload) {
                handleRealtimePayload(type, payload, button, progress, status);
            }

            @Override
            public void onStatus(String type, String realtimeStatus) {
                // Transient websocket failures reconnect in RealtimeClient; keep export progress focused on job events.
            }

            @Override
            public void onError(String type, String errorMessage) {
                // Token/socket errors are retried silently to avoid noisy progress updates.
            }
        });
        realtimeClients.put(streamType, client);
        client.connect(projectId, streamType);
    }

    private void handleRealtimePayload(
            String streamType,
            JSONObject payload,
            MaterialButton button,
            ProgressBar progress,
            TextView status
    ) {
        boolean done = payload.optBoolean("done", false);
        boolean error = payload.optBoolean("error", false);
        String message = extractRealtimeMessage(payload);
        if (!TextUtils.isEmpty(message)) {
            status.setText(message);
        }

        String url = extractRealtimeUrl(payload);
        if (!TextUtils.isEmpty(url)) {
            status.setText(TextUtils.isEmpty(message) ? url : message + "\n" + url);
        }

        if (error || done) {
            setLoading(button, progress, status, false, null);
            stopRealtimeForType(streamType);
            if (error) {
                showInfoSnackbar(formatStreamLabel(streamType) + " failed");
            } else {
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

    private void stopRealtimeForType(String streamType) {
        RealtimeClient existing = realtimeClients.remove(streamType);
        if (existing != null) {
            existing.disconnect();
        }
    }

    private String formatStreamLabel(String streamType) {
        return streamType.replace("-", " ").toUpperCase(Locale.US);
    }

    private void setLoading(MaterialButton button, ProgressBar progress, TextView status, boolean loading, String message) {
        button.setEnabled(!loading);
        progress.setVisibility(loading ? View.VISIBLE : View.GONE);
        if (loading && !TextUtils.isEmpty(message)) {
            status.setText(message);
        }
    }

    private void setActionsEnabled(boolean enabled) {
        btnDeploy.setEnabled(enabled);
        btnKeystore.setEnabled(enabled);
        btnApk.setEnabled(enabled);
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
