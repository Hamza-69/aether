package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class RequiredSecretSummary {
    private String name;
    private Boolean isSet;
    private Boolean useUserSecret;
    private String updatedAt;

    public String getName() {
        return name;
    }

    public Boolean getIsSet() {
        return isSet;
    }

    public Boolean getUseUserSecret() {
        return useUserSecret;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }
}
