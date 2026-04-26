package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.card.MaterialCardView;
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
        
        if ("Published".equalsIgnoreCase(project.getStatus())) {
            holder.tvStatus.setText("Published");
            holder.statusCard.setCardBackgroundColor(0xFF00BFA5);
        } else {
            holder.tvStatus.setText("Not Published");
            holder.statusCard.setCardBackgroundColor(0xFFFFB300);
        }

        // Click on the project card to open ChatActivity
        holder.itemView.setOnClickListener(v -> {
            Intent intent = new Intent(v.getContext(), ChatActivity.class);
            intent.putExtra("PROJECT_TITLE", project.getTitle());
            intent.putExtra("PROJECT_DESC", project.getDescription());
            v.getContext().startActivity(intent);
        });

        holder.optionsCard.setOnClickListener(v -> {
            PopupMenu popup = new PopupMenu(v.getContext(), v);
            popup.getMenu().add("Delete Project");
            popup.setOnMenuItemClickListener(item -> {
                if (item.getTitle().equals("Delete Project")) {
                    showCustomDeleteDialog(v.getContext(), position);
                    return true;
                }
                return false;
            });
            popup.show();
        });
    }

    private void showCustomDeleteDialog(android.content.Context context, int position) {
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
            Toast.makeText(context, "Project deleted permanently", Toast.LENGTH_SHORT).show();
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