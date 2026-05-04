package lb.edu.aub.cmps279spring26.amm125.aether;

public class ChatMessage {
    private String id;
    private String text;
    private boolean isUser;
    private boolean completed = true;
    private String thinkingText;
    private boolean thinkingExpanded;

    public ChatMessage(String text, boolean isUser) {
        this.text = text;
        this.isUser = isUser;
    }

    public ChatMessage(String id, String text, boolean isUser, boolean completed, String thinkingText) {
        this.id = id;
        this.text = text;
        this.isUser = isUser;
        this.completed = completed;
        this.thinkingText = thinkingText;
        this.thinkingExpanded = !completed;
    }

    public String getId() {
        return id;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public boolean isUser() {
        return isUser;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public String getThinkingText() {
        return thinkingText;
    }

    public boolean isThinkingExpanded() {
        return thinkingExpanded;
    }

    public void toggleThinkingExpanded() {
        thinkingExpanded = !thinkingExpanded;
    }

    public void appendThinking(String chunk) {
        if (chunk == null || chunk.trim().isEmpty()) return;
        if (thinkingText == null || thinkingText.trim().isEmpty()) {
            thinkingText = chunk.trim();
        } else {
            thinkingText = thinkingText + "\n" + chunk.trim();
        }
    }
}
