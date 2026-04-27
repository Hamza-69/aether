package lb.edu.aub.cmps279spring26.amm125.aether;

public class Project {
    private String title;
    private String description;
    private String status;
    private String type; // "Project" or "Template"

    public Project(String title, String description, String status) {
        this.title = title;
        this.description = description;
        this.status = status;
        this.type = "Project"; // Default
    }

    public Project(String title, String description, String status, String type) {
        this.title = title;
        this.description = description;
        this.status = status;
        this.type = type;
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}