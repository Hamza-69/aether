package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class VerificationStartResponse {
    private String message;
    private String challengeId;
    private long expiresAt;

    public String getMessage() {
        return message;
    }

    public String getChallengeId() {
        return challengeId;
    }

    public long getExpiresAt() {
        return expiresAt;
    }
}

