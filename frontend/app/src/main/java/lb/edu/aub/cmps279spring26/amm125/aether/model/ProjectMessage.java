package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class ProjectMessage {
    private String id;
    private String content;
    private String role;
    private String type;
    private Boolean completed;
    private String createdAt;

    public String getId() {
        return id;
    }

    public String getContent() {
        return content;
    }

    public String getRole() {
        return role;
    }

    public String getType() {
        return type;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public String getCreatedAt() {
        return createdAt;
    }
}
