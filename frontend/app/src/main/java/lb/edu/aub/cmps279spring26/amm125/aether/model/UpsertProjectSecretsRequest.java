package lb.edu.aub.cmps279spring26.amm125.aether.model;

import java.util.List;

public class UpsertProjectSecretsRequest {
    private final List<UpsertProjectSecretEntry> secrets;

    public UpsertProjectSecretsRequest(List<UpsertProjectSecretEntry> secrets) {
        this.secrets = secrets;
    }
}
