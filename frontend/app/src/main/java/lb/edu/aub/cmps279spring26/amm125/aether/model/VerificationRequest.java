package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class VerificationRequest {
    private final String challengeId;
    private final String code;

    public VerificationRequest(String challengeId, String code) {
        this.challengeId = challengeId;
        this.code = code;
    }
}

