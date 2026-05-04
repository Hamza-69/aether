package lb.edu.aub.cmps279spring26.amm125.aether.model;

import java.util.List;

public class ProjectsResponse {
    private List<BackendProject> projects;

    public List<BackendProject> getProjects() { return projects; }
    public void setProjects(List<BackendProject> projects) { this.projects = projects; }
}
