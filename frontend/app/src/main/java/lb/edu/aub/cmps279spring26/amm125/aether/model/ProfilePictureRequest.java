package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class ProfilePictureRequest {
    private final String image;
    private final String mimeType;

    public ProfilePictureRequest(String image, String mimeType) {
        this.image = image;
        this.mimeType = mimeType;
    }
}
