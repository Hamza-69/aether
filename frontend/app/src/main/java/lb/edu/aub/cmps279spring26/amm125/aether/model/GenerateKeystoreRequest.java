package lb.edu.aub.cmps279spring26.amm125.aether.model;

import java.util.Map;

public class GenerateKeystoreRequest {
    private final Map<String, String> subject;

    public GenerateKeystoreRequest(Map<String, String> subject) {
        this.subject = subject;
    }
}
