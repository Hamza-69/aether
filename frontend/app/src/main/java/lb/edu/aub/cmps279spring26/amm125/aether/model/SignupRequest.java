package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class SignupRequest {
    private String name;
    private String username;
    private String email;
    private String password;

    public SignupRequest(String name, String username, String email, String password) {
        this.name = name;
        this.username = username;
        this.email = email;
        this.password = password;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }
}
