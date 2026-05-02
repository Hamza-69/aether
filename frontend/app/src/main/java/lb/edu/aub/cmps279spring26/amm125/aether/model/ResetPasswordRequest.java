package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class ResetPasswordRequest {
    private String challengeId;
    private String password;

    public ResetPasswordRequest(String challengeId, String password) {
        this.challengeId = challengeId;
        this.password = password;
    }

    public String getChallengeId() {
        return challengeId;
    }

    public String getPassword() {
        return password;
    }
}
