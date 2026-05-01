package lb.edu.aub.cmps279spring26.amm125.aether;

import android.content.Context;
import android.net.Uri;

import lb.edu.aub.cmps279spring26.amm125.aether.utils.SessionManager;

public class UserManager {
    private static UserManager instance;
    private String name = "Alex Thompson";
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
        this.email = sessionManager.getEmail();
    }

    public void logout(Context context) {
        SessionManager sessionManager = new SessionManager(context);
        sessionManager.logout();
        this.name = null;
        this.email = null;
        this.profileImageUri = null;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public Uri getProfileImageUri() { return profileImageUri; }
    public void setProfileImageUri(Uri uri) { this.profileImageUri = uri; }
}