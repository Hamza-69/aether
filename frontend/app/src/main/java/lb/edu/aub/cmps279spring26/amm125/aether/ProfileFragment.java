package lb.edu.aub.cmps279spring26.amm125.aether;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Base64;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;

import com.bumptech.glide.Glide;
import com.google.android.material.card.MaterialCardView;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.CurrentUserResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProfilePictureRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProfilePictureResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretSummary;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsWriteResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.User;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertUserSecretEntry;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertUserSecretsRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.utils.SecretCryptoUtil;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileFragment extends Fragment {

    private final ApiService apiService = ApiClient.getApiService();
    private ImageView ivProfileImage;
    private MaterialCardView profileImageCard;
    private TextView tvProfileName;
    private TextView tvProfileUsername;
    private TextView tvProfileEmail;

    private final ActivityResultLauncher<String> imagePickerLauncher =
            registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
                if (uri != null) {
                    uploadProfileImage(uri);
                }
            });

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_profile, container, false);

        UserManager userManager = UserManager.getInstance();
        userManager.load(requireContext());

        tvProfileName = view.findViewById(R.id.tvProfileName);
        tvProfileUsername = view.findViewById(R.id.tvProfileUsername);
        tvProfileEmail = view.findViewById(R.id.tvProfileEmail);
        ivProfileImage = view.findViewById(R.id.ivProfileImage);
        profileImageCard = view.findViewById(R.id.profileImageCard);

        hydrateProfileHeader(userManager.getName(), userManager.getUsername(), userManager.getEmail());

        MaterialCardView btnManageAccountSecrets = view.findViewById(R.id.btnManageAccountSecrets);
        if (btnManageAccountSecrets != null) {
            btnManageAccountSecrets.setOnClickListener(v -> showAccountSecretsDialog());
        }

        MaterialCardView btnLogout = view.findViewById(R.id.btnLogout);
        if (btnLogout != null) {
            btnLogout.setOnClickListener(v -> {
                UserManager.getInstance().logout(requireContext());
                FragmentActivity activity = getActivity();
                if (activity != null) {
                    Intent intent = new Intent(activity, MainActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    activity.finish();
                }
            });
        }

        profileImageCard.setOnClickListener(v -> imagePickerLauncher.launch("image/*"));
        profileImageCard.setOnLongClickListener(v -> {
            deleteProfileImage();
            return true;
        });

        loadCurrentUserProfile();
        return view;
    }

    @Override
    public void onResume() {
        super.onResume();
        loadCurrentUserProfile();
    }

    private void loadCurrentUserProfile() {
        apiService.getCurrentUser().enqueue(new Callback<CurrentUserResponse>() {
            @Override
            public void onResponse(Call<CurrentUserResponse> call, Response<CurrentUserResponse> response) {
                if (!isAdded()) return;
                if (response.isSuccessful() && response.body() != null && response.body().getUser() != null) {
                    User user = response.body().getUser();
                    UserManager userManager = UserManager.getInstance();
                    userManager.setName(user.getName());
                    userManager.setUsername(user.getUsername());
                    userManager.setEmail(user.getEmail());
                    hydrateProfileHeader(user.getName(), user.getUsername(), user.getEmail());

                    if (user.getProfilePictureUrl() == null || user.getProfilePictureUrl().trim().isEmpty()) {
                        ivProfileImage.setImageResource(R.drawable.ic_profile);
                        return;
                    }
                    Glide.with(requireContext())
                            .load(user.getProfilePictureUrl())
                            .circleCrop()
                            .placeholder(R.drawable.ic_profile)
                            .into(ivProfileImage);
                } else {
                    ivProfileImage.setImageResource(R.drawable.ic_profile);
                }
            }

            @Override
            public void onFailure(Call<CurrentUserResponse> call, Throwable t) {
                if (!isAdded()) return;
                ivProfileImage.setImageResource(R.drawable.ic_profile);
            }
        });
    }

    private void hydrateProfileHeader(String name, String username, String email) {
        String safeName = TextUtils.isEmpty(name) ? "Guest" : name;
        String safeUsername = TextUtils.isEmpty(username) ? "guest" : username;
        String safeEmail = TextUtils.isEmpty(email) ? "No email" : email;
        tvProfileName.setText(safeName);
        tvProfileUsername.setText("@" + safeUsername);
        tvProfileEmail.setText(safeEmail);
    }

    private void uploadProfileImage(Uri uri) {
        if (!isAdded()) return;
        String base64Image;
        try {
            base64Image = readUriAsCompressedBase64Jpeg(uri);
        } catch (IOException e) {
            Toast.makeText(requireContext(), "Failed to process image", Toast.LENGTH_SHORT).show();
            return;
        }

        apiService.uploadProfilePicture(new ProfilePictureRequest(base64Image, "image/jpeg"))
                .enqueue(new Callback<ProfilePictureResponse>() {
                    @Override
                    public void onResponse(Call<ProfilePictureResponse> call, Response<ProfilePictureResponse> response) {
                        if (!isAdded()) return;
                        if (!response.isSuccessful() || response.body() == null) {
                            Toast.makeText(requireContext(), "Upload failed (" + response.code() + ")", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        String profilePictureUrl = response.body().getProfilePictureUrl();
                        if (profilePictureUrl != null && !profilePictureUrl.trim().isEmpty()) {
                            Glide.with(requireContext())
                                    .load(profilePictureUrl)
                                    .circleCrop()
                                    .placeholder(R.drawable.ic_profile)
                                    .into(ivProfileImage);
                        }
                        Toast.makeText(requireContext(), "Profile picture updated", Toast.LENGTH_SHORT).show();
                    }

                    @Override
                    public void onFailure(Call<ProfilePictureResponse> call, Throwable t) {
                        if (!isAdded()) return;
                        Toast.makeText(requireContext(), "Could not reach backend", Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void deleteProfileImage() {
        apiService.deleteProfilePicture().enqueue(new Callback<ActionResponse>() {
            @Override
            public void onResponse(Call<ActionResponse> call, Response<ActionResponse> response) {
                if (!isAdded()) return;
                if (!response.isSuccessful()) {
                    Toast.makeText(requireContext(), "Delete failed", Toast.LENGTH_SHORT).show();
                    return;
                }
                ivProfileImage.setImageResource(R.drawable.ic_profile);
                Toast.makeText(requireContext(), "Profile picture removed", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onFailure(Call<ActionResponse> call, Throwable t) {
                if (!isAdded()) return;
                Toast.makeText(requireContext(), "Could not reach backend", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String readUriAsCompressedBase64Jpeg(Uri uri) throws IOException {
        Bitmap bitmap = decodeScaledBitmap(uri, 1280);
        if (bitmap == null) {
            throw new IOException("Unable to decode image");
        }

        final int maxBytes = 5 * 1024 * 1024;
        int quality = 88;
        byte[] jpegBytes = null;

        for (; quality >= 45; quality -= 8) {
            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out);
                byte[] candidate = out.toByteArray();
                if (candidate.length <= maxBytes) {
                    jpegBytes = candidate;
                    break;
                }
            }
        }

        if (jpegBytes == null) {
            throw new IOException("Image is too large after compression");
        }

        return Base64.encodeToString(jpegBytes, Base64.NO_WRAP);
    }

    private Bitmap decodeScaledBitmap(Uri uri, int maxDim) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;

        try (InputStream in = requireContext().getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("Unable to open stream");
            BitmapFactory.decodeStream(in, null, bounds);
        }

        int width = bounds.outWidth;
        int height = bounds.outHeight;
        if (width <= 0 || height <= 0) {
            throw new IOException("Invalid image dimensions");
        }

        int sampleSize = 1;
        while ((width / sampleSize) > maxDim || (height / sampleSize) > maxDim) {
            sampleSize *= 2;
        }

        BitmapFactory.Options decode = new BitmapFactory.Options();
        decode.inSampleSize = sampleSize;
        decode.inPreferredConfig = Bitmap.Config.ARGB_8888;

        try (InputStream in = requireContext().getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("Unable to open stream");
            return BitmapFactory.decodeStream(in, null, decode);
        }
    }

    private void showAccountSecretsDialog() {
        if (!isAdded()) return;

        LinearLayout root = new LinearLayout(requireContext());
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(16);
        root.setPadding(pad, pad, pad, 0);

        EditText etName = new EditText(requireContext());
        etName.setHint("Secret name (UPPER_SNAKE_CASE)");
        root.addView(etName);

        EditText etValue = new EditText(requireContext());
        etValue.setHint("Secret value");
        root.addView(etValue);

        TextView tvSecrets = new TextView(requireContext());
        tvSecrets.setPadding(0, dp(12), 0, dp(8));
        root.addView(tvSecrets);

        androidx.appcompat.app.AlertDialog dialog = new androidx.appcompat.app.AlertDialog.Builder(requireContext())
                .setTitle("Account Secrets")
                .setView(root)
                .setPositiveButton("Save", null)
                .setNegativeButton("Delete", null)
                .setNeutralButton("Refresh", null)
                .create();

        dialog.setOnShowListener(d -> {
            loadAccountSecretsInto(tvSecrets);

            Button save = dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE);
            Button delete = dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_NEGATIVE);
            Button refresh = dialog.getButton(androidx.appcompat.app.AlertDialog.BUTTON_NEUTRAL);

            save.setOnClickListener(v -> {
                String name = etName.getText().toString().trim().toUpperCase(Locale.US);
                String value = etValue.getText().toString();
                if (!name.matches("^[A-Z_][A-Z0-9_]*$")) {
                    Toast.makeText(requireContext(), "Secret name must be UPPER_SNAKE_CASE", Toast.LENGTH_SHORT).show();
                    return;
                }
                if (TextUtils.isEmpty(value)) {
                    Toast.makeText(requireContext(), "Secret value is required", Toast.LENGTH_SHORT).show();
                    return;
                }

                String encryptedValue;
                try {
                    encryptedValue = SecretCryptoUtil.encryptForServer(value);
                } catch (IllegalStateException e) {
                    Toast.makeText(requireContext(), "Invalid CLIENT_SECRET_KEY configuration", Toast.LENGTH_SHORT).show();
                    return;
                }

                UpsertUserSecretEntry entry = new UpsertUserSecretEntry(name, encryptedValue);
                apiService.upsertUserSecrets(new UpsertUserSecretsRequest(Collections.singletonList(entry)))
                        .enqueue(new Callback<SecretsWriteResponse>() {
                            @Override
                            public void onResponse(Call<SecretsWriteResponse> call, Response<SecretsWriteResponse> response) {
                                if (!isAdded()) return;
                                if (!response.isSuccessful()) {
                                    Toast.makeText(requireContext(), "Failed to save secret", Toast.LENGTH_SHORT).show();
                                    return;
                                }
                                Toast.makeText(requireContext(), "Secret saved", Toast.LENGTH_SHORT).show();
                                loadAccountSecretsInto(tvSecrets);
                            }

                            @Override
                            public void onFailure(Call<SecretsWriteResponse> call, Throwable t) {
                                if (!isAdded()) return;
                                Toast.makeText(requireContext(), "Could not reach backend", Toast.LENGTH_SHORT).show();
                            }
                        });
            });

            delete.setOnClickListener(v -> {
                String name = etName.getText().toString().trim().toUpperCase(Locale.US);
                if (!name.matches("^[A-Z_][A-Z0-9_]*$")) {
                    Toast.makeText(requireContext(), "Enter a valid secret name to delete", Toast.LENGTH_SHORT).show();
                    return;
                }
                apiService.deleteUserSecret(name).enqueue(new Callback<Void>() {
                    @Override
                    public void onResponse(Call<Void> call, Response<Void> response) {
                        if (!isAdded()) return;
                        if (!response.isSuccessful()) {
                            Toast.makeText(requireContext(), "Failed to delete secret", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        Toast.makeText(requireContext(), "Secret deleted", Toast.LENGTH_SHORT).show();
                        loadAccountSecretsInto(tvSecrets);
                    }

                    @Override
                    public void onFailure(Call<Void> call, Throwable t) {
                        if (!isAdded()) return;
                        Toast.makeText(requireContext(), "Could not reach backend", Toast.LENGTH_SHORT).show();
                    }
                });
            });

            refresh.setOnClickListener(v -> loadAccountSecretsInto(tvSecrets));
        });
        dialog.show();
    }

    private void loadAccountSecretsInto(TextView target) {
        apiService.getUserSecrets().enqueue(new Callback<SecretsResponse>() {
            @Override
            public void onResponse(Call<SecretsResponse> call, Response<SecretsResponse> response) {
                if (!isAdded()) return;
                if (!response.isSuccessful() || response.body() == null || response.body().getSecrets() == null) {
                    target.setText("Could not load secrets.");
                    return;
                }
                List<SecretSummary> secrets = response.body().getSecrets();
                if (secrets.isEmpty()) {
                    target.setText("No account secrets.");
                    return;
                }
                StringBuilder sb = new StringBuilder("Current account secrets:\n");
                for (SecretSummary secret : secrets) {
                    sb.append("• ").append(secret.getName()).append('\n');
                }
                target.setText(sb.toString().trim());
            }

            @Override
            public void onFailure(Call<SecretsResponse> call, Throwable t) {
                if (!isAdded()) return;
                target.setText("Could not reach backend.");
            }
        });
    }

    private int dp(int value) {
        return Math.round(requireContext().getResources().getDisplayMetrics().density * value);
    }
}
