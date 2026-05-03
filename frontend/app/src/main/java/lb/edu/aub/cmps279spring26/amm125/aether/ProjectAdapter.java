package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Dialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
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

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
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
        holder.authorContainer.setVisibility(View.GONE);

        if (project.getScreenshotUrl() != null && !project.getScreenshotUrl().trim().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(project.getScreenshotUrl())
                    .placeholder(android.R.color.darker_gray)
                    .into(holder.ivProjectImage);
        } else {
            holder.ivProjectImage.setImageBitmap(createInitialsBitmap(project.getTitle()));
        }

        holder.itemView.setOnClickListener(v -> {
            Intent intent = new Intent(v.getContext(), ChatActivity.class);
            intent.putExtra("PROJECT_TITLE", project.getTitle());
            intent.putExtra("PROJECT_DESC", project.getDescription());
            intent.putExtra("PROJECT_STATUS", project.getStatus());
            intent.putExtra("PROJECT_INDEX", HomeActivity.userProjects.indexOf(project));
            intent.putExtra("PROJECT_ID", project.getBackendId());
            v.getContext().startActivity(intent);
        });

        holder.optionsCard.setOnClickListener(v -> {
            showEnhancedOptionsMenu(v, project, position);
        });
    }

    private Bitmap createInitialsBitmap(String title) {
        int size = 600;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint bgPaint = new Paint();
        bgPaint.setColor(Color.parseColor("#7C4DFF"));
        canvas.drawRect(0, 0, size, size, bgPaint);

        String initials = "A";
        if (title != null && !title.trim().isEmpty()) {
            String[] parts = title.trim().split("\\s+");
            if (parts.length >= 2) {
                initials = (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
            } else {
                initials = parts[0].substring(0, 1).toUpperCase();
            }
        }

        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.WHITE);
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setTextSize(220f);
        textPaint.setFakeBoldText(true);
        Rect bounds = new Rect();
        textPaint.getTextBounds(initials, 0, initials.length(), bounds);
        float x = size / 2f;
        float y = (size / 2f) - bounds.exactCenterY();
        canvas.drawText(initials, x, y, textPaint);
        return bitmap;
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

            if (project.hasUnpublishedChanges()) {
                optUpdate.setVisibility(View.VISIBLE);
            }
        } else {
            tvPublishText.setText("Publish");
            ivPublishIcon.setImageResource(R.drawable.ic_sparkle);
            ivPublishIcon.setImageTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#00BFA5")));
        }

        optDeploy.setOnClickListener(view -> {
            showInfoSnackbar(v, "Open project chat to deploy this project");
            dialog.dismiss();
        });

        optRename.setOnClickListener(view -> {
            dialog.dismiss();
            showRenameDialog(v.getContext(), project, position, v);
        });

        optPublish.setOnClickListener(view -> {
            if (isPublished) {
                unpublishProject(project);
                showInfoSnackbar(v, "Project unpublished and removed from Discover");
            } else {
                dialog.dismiss();
                showPublishCategoryDialog(v.getContext(), project, position, v, false);
            }
            notifyItemChanged(position);
            dialog.dismiss();
        });

        optUpdate.setOnClickListener(view -> {
            dialog.dismiss();
            showPublishCategoryDialog(v.getContext(), project, position, v, true);
        });

        optExport.setOnClickListener(view -> {
            showInfoSnackbar(v, "Open project chat to export this project APK");
            dialog.dismiss();
        });

        optDelete.setOnClickListener(view -> {
            dialog.dismiss();
            showCustomDeleteDialog(v.getContext(), project, position, v);
        });

        dialog.show();
    }

    private void unpublishProject(Project project) {
        project.setStatus("Not Published");
        project.setHasUnpublishedChanges(false);
        for (int i = 0; i < HomeActivity.communityProjects.size(); i++) {
            if (HomeActivity.communityProjects.get(i).getId() == project.getId()) {
                HomeActivity.communityProjects.remove(i);
                break;
            }
        }
    }

    private void showPublishCategoryDialog(android.content.Context context, Project project, int position, View view, boolean isUpdate) {
        final Dialog dialog = new Dialog(context);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_publish_type);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        MaterialCardView btnProject = dialog.findViewById(R.id.btnTypeProject);
        MaterialCardView btnTemplate = dialog.findViewById(R.id.btnTypeTemplate);
        Button btnCancel = dialog.findViewById(R.id.btnCancelPublish);

        btnProject.setOnClickListener(v -> {
            handlePublishAction(project, position, view, isUpdate, "Project");
            dialog.dismiss();
        });

        btnTemplate.setOnClickListener(v -> {
            handlePublishAction(project, position, view, isUpdate, "Template");
            dialog.dismiss();
        });

        btnCancel.setOnClickListener(v -> dialog.dismiss());

        dialog.show();
    }

    private void handlePublishAction(Project project, int position, View view, boolean isUpdate, String category) {
        project.setStatus("Published");
        project.setType(category);
        project.setHasUnpublishedChanges(false);

        boolean foundInCommunity = false;
        for (Project p : HomeActivity.communityProjects) {
            if (p.getId() == project.getId()) {
                p.setTitle(project.getTitle());
                p.setType(category);
                foundInCommunity = true;
                break;
            }
        }

        if (!foundInCommunity) {
            HomeActivity.communityProjects.add(0, new Project(project));
        }

        notifyItemChanged(position);
        showSuccessSnackbar(view, isUpdate ? "Project updated in Discover!" : "Project published successfully!");
    }

    private void showRenameDialog(android.content.Context context, Project project, int position, View view) {
        final Dialog dialog = new Dialog(context);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_create_project);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        TextView tvTitle = dialog.findViewById(R.id.tvTitle);
        if (tvTitle != null) tvTitle.setText("Rename Project");

        TextView tvSubtitle = dialog.findViewById(R.id.tvSubtitle);
        if (tvSubtitle != null) tvSubtitle.setText("Update your project's name");

        EditText etName = dialog.findViewById(R.id.etProjectName);
        EditText etDesc = dialog.findViewById(R.id.etProjectDesc);
        View tvSuggestions = dialog.findViewById(R.id.tvSuggestions);
        View chipGroup = dialog.findViewById(R.id.chipGroupSuggestions);

        if (etDesc != null) ((View) etDesc.getParent()).setVisibility(View.GONE);
        if (tvSuggestions != null) tvSuggestions.setVisibility(View.GONE);
        if (chipGroup != null) chipGroup.setVisibility(View.GONE);

        etName.setText(project.getTitle());
        etName.setSelection(etName.getText().length());

        Button btnSave = dialog.findViewById(R.id.btnCreate);
        if (btnSave != null) {
            btnSave.setText("Save Changes");
            btnSave.setEnabled(true);
            btnSave.setOnClickListener(v -> {
                String newName = etName.getText().toString().trim();
                if (!newName.isEmpty()) {
                    project.setTitle(newName);
                    if ("Published".equalsIgnoreCase(project.getStatus())) {
                        project.setHasUnpublishedChanges(true);
                    }
                    notifyItemChanged(position);
                    showSuccessSnackbar(view, "Name changed. Update in Discover to sync.");
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

    private void showCustomDeleteDialog(android.content.Context context, Project project, int position, View view) {
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
            for (int i = 0; i < HomeActivity.communityProjects.size(); i++) {
                if (HomeActivity.communityProjects.get(i).getId() == project.getId()) {
                    HomeActivity.communityProjects.remove(i);
                    break;
                }
            }
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
        MaterialCardView statusCard, optionsCard, authorContainer;
        ImageView ivProjectImage;

        public ProjectViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tvProjectTitle);
            tvStatus = itemView.findViewById(R.id.tvStatus);
            statusCard = itemView.findViewById(R.id.statusBadge);
            optionsCard = itemView.findViewById(R.id.ivOptionsCard);
            authorContainer = itemView.findViewById(R.id.authorContainer);
            ivProjectImage = itemView.findViewById(R.id.ivProjectImage);
        }
    }
}
