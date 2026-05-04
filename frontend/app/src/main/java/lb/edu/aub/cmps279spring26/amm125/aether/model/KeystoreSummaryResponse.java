package lb.edu.aub.cmps279spring26.amm125.aether.model;

public class KeystoreSummaryResponse {
    private boolean exists;
    private String status;
    private KeystoreMeta keystore;

    public boolean isExists() {
        return exists;
    }

    public String getStatus() {
        return status;
    }

    public KeystoreMeta getKeystore() {
        return keystore;
    }

    public static class KeystoreMeta {
        private String id;
        private String createdAt;
        private String updatedAt;

        public String getId() {
            return id;
        }

        public String getCreatedAt() {
            return createdAt;
        }

        public String getUpdatedAt() {
            return updatedAt;
        }
    }
}
