package lb.edu.aub.cmps279spring26.amm125.aether.model;

import com.google.gson.JsonElement;
import java.util.List;

public class RealtimeTokenResponse {
    private String token;
    private String channel;
    private String topic;
    private List<JsonElement> streamChunks;

    public String getToken() {
        return token;
    }

    public String getChannel() {
        return channel;
    }

    public String getTopic() {
        return topic;
    }

    public List<JsonElement> getStreamChunks() {
        return streamChunks;
    }
}
