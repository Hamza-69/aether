package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class UpsertUserSecretEntry {
    private final String name;
    private final String encryptedValue;

    public UpsertUserSecretEntry(String name, String encryptedValue) {
        this.name = name;
        this.encryptedValue = encryptedValue;
    }
}
