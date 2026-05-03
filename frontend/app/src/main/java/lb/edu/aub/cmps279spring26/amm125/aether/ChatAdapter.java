package lb.edu.aub.cmps279spring26.amm125.aether;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.text.TextUtils;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;

public class ChatAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {

    private static final int VIEW_TYPE_AI = 1;
    private static final int VIEW_TYPE_USER = 2;

    private List<ChatMessage> messages;

    public ChatAdapter(List<ChatMessage> messages) {
        this.messages = messages;
    }

    @Override
    public int getItemViewType(int position) {
        return messages.get(position).isUser() ? VIEW_TYPE_USER : VIEW_TYPE_AI;
    }

    @NonNull
    @Override
    public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        if (viewType == VIEW_TYPE_USER) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_chat_user, parent, false);
            return new UserViewHolder(view);
        } else {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_chat_ai, parent, false);
            return new AiViewHolder(view);
        }
    }

    @Override
    public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
        ChatMessage message = messages.get(position);
        if (holder instanceof UserViewHolder) {
            ((UserViewHolder) holder).tvMessage.setText(message.getText());
        } else {
            AiViewHolder aiHolder = (AiViewHolder) holder;
            String text = message.getText();
            if (TextUtils.isEmpty(text) && !message.isCompleted()) {
                text = "Thinking...";
            }
            aiHolder.tvMessage.setText(text);

            String thinking = message.getThinkingText();
            boolean showThinking = !TextUtils.isEmpty(thinking);
            aiHolder.thinkingContainer.setVisibility(showThinking ? View.VISIBLE : View.GONE);
            ViewGroup.MarginLayoutParams messageParams = (ViewGroup.MarginLayoutParams) aiHolder.tvMessage.getLayoutParams();
            messageParams.topMargin = showThinking ? dp(aiHolder.tvMessage, 12) : 0;
            aiHolder.tvMessage.setLayoutParams(messageParams);
            aiHolder.tvThinkingToggle.setText(message.isThinkingExpanded() ? "Thinking v" : "Thinking >");
            aiHolder.tvThinking.setVisibility(message.isThinkingExpanded() ? View.VISIBLE : View.GONE);
            aiHolder.tvThinking.setText(showThinking ? thinking : "");
            aiHolder.thinkingContainer.setOnClickListener(v -> {
                int adapterPosition = holder.getBindingAdapterPosition();
                if (adapterPosition == RecyclerView.NO_POSITION) return;
                message.toggleThinkingExpanded();
                notifyItemChanged(adapterPosition);
            });
        }
    }

    private int dp(View view, int value) {
        return Math.round(value * view.getResources().getDisplayMetrics().density);
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    static class AiViewHolder extends RecyclerView.ViewHolder {
        TextView tvMessage;
        View thinkingContainer;
        TextView tvThinkingToggle;
        TextView tvThinking;

        AiViewHolder(@NonNull View itemView) {
            super(itemView);
            tvMessage = itemView.findViewById(R.id.tvAiMessage);
            thinkingContainer = itemView.findViewById(R.id.thinkingContainer);
            tvThinkingToggle = itemView.findViewById(R.id.tvThinkingToggle);
            tvThinking = itemView.findViewById(R.id.tvThinkingChunks);
        }
    }

    static class UserViewHolder extends RecyclerView.ViewHolder {
        TextView tvMessage;

        UserViewHolder(@NonNull View itemView) {
            super(itemView);
            tvMessage = itemView.findViewById(R.id.tvUserMessage);
        }
    }
}
