package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class ActionResponse {
    private Boolean scheduled;
    private Boolean alreadyRunning;
    private Boolean alreadyExists;
    private String url;
    private String message;
    private String error;

    public Boolean getScheduled() {
        return scheduled;
    }

    public Boolean getAlreadyRunning() {
        return alreadyRunning;
    }

    public Boolean getAlreadyExists() {
        return alreadyExists;
    }

    public String getUrl() {
        return url;
    }

    public String getMessage() {
        return message;
    }

    public String getError() {
        return error;
    }
}
