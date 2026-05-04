package lb.edu.aub.cmps279spring26.amm125.aether.model;

import com.google.gson.JsonObject;

import java.util.List;

public class ProjectMessage {
    private String id;
    private String content;
    private String role;
    private String type;
    private Boolean completed;
    private String createdAt;
    private Stream stream;

    public String getId() {
        return id;
    }

    public String getContent() {
        return content;
    }

    public String getRole() {
        return role;
    }

    public String getType() {
        return type;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public Stream getStream() {
        return stream;
    }

    public static class Stream {
        private String id;
        private List<StreamChunk> streamChunks;

        public String getId() {
            return id;
        }

        public List<StreamChunk> getStreamChunks() {
            return streamChunks;
        }
    }

    public static class StreamChunk {
        private String id;
        private JsonObject data;
        private String createdAt;

        public String getId() {
            return id;
        }

        public JsonObject getData() {
            return data;
        }

        public String getCreatedAt() {
            return createdAt;
        }
    }
}
