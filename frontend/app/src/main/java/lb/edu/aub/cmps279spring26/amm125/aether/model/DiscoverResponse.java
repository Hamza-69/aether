package lb.edu.aub.cmps279spring26.amm125.aether.model;

import java.util.List;

public class DiscoverResponse {
    private List<PublishedProject> publishedProjects;

    public List<PublishedProject> getPublishedProjects() { return publishedProjects; }
    public void setPublishedProjects(List<PublishedProject> publishedProjects) { this.publishedProjects = publishedProjects; }
}
