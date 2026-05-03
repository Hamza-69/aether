package lb.edu.aub.cmps279spring26.amm125.aether;

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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.GenerateKeystoreRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.MessagesResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectMessage;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SendMessageRequest;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChatActivity extends AppCompatActivity {

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
        } else if (!TextUtils.isEmpty(projectDesc)) {
            messageList.add(new ChatMessage(projectDesc, true));
            adapter.notifyItemInserted(messageList.size() - 1);
        }
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
        LinearLayout optDelete = dialog.findViewById(R.id.optionDelete);

        optUpdateVisible(optPreviewRestart);

        optDeploy.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            triggerAction("Deploy scheduled", apiService.deployProject(projectId));
        });

        optKeystore.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
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
            triggerAction("Preview requested", apiService.runPreview(projectId));
            showViewMode();
        });

        optPreviewRestart.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            triggerAction("Preview restart requested", apiService.restartPreview(projectId));
            showViewMode();
        });

        optExport.setOnClickListener(view -> {
            dialog.dismiss();
            if (TextUtils.isEmpty(projectId)) {
                showInfoSnackbar("This project is not linked to backend yet");
                return;
            }
            triggerAction("APK export requested", apiService.exportApk(projectId));
        });

        optDelete.setOnClickListener(view -> {
            dialog.dismiss();
            showDeleteConfirmationDialog();
        });

        dialog.show();
    }

    private void optUpdateVisible(LinearLayout optPreviewRestart) {
        if (optPreviewRestart != null) {
            optPreviewRestart.setVisibility(View.VISIBLE);
        }
    }

    private void triggerAction(String successMessage, Call<ActionResponse> call) {
        call.enqueue(new Callback<ActionResponse>() {
            @Override
            public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                if (response.isSuccessful()) {
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
