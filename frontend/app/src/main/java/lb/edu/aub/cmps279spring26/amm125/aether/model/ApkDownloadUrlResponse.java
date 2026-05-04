package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class ApkDownloadUrlResponse {
    private String url;
    private String expiresAt;
    private int expiresInSeconds;

    public String getUrl() {
        return url;
    }

    public String getExpiresAt() {
        return expiresAt;
    }

    public int getExpiresInSeconds() {
        return expiresInSeconds;
    }
}
