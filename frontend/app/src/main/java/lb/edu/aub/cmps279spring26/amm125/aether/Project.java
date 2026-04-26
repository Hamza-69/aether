package lb.edu.aub.cmps279spring26.amm125.aether;

public class Project {
    private String title;
    private String description;
    private String status;

    public Project(String title, String description, String status) {
        this.title = title;
        this.description = description;
        this.status = status;
    }

    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getStatus() { return status; }
}