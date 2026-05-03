package lb.edu.aub.cmps279spring26.amm125.aether;

public class Project {
    private long id;
    private String backendId;
    private String title;
    private String description;
    private String status;
    private String type; // "Project" or "Template"
    private String screenshotUrl;
    private String authorUsername;
    private boolean hasUnpublishedChanges = false;

    public Project(String title, String description, String status) {
        this.id = System.currentTimeMillis() + (long)(Math.random() * 1000);
        this.title = title;
        this.description = description;
        this.status = status;
        this.type = "Project"; // Default
    }

    public Project(String title, String description, String status, String type) {
        this.id = System.nanoTime() + (long)(Math.random() * 1000);
        this.title = title;
        this.description = description;
        this.status = status;
        this.type = type;
    }

    // Default constructor for ID generation
    private Project() {
        this.id = System.nanoTime() + (long)(Math.random() * 1000);
    }

    // Copy constructor
    public Project(Project other) {
        this.id = other.id;
        this.backendId = other.backendId;
        this.title = other.title;
        this.description = other.description;
        this.status = other.status;
        this.type = other.type;
        this.screenshotUrl = other.screenshotUrl;
        this.authorUsername = other.authorUsername;
        this.hasUnpublishedChanges = other.hasUnpublishedChanges;
    }

    public long getId() { return id; }
    public String getBackendId() { return backendId; }
    public void setBackendId(String backendId) { this.backendId = backendId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getScreenshotUrl() { return screenshotUrl; }
    public void setScreenshotUrl(String screenshotUrl) { this.screenshotUrl = screenshotUrl; }
    public String getAuthorUsername() { return authorUsername; }
    public void setAuthorUsername(String authorUsername) { this.authorUsername = authorUsername; }
    public boolean hasUnpublishedChanges() { return hasUnpublishedChanges; }
    public void setHasUnpublishedChanges(boolean hasUnpublishedChanges) { this.hasUnpublishedChanges = hasUnpublishedChanges; }
}
