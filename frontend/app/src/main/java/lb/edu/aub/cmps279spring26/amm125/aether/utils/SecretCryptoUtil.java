package lb.edu.aub.cmps279spring26.amm125.aether.utils;

import android.util.Base64;

import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import lb.edu.aub.cmps279spring26.amm125.aether.BuildConfig;

public final class SecretCryptoUtil {
    private static final int IV_LENGTH = 12;
    private static final int AUTH_TAG_LENGTH = 16;

    private SecretCryptoUtil() {}

    public static String encryptForServer(String plaintext) {
        try {
            byte[] key = hexToBytes(BuildConfig.CLIENT_SECRET_KEY);
            if (key.length != 32) {
                throw new IllegalStateException("CLIENT_SECRET_KEY must be a 64-character hex string");
            }

            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            byte[] ciphertextAndTag = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            if (ciphertextAndTag.length < AUTH_TAG_LENGTH) {
                throw new IllegalStateException("Invalid encrypted payload");
            }

            int ciphertextLength = ciphertextAndTag.length - AUTH_TAG_LENGTH;
            byte[] payload = new byte[IV_LENGTH + AUTH_TAG_LENGTH + ciphertextLength];
            System.arraycopy(iv, 0, payload, 0, IV_LENGTH);
            System.arraycopy(ciphertextAndTag, ciphertextLength, payload, IV_LENGTH, AUTH_TAG_LENGTH);
            System.arraycopy(ciphertextAndTag, 0, payload, IV_LENGTH + AUTH_TAG_LENGTH, ciphertextLength);

            return Base64.encodeToString(payload, Base64.NO_WRAP);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt secret", e);
        }
    }

    private static byte[] hexToBytes(String hex) {
        if (hex == null || hex.length() % 2 != 0) {
            return new byte[0];
        }
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < hex.length(); i += 2) {
            int hi = Character.digit(hex.charAt(i), 16);
            int lo = Character.digit(hex.charAt(i + 1), 16);
            if (hi < 0 || lo < 0) {
                return new byte[0];
            }
            out[i / 2] = (byte) ((hi << 4) + lo);
        }
        return out;
    }
}
