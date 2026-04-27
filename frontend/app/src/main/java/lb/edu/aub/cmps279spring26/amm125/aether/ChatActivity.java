package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.snackbar.BaseTransientBottomBar;
import com.google.android.material.snackbar.Snackbar;
import java.util.ArrayList;
import java.util.List;

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
    private boolean hasUnpublishedChanges = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat);

        projectTitle = getIntent().getStringExtra("PROJECT_TITLE");
        projectDesc = getIntent().getStringExtra("PROJECT_DESC");
        projectStatus = getIntent().getStringExtra("PROJECT_STATUS");
        
        if (projectTitle == null) projectTitle = "New Project";
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

        if (!TextUtils.isEmpty(projectDesc)) {
            messageList.add(new ChatMessage(projectDesc, true));
            adapter.notifyItemInserted(0);
            
            rvChat.postDelayed(() -> {
                String aiResponse = "I'll create a " + projectTitle + " app for you! It will include:\n\n" +
                        "• Features based on: " + projectDesc + "\n" +
                        "• Modern UI components\n" +
                        "• Intuitive navigation\n\n" +
                        "Let me build this for you...";
                messageList.add(new ChatMessage(aiResponse, false));
                adapter.notifyItemInserted(messageList.size() - 1);
                rvChat.scrollToPosition(messageList.size() - 1);
            }, 800);
        }

        btnSend.setOnClickListener(v -> {
            String text = etMessage.getText().toString().trim();
            if (!TextUtils.isEmpty(text)) {
                sendMessage(text);
            }
        });
    }

    private void updateStatusUI() {
        TextView tvStatus = findViewById(R.id.tvChatStatus);
        tvStatus.setText(projectStatus);
        
        MaterialCardView statusBadge = findViewById(R.id.statusBadgeCard);
        if ("Published".equalsIgnoreCase(projectStatus)) {
            statusBadge.setCardBackgroundColor(0xFF00BFA5); // Green
        } else {
            statusBadge.setCardBackgroundColor(0xFFFFB300); // Orange
        }
    }

    private void showEnhancedOptionsMenu(View v) {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_chat_options);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            
            // Positioning it near the top right button
            Window window = dialog.getWindow();
            window.setGravity(Gravity.TOP | Gravity.END);
            
            // Add some offset from the top/right
            android.view.WindowManager.LayoutParams params = window.getAttributes();
            params.x = 20; // pixels from right
            params.y = 120; // pixels from top
            window.setAttributes(params);
            
            window.setWindowAnimations(android.R.style.Animation_Dialog);
        }

        LinearLayout optDeploy = dialog.findViewById(R.id.optionDeploy);
        LinearLayout optPublish = dialog.findViewById(R.id.optionPublish);
        LinearLayout optUpdate = dialog.findViewById(R.id.optionUpdate);
        LinearLayout optExport = dialog.findViewById(R.id.optionExport);
        LinearLayout optDelete = dialog.findViewById(R.id.optionDelete);
        
        ImageView ivPublishIcon = dialog.findViewById(R.id.ivPublishIcon);
        TextView tvPublishText = dialog.findViewById(R.id.tvPublishText);

        boolean isPublished = "Published".equalsIgnoreCase(projectStatus);
        
        if (isPublished) {
            tvPublishText.setText("Unpublish");
            ivPublishIcon.setImageResource(R.drawable.ic_back);
            ivPublishIcon.setImageTintList(android.content.res.ColorStateList.valueOf(Color.GRAY));
            
            if (hasUnpublishedChanges) {
                optUpdate.setVisibility(View.VISIBLE);
            }
        } else {
            tvPublishText.setText("Publish");
            ivPublishIcon.setImageResource(R.drawable.ic_sparkle);
            ivPublishIcon.setImageTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#00BFA5")));
        }

        optDeploy.setOnClickListener(view -> {
            showViewMode();
            showSuccessSnackbar("Deploying application preview...");
            dialog.dismiss();
        });

        optPublish.setOnClickListener(view -> {
            if (isPublished) {
                projectStatus = "Not Published";
                showInfoSnackbar("Project unpublished");
            } else {
                projectStatus = "Published";
                hasUnpublishedChanges = false;
                showSuccessSnackbar("Project published successfully!");
            }
            updateStatusUI();
            dialog.dismiss();
        });

        optUpdate.setOnClickListener(view -> {
            projectStatus = "Published";
            hasUnpublishedChanges = false;
            updateStatusUI();
            showSuccessSnackbar("Project updated and published!");
            dialog.dismiss();
        });

        optExport.setOnClickListener(view -> {
            showInfoSnackbar("Preparing APK for export...");
            dialog.dismiss();
        });

        optDelete.setOnClickListener(view -> {
            dialog.dismiss();
            showDeleteConfirmationDialog();
        });

        dialog.show();
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
            showInfoSnackbar("Project deleted");
            dialog.dismiss();
            findViewById(android.R.id.content).postDelayed(this::finish, 1000);
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

        rvChat.postDelayed(() -> {
            String response = "Great addition! I've updated the plan for " + projectTitle + " to include those features.\n\nYour app now has more comprehensive functionality!";
            messageList.add(new ChatMessage(response, false));
            adapter.notifyItemInserted(messageList.size() - 1);
            rvChat.scrollToPosition(messageList.size() - 1);
            hasUnpublishedChanges = true;
        }, 1200);
    }
}
