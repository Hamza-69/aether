package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class CreateProjectRequest {
    private final String prompt;
    private final String name;

    public CreateProjectRequest(String prompt, String name) {
        this.prompt = prompt;
        this.name = name;
    }
}
