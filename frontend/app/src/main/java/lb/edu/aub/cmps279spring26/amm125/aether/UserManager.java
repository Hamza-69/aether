package lb.edu.aub.cmps279spring26.amm125.aether;

import android.content.Context;
import android.net.Uri;

import lb.edu.aub.cmps279spring26.amm125.aether.utils.SessionManager;

public class UserManager {
    private static UserManager instance;
    private String name = "Alex Thompson";
    private String username = "alex";
    private String email = "alex@example.com";
    private Uri profileImageUri;

    private UserManager() {}

    public static UserManager getInstance() {
        if (instance == null) {
            instance = new UserManager();
        }
        return instance;
    }

    public void load(Context context) {
        SessionManager sessionManager = new SessionManager(context);
        this.name = sessionManager.getName();
        this.username = sessionManager.getUsername();
        this.email = sessionManager.getEmail();
    }

    public void logout(Context context) {
        SessionManager sessionManager = new SessionManager(context);
        sessionManager.logout();
        this.name = null;
        this.username = null;
        this.email = null;
        this.profileImageUri = null;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public Uri getProfileImageUri() { return profileImageUri; }
    public void setProfileImageUri(Uri uri) { this.profileImageUri = uri; }
}
