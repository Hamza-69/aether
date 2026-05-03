package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.text.SpannableString;
import android.text.style.ForegroundColorSpan;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.ImageView;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.google.android.material.card.MaterialCardView;

import java.util.List;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.BackendProject;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectWrapperResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DiscoverAdapter extends RecyclerView.Adapter<DiscoverAdapter.DiscoverViewHolder> {

    private List<Project> communityItems;
    private final ApiService apiService = ApiClient.getApiService();

    public DiscoverAdapter(List<Project> communityItems) {
        this.communityItems = communityItems;
    }

    @NonNull
    @Override
    public DiscoverViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_project, parent, false);
        return new DiscoverViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull DiscoverViewHolder holder, int position) {
        Project item = communityItems.get(position);
        holder.tvTitle.setText(item.getTitle());

        String type = item.getType() != null ? item.getType() : "Project";
        holder.tvType.setText(type);

        if ("Template".equalsIgnoreCase(type)) {
            holder.typeCard.setCardBackgroundColor(0xFF7C4DFF);
        } else {
            holder.typeCard.setCardBackgroundColor(0xFF00BFA5);
        }

        if (item.getAuthorUsername() != null && !item.getAuthorUsername().trim().isEmpty()) {
            holder.authorContainer.setVisibility(View.VISIBLE);
            holder.tvAuthorName.setText("@" + item.getAuthorUsername());
        } else {
            holder.authorContainer.setVisibility(View.GONE);
        }

        if (item.getScreenshotUrl() != null && !item.getScreenshotUrl().trim().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(item.getScreenshotUrl())
                    .placeholder(android.R.color.darker_gray)
                    .into(holder.ivProjectImage);
        } else {
            holder.ivProjectImage.setImageResource(android.R.drawable.ic_menu_gallery);
        }

        holder.itemView.setOnClickListener(v -> showProjectActionsDialog(v.getContext(), item));

        holder.optionsCard.setVisibility(View.VISIBLE);
        holder.optionsCard.setOnClickListener(v -> {
            PopupMenu popup = new PopupMenu(v.getContext(), v);
            SpannableString s = new SpannableString("Report");
            s.setSpan(new ForegroundColorSpan(Color.RED), 0, s.length(), 0);
            popup.getMenu().add(0, 1, 0, s);
            popup.setOnMenuItemClickListener(menuItem -> {
                if (menuItem.getItemId() == 1) {
                    Toast.makeText(v.getContext(), "Project reported", Toast.LENGTH_SHORT).show();
                    return true;
                }
                return false;
            });
            popup.show();
        });
    }

    private void showProjectActionsDialog(android.content.Context context, Project item) {
        final Dialog dialog = new Dialog(context);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_project_actions);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        MaterialCardView btnPreview = dialog.findViewById(R.id.btnPreviewAction);
        MaterialCardView btnClone = dialog.findViewById(R.id.btnCloneAction);

        btnPreview.setOnClickListener(v -> {
            Intent intent = new Intent(context, PreviewActivity.class);
            intent.putExtra("PROJECT_TITLE", item.getTitle());
            context.startActivity(intent);
            if (context instanceof Activity) {
                ((Activity) context).overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
            }
            dialog.dismiss();
        });

        btnClone.setOnClickListener(v -> {
            if (item.getBackendId() == null || item.getBackendId().trim().isEmpty()) {
                Toast.makeText(context, "Cannot clone this project", Toast.LENGTH_SHORT).show();
                dialog.dismiss();
                return;
            }
            apiService.cloneDiscoverProject(item.getBackendId()).enqueue(new Callback<ProjectWrapperResponse>() {
                @Override
                public void onResponse(Call<ProjectWrapperResponse> call, Response<ProjectWrapperResponse> response) {
                    if (!response.isSuccessful() || response.body() == null || response.body().getProject() == null) {
                        Toast.makeText(context, "Clone failed", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    BackendProject backendProject = response.body().getProject();
                    Project cloned = new Project(
                            backendProject.getName(),
                            "Cloned from Discover",
                            "Not Published",
                            "Project"
                    );
                    cloned.setBackendId(backendProject.getId());
                    cloned.setScreenshotUrl(backendProject.getScreenshotUrl());
                    HomeActivity.userProjects.add(0, cloned);
                    Toast.makeText(context, "Project cloned to your list!", Toast.LENGTH_SHORT).show();
                }

                @Override
                public void onFailure(Call<ProjectWrapperResponse> call, Throwable t) {
                    Toast.makeText(context, "Could not reach backend", Toast.LENGTH_SHORT).show();
                }
            });
            dialog.dismiss();
        });

        dialog.show();
    }

    @Override
    public int getItemCount() {
        return communityItems.size();
    }

    public void updateList(List<Project> newList) {
        this.communityItems = newList;
        notifyDataSetChanged();
    }

    public static class DiscoverViewHolder extends RecyclerView.ViewHolder {
        TextView tvTitle, tvType, tvAuthorName;
        MaterialCardView typeCard, optionsCard, authorContainer;
        ImageView ivProjectImage;

        public DiscoverViewHolder(@NonNull View itemView) {
            super(itemView);
            tvTitle = itemView.findViewById(R.id.tvProjectTitle);
            tvType = itemView.findViewById(R.id.tvStatus);
            tvAuthorName = itemView.findViewById(R.id.tvAuthorName);
            typeCard = itemView.findViewById(R.id.statusBadge);
            optionsCard = itemView.findViewById(R.id.ivOptionsCard);
            authorContainer = itemView.findViewById(R.id.authorContainer);
            ivProjectImage = itemView.findViewById(R.id.ivProjectImage);
        }
    }
}
