package lb.edu.aub.cmps279spring26.amm125.aether.model;

import java.util.List;

public class UpsertUserSecretsRequest {
    private final List<UpsertUserSecretEntry> secrets;

    public UpsertUserSecretsRequest(List<UpsertUserSecretEntry> secrets) {
        this.secrets = secrets;
    }
}
