package lb.edu.aub.cmps279spring26.amm125.aether;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Base64;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
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

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.CurrentUserResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProfilePictureRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProfilePictureResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileFragment extends Fragment {

    private final ApiService apiService = ApiClient.getApiService();
    private ImageView ivProfileImage;
    private MaterialCardView profileImageCard;

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

        TextView tvProfileName = view.findViewById(R.id.tvProfileName);
        TextView tvProfileUsername = view.findViewById(R.id.tvProfileUsername);
        TextView tvProfileEmail = view.findViewById(R.id.tvProfileEmail);
        ivProfileImage = view.findViewById(R.id.ivProfileImage);
        profileImageCard = view.findViewById(R.id.profileImageCard);

        String name = userManager.getName();
        String username = userManager.getUsername();
        String email = userManager.getEmail();

        if (TextUtils.isEmpty(name)) name = "Guest";
        if (TextUtils.isEmpty(email)) email = "No email";
        if (TextUtils.isEmpty(username)) username = "guest";

        tvProfileName.setText(name);
        tvProfileUsername.setText("@" + username);
        tvProfileEmail.setText(email);

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

    private void loadCurrentUserProfile() {
        apiService.getCurrentUser().enqueue(new Callback<CurrentUserResponse>() {
            @Override
            public void onResponse(Call<CurrentUserResponse> call, Response<CurrentUserResponse> response) {
                if (!isAdded()) return;
                if (response.isSuccessful()
                        && response.body() != null
                        && response.body().getUser() != null
                        && response.body().getUser().getProfilePictureUrl() != null
                        && !response.body().getUser().getProfilePictureUrl().trim().isEmpty()) {
                    Glide.with(requireContext())
                            .load(response.body().getUser().getProfilePictureUrl())
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

    private void uploadProfileImage(Uri uri) {
        if (!isAdded()) return;
        String mimeType = requireContext().getContentResolver().getType(uri);
        if (mimeType == null || !mimeType.startsWith("image/")) {
            Toast.makeText(requireContext(), "Unsupported image type", Toast.LENGTH_SHORT).show();
            return;
        }

        String base64Image;
        try {
            base64Image = readUriAsBase64(uri);
        } catch (IOException e) {
            Toast.makeText(requireContext(), "Failed to read image", Toast.LENGTH_SHORT).show();
            return;
        }

        apiService.uploadProfilePicture(new ProfilePictureRequest(base64Image, mimeType))
                .enqueue(new Callback<ProfilePictureResponse>() {
                    @Override
                    public void onResponse(Call<ProfilePictureResponse> call, Response<ProfilePictureResponse> response) {
                        if (!isAdded()) return;
                        if (!response.isSuccessful() || response.body() == null) {
                            Toast.makeText(requireContext(), "Upload failed", Toast.LENGTH_SHORT).show();
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

    private String readUriAsBase64(Uri uri) throws IOException {
        InputStream inputStream = requireContext().getContentResolver().openInputStream(uri);
        if (inputStream == null) {
            throw new IOException("Unable to open stream");
        }
        try (InputStream in = inputStream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        }
    }
}
