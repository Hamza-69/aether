package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.snackbar.BaseTransientBottomBar;
import com.google.android.material.snackbar.Snackbar;
import java.util.List;

public class ProjectAdapter extends RecyclerView.Adapter<ProjectAdapter.ProjectViewHolder> {

    private List<Project> projects;
    private OnProjectDeletedListener deleteListener;

    public interface OnProjectDeletedListener {
        void onProjectDeleted();
    }

    public ProjectAdapter(List<Project> projects, OnProjectDeletedListener deleteListener) {
        this.projects = projects;
        this.deleteListener = deleteListener;
    }

    @NonNull
    @Override
    public ProjectViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_project, parent, false);
        return new ProjectViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ProjectViewHolder holder, int position) {
        Project project = projects.get(position);
        holder.tvTitle.setText(project.getTitle());
        
        updateStatusUI(holder, project.getStatus());

        holder.itemView.setOnClickListener(v -> {
            Intent intent = new Intent(v.getContext(), ChatActivity.class);
            intent.putExtra("PROJECT_TITLE", project.getTitle());
            intent.putExtra("PROJECT_DESC", project.getDescription());
            intent.putExtra("PROJECT_STATUS", project.getStatus());
            v.getContext().startActivity(intent);
        });

        holder.optionsCard.setOnClickListener(v -> {
            showEnhancedOptionsMenu(v, project, position);
        });
    }

    private void updateStatusUI(ProjectViewHolder holder, String status) {
        if ("Published".equalsIgnoreCase(status)) {
            holder.tvStatus.setText("Published");
            holder.statusCard.setCardBackgroundColor(0xFF00BFA5);
        } else {
            holder.tvStatus.setText("Not Published");
            holder.statusCard.setCardBackgroundColor(0xFFFFB300);
        }
    }

    private void showEnhancedOptionsMenu(View v, Project project, int position) {
        final Dialog dialog = new Dialog(v.getContext());
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_chat_options);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            Window window = dialog.getWindow();
            window.setGravity(Gravity.TOP | Gravity.END);
            int[] location = new int[2];
            v.getLocationOnScreen(location);
            android.view.WindowManager.LayoutParams params = window.getAttributes();
            params.x = 20; 
            params.y = location[1] + v.getHeight(); 
            window.setAttributes(params);
            window.setWindowAnimations(android.R.style.Animation_Dialog);
        }

        LinearLayout optDeploy = dialog.findViewById(R.id.optionDeploy);
        LinearLayout optRename = dialog.findViewById(R.id.optionRename);
        LinearLayout optPublish = dialog.findViewById(R.id.optionPublish);
        LinearLayout optUpdate = dialog.findViewById(R.id.optionUpdate);
        LinearLayout optExport = dialog.findViewById(R.id.optionExport);
        LinearLayout optDelete = dialog.findViewById(R.id.optionDelete);
        
        ImageView ivPublishIcon = dialog.findViewById(R.id.ivPublishIcon);
        TextView tvPublishText = dialog.findViewById(R.id.tvPublishText);

        boolean isPublished = "Published".equalsIgnoreCase(project.getStatus());
        
        if (isPublished) {
            tvPublishText.setText("Unpublish");
            ivPublishIcon.setImageResource(R.drawable.ic_back);
            ivPublishIcon.setImageTintList(android.content.res.ColorStateList.valueOf(Color.GRAY));
        } else {
            tvPublishText.setText("Publish");
            ivPublishIcon.setImageResource(R.drawable.ic_sparkle);
            ivPublishIcon.setImageTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#00BFA5")));
        }

        optDeploy.setOnClickListener(view -> {
            showInfoSnackbar(v, "Deploying application preview...");
            dialog.dismiss();
        });

        optRename.setOnClickListener(view -> {
            dialog.dismiss();
            showRenameDialog(v.getContext(), project, position, v);
        });

        optPublish.setOnClickListener(view -> {
            if (isPublished) {
                project.setStatus("Not Published");
                showInfoSnackbar(v, "Project unpublished");
            } else {
                project.setStatus("Published");
                showSuccessSnackbar(v, "Project published successfully!");
            }
            notifyItemChanged(position);
            dialog.dismiss();
        });

        optUpdate.setOnClickListener(view -> {
            project.setStatus("Published");
            notifyItemChanged(position);
            showSuccessSnackbar(v, "Project updated and published!");
            dialog.dismiss();
        });

        optExport.setOnClickListener(view -> {
            showInfoSnackbar(v, "Preparing APK for export...");
            dialog.dismiss();
        });

        optDelete.setOnClickListener(view -> {
            dialog.dismiss();
            showCustomDeleteDialog(v.getContext(), position, v);
        });

        dialog.show();
    }

    private void showRenameDialog(android.content.Context context, Project project, int position, View view) {
        final Dialog dialog = new Dialog(context);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_create_project);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        // Corrected IDs based on dialog_create_project.xml
        TextView tvTitle = dialog.findViewById(R.id.tvTitle);
        if (tvTitle != null) tvTitle.setText("Rename Project");
        
        TextView tvSubtitle = dialog.findViewById(R.id.tvSubtitle);
        if (tvSubtitle != null) tvSubtitle.setText("Update your project's name");

        EditText etName = dialog.findViewById(R.id.etProjectName);
        EditText etDesc = dialog.findViewById(R.id.etProjectDesc);
        View tvSuggestions = dialog.findViewById(R.id.tvSuggestions);
        View chipGroup = dialog.findViewById(R.id.chipGroupSuggestions);
        
        // Hide description and suggestions for rename mode
        if (etDesc != null) ((View)etDesc.getParent()).setVisibility(View.GONE);
        if (tvSuggestions != null) tvSuggestions.setVisibility(View.GONE);
        if (chipGroup != null) chipGroup.setVisibility(View.GONE);

        etName.setText(project.getTitle());
        etName.setSelection(etName.getText().length());

        Button btnSave = dialog.findViewById(R.id.btnCreate);
        if (btnSave != null) {
            btnSave.setText("Save Changes");
            btnSave.setEnabled(true);
            btnSave.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#00B0FF")));
            btnSave.setOnClickListener(v -> {
                String newName = etName.getText().toString().trim();
                if (!newName.isEmpty()) {
                    project.setTitle(newName);
                    notifyItemChanged(position);
                    showSuccessSnackbar(view, "Project renamed successfully");
                    dialog.dismiss();
                }
            });
        }

        Button btnCancel = dialog.findViewById(R.id.btnCancel);
        if (btnCancel != null) btnCancel.setOnClickListener(v -> dialog.dismiss());

        dialog.show();
    }

    private void showSuccessSnackbar(View view, String message) {
        Snackbar snackbar = Snackbar.make(view, message, Snackbar.LENGTH_SHORT);
        snackbar.setBackgroundTint(Color.parseColor("#323232"));
        snackbar.setTextColor(Color.WHITE);
        snackbar.setAnimationMode(BaseTransientBottomBar.ANIMATION_MODE_SLIDE);
        snackbar.show();
    }

    private void showInfoSnackbar(View view, String message) {
        Snackbar snackbar = Snackbar.make(view, message, Snackbar.LENGTH_SHORT);
        snackbar.setBackgroundTint(Color.parseColor("#323232"));
        snackbar.setTextColor(Color.WHITE);
        snackbar.setAnimationMode(BaseTransientBottomBar.ANIMATION_MODE_SLIDE);
        snackbar.show();
    }

    private void showCustomDeleteDialog(android.content.Context context, int position, View view) {
        final Dialog dialog = new Dialog(context);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_confirm_delete);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        Button btnDelete = dialog.findViewById(R.id.btnConfirmDelete);
        Button btnCancel = dialog.findViewById(R.id.btnCancelDelete);

        btnDelete.setOnClickListener(v -> {
            projects.remove(position);
            notifyItemRemoved(position);
            notifyItemRangeChanged(position, projects.size());
            if (deleteListener != null) {
                deleteListener.onProjectDeleted();
            }
            showInfoSnackbar(view, "Project deleted permanently");
            dialog.dismiss();
        });

        btnCancel.setOnClickListener(v -> dialog.dismiss());

        dialog.show();
    }

    @Override
    public int getItemCount() {
        return projects.size();
    }

    public static class ProjectViewHolder extends RecyclerView.ViewHolder {
        TextView tvTitle, tvStatus;
        MaterialCardView statusCard, optionsCard;

        public ProjectViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tvProjectTitle);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            statusCard = itemView.findViewById(R.id.statusBadge);
            optionsCard = itemView.findViewById(R.id.ivOptionsCard);
        }
    }
}