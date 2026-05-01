package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class AuthResponse {
    private String message;
    private String token;
    private User user;

    public String getMessage() {
        return message;
    }

    public String getToken() {
        return token;
    }

    public User getUser() {
        return user;
    }
}