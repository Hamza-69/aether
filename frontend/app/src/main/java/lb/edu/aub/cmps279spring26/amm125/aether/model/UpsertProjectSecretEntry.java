package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class UpsertProjectSecretEntry {
    private final String name;
    private final String encryptedValue;
    private final boolean useUserSecret;

    public UpsertProjectSecretEntry(String name, String encryptedValue, boolean useUserSecret) {
        this.name = name;
        this.encryptedValue = encryptedValue;
        this.useUserSecret = useUserSecret;
    }
}
