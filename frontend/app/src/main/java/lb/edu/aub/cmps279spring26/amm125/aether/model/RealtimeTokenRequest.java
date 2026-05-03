package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class RealtimeTokenRequest {
    private final String projectId;
    private final String type;

    public RealtimeTokenRequest(String projectId, String type) {
        this.projectId = projectId;
        this.type = type;
    }
}
