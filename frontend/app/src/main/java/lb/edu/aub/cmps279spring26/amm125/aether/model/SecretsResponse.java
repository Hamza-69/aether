package lb.edu.aub.cmps279spring26.amm125.aether.model;

import java.util.List;

public class SecretsResponse {
    private List<SecretSummary> secrets;
    private List<RequiredSecretSummary> requiredSecrets;

    public List<SecretSummary> getSecrets() {
        return secrets;
    }

    public List<RequiredSecretSummary> getRequiredSecrets() {
        return requiredSecrets;
    }
}
