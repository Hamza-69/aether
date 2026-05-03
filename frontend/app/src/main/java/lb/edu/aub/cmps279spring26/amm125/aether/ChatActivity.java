package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.AlertDialog;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
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

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.snackbar.BaseTransientBottomBar;
import com.google.android.material.snackbar.Snackbar;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.GenerateKeystoreRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.MessagesResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectMessage;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretSummary;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsWriteResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SendMessageRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertProjectSecretEntry;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertProjectSecretsRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.realtime.RealtimeClient;
import lb.edu.aub.cmps279spring26.amm125.aether.utils.SecretCryptoUtil;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChatActivity extends AppCompatActivity {
    private static final String STREAM_CODE_AGENT = "code-agent";
    private static final String STREAM_DEPLOY = "deploy";
    private static final String STREAM_EXPORT_APK = "export-apk";
    private static final String STREAM_GENERATE_KEYSTORE = "generate-keystore";
    private static final String STREAM_PREVIEW = "preview";

    private RecyclerView rvChat;
    private ChatAdapter adapter;
    private List<ChatMessage> messageList;
    private EditText etMessage;
    private MaterialCardView btnSend;
    private View inputContainer;
    private View previewContainer;
    private MaterialButton btnChatToggle, btnViewToggle;
    private String projectTitle;
    private String projectDesc;
    private String projectStatus;
    private String projectId;
    private Project currentProject;
    private int projectIndex = -1;
    private final ApiService apiService = ApiClient.getApiService();
    private final Map<String, RealtimeClient> realtimeClients = new HashMap<>();

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
        btnChatToggle = findViewById(R.id.btnChatToggle);
        btnViewToggle = findViewById(R.id.btnViewToggle);

        messageList = new ArrayList<>();
        adapter = new ChatAdapter(messageList);
        rvChat.setLayoutManager(new LinearLayoutManager(this));
        rvChat.setAdapter(adapter);

        btnChatToggle.setOnClickListener(v -> showChatMode());
        btnViewToggle.setOnClickListener(v -> showViewMode());

        btnSend.setOnClickListener(v -> {
            String text = etMessage.getText().toString().trim();
            if (!TextUtils.isEmpty(text)) {
                sendMessage(text);
            }
        });

        if (!TextUtils.isEmpty(projectId)) {
            loadMessages();
            startRealtimeStreams();
        } else if (!TextUtils.isEmpty(projectDesc)) {
            messageList.add(new ChatMessage(projectDesc, true));
            adapter.notifyItemInserted(messageList.size() - 1);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        for (RealtimeClient client : realtimeClients.values()) {
            client.disconnect();
        }
        realtimeClients.clear();
    }

    private void startRealtimeStreams() {
        connectRealtimeForType(STREAM_CODE_AGENT);
        connectRealtimeForType(STREAM_DEPLOY);
        connectRealtimeForType(STREAM_EXPORT_APK);
        connectRealtimeForType(STREAM_GENERATE_KEYSTORE);
        connectRealtimeForType(STREAM_PREVIEW);
    }

    private void connectRealtimeForType(String streamType) {
        if (TextUtils.isEmpty(projectId) || realtimeClients.containsKey(streamType)) {
            return;
        }
        RealtimeClient client = new RealtimeClient(apiService, new RealtimeClient.Listener() {
            @Override
            public void onData(String type, JSONObject payload) {
                handleRealtimePayload(type, payload);
            }

            @Override
            public void onStatus(String type, String status) {
                if ("failed".equalsIgnoreCase(status)) {
                    showInfoSnackbar("Realtime disconnected for " + formatStreamLabel(type));
                }
            }

            @Override
            public void onError(String type, String errorMessage) {
                showInfoSnackbar(formatStreamLabel(type) + ": " + errorMessage);
            }
        });
        realtimeClients.put(streamType, client);
        client.connect(projectId, streamType);
    }

    private void handleRealtimePayload(String streamType, JSONObject payload) {
        String message = payload.optString("message", "");
        boolean done = payload.optBoolean("done", false);
        boolean error = payload.optBoolean("error", false);

        if (!TextUtils.isEmpty(message)) {
            appendSystemMessage("[" + formatStreamLabel(streamType) + "] " + message);
        }
        if (error) {
            showInfoSnackbar(formatStreamLabel(streamType) + " failed");
        }

        if (STREAM_PREVIEW.equals(streamType)) {
            JSONObject preview = payload.optJSONObject("preview");
            if (preview != null) {
                String previewUrl = preview.optString("url", "");
                if (!TextUtils.isEmpty(previewUrl)) {
                    showSuccessSnackbar("Preview ready\n" + previewUrl);
                    projectStatus = "Published";
                    updateStatusUI();
                }
            }
        }

        if (done && STREAM_CODE_AGENT.equals(streamType)) {
            loadMessages();
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
                for (ProjectMessage m : backendMessages) {
                    if (m.getContent() == null || m.getContent().trim().isEmpty()) continue;
                    boolean isUser = "USER".equalsIgnoreCase(m.getRole());
                    messageList.add(new ChatMessage(m.getContent(), isUser));
                }
                adapter.notifyDataSetChanged();
                if (!messageList.isEmpty()) {
                    rvChat.scrollToPosition(messageList.size() - 1);
                }
            }

            @Override
            public void onFailure(Call<MessagesResponse> call, Throwable t) {
                showInfoSnackbar("Could not reach backend");
            }
        });
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
        optUpdateVisible(optPreviewRestart, true);

        optDeploy.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            connectRealtimeForType(STREAM_DEPLOY);
            triggerAction("Deploy scheduled", apiService.deployProject(projectId));
        });

        optKeystore.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            connectRealtimeForType(STREAM_GENERATE_KEYSTORE);
            triggerAction(
                    "Keystore generation triggered",
                    apiService.generateKeystore(projectId, new GenerateKeystoreRequest(Collections.emptyMap()))
            );
        });

        optPreview.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            connectRealtimeForType(STREAM_PREVIEW);
            triggerAction("Preview requested", apiService.runPreview(projectId));
            showViewMode();
        });

        optPreviewRestart.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            connectRealtimeForType(STREAM_PREVIEW);
            triggerAction("Preview restart requested", apiService.restartPreview(projectId));
            showViewMode();
        });

        optExport.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            connectRealtimeForType(STREAM_EXPORT_APK);
            triggerAction("APK export requested", apiService.exportApk(projectId));
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
                if (secrets.isEmpty()) {
                    target.setText("No project secrets.");
                    return;
                }
                StringBuilder sb = new StringBuilder("Current project secrets:\n");
                for (SecretSummary secret : secrets) {
                    sb.append("• ").append(secret.getName());
                    if (Boolean.TRUE.equals(secret.getUseUserSecret())) {
                        sb.append(" (uses account secret)");
                    }
                    sb.append('\n');
                }
                target.setText(sb.toString().trim());
            }

            @Override
            public void onFailure(Call<SecretsResponse> call, Throwable t) {
                target.setText("Could not reach backend.");
            }
        });
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
            if (currentProject != null) {
                HomeActivity.userProjects.remove(currentProject);
            }
            Toast.makeText(this, "Project deleted", Toast.LENGTH_SHORT).show();
            dialog.dismiss();
            finish();
        });

        btnCancel.setOnClickListener(v -> dialog.dismiss());
        dialog.show();
    }

    private void showChatMode() {
        btnChatToggle.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.WHITE));
        btnChatToggle.setTextColor(Color.parseColor("#1A1A1A"));

        btnViewToggle.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.TRANSPARENT));
        btnViewToggle.setTextColor(Color.parseColor("#757575"));

        rvChat.setVisibility(View.VISIBLE);
        inputContainer.setVisibility(View.VISIBLE);
        previewContainer.setVisibility(View.GONE);
    }

    private void showViewMode() {
        btnViewToggle.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.WHITE));
        btnViewToggle.setTextColor(Color.parseColor("#1A1A1A"));

        btnChatToggle.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.TRANSPARENT));
        btnChatToggle.setTextColor(Color.parseColor("#757575"));

        rvChat.setVisibility(View.GONE);
        inputContainer.setVisibility(View.GONE);
        previewContainer.setVisibility(View.VISIBLE);
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
