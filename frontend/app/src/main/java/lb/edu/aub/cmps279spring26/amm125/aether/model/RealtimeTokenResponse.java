package lb.edu.aub.cmps279spring26.amm125.aether.model;

import com.google.gson.JsonElement;
import java.util.List;

public class RealtimeTokenResponse {
    private JsonElement token;
    private String key;
    private String channel;
    private String topic;
    private List<JsonElement> streamChunks;

    public String getToken() {
        if (token != null) {
            if (token.isJsonPrimitive()) {
                return token.getAsString();
            }
            if (token.isJsonObject() && token.getAsJsonObject().has("key")) {
                JsonElement tokenKey = token.getAsJsonObject().get("key");
                if (tokenKey != null && tokenKey.isJsonPrimitive()) {
                    return tokenKey.getAsString();
                }
            }
        }
        return key;
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
