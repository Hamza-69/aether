package lb.edu.aub.cmps279spring26.amm125.aether.viewmodel;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import lb.edu.aub.cmps279spring26.amm125.aether.model.AuthResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.VerificationStartResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.repository.AuthRepository;
import org.json.JSONObject;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AuthViewModel extends ViewModel {

    private final AuthRepository authRepository;

    private final MutableLiveData<AuthResponse> authSuccess = new MutableLiveData<>();
    private final MutableLiveData<VerificationStartResponse> verificationStarted = new MutableLiveData<>();
    private final MutableLiveData<VerificationStartResponse> resetStarted = new MutableLiveData<>();
    private final MutableLiveData<VerificationStartResponse> resetCodeVerified = new MutableLiveData<>();
    private final MutableLiveData<String> resetPasswordSuccess = new MutableLiveData<>();
    private final MutableLiveData<String> authError = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>();

    public AuthViewModel() {
        authRepository = new AuthRepository();
    }

    public LiveData<AuthResponse> getAuthSuccess() {
        return authSuccess;
    }

    public LiveData<String> getAuthError() {
        return authError;
    }

    public LiveData<VerificationStartResponse> getVerificationStarted() {
        return verificationStarted;
    }

    public LiveData<Boolean> getLoading() {
        return loading;
    }

    public LiveData<VerificationStartResponse> getResetStarted() {
        return resetStarted;
    }

    public LiveData<VerificationStartResponse> getResetCodeVerified() {
        return resetCodeVerified;
    }

    public LiveData<String> getResetPasswordSuccess() {
        return resetPasswordSuccess;
    }

    public void signin(String email, String password) {
        loading.setValue(true);

        authRepository.signin(email, password).enqueue(new Callback<VerificationStartResponse>() {
            @Override
            public void onResponse(Call<VerificationStartResponse> call, Response<VerificationStartResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    verificationStarted.setValue(response.body());
                } else {
                    authError.setValue(extractErrorMessage(response, "Invalid email or password"));
                }
            }

            @Override
            public void onFailure(Call<VerificationStartResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    public void signup(String name, String username, String email, String password) {
        loading.setValue(true);

        authRepository.signup(name, username, email, password).enqueue(new Callback<VerificationStartResponse>() {
            @Override
            public void onResponse(Call<VerificationStartResponse> call, Response<VerificationStartResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    verificationStarted.setValue(response.body());
                } else {
                    authError.setValue(extractErrorMessage(response, "Signup failed. Email may already be used."));
                }
            }

            @Override
            public void onFailure(Call<VerificationStartResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    public void verifySignin(String challengeId, String code) {
        loading.setValue(true);

        authRepository.verifySignin(challengeId, code).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    authSuccess.setValue(response.body());
                } else {
                    authError.setValue(extractErrorMessage(response, "Invalid or expired verification code"));
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    public void verifySignup(String challengeId, String code) {
        loading.setValue(true);

        authRepository.verifySignup(challengeId, code).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    authSuccess.setValue(response.body());
                } else {
                    authError.setValue(extractErrorMessage(response, "Invalid or expired verification code"));
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    public void forgotPassword(String email) {
        loading.setValue(true);

        authRepository.forgotPassword(email).enqueue(new Callback<VerificationStartResponse>() {
            @Override
            public void onResponse(Call<VerificationStartResponse> call, Response<VerificationStartResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    resetStarted.setValue(response.body());
                } else {
                    authError.setValue(extractErrorMessage(response, "Failed to send reset code"));
                }
            }

            @Override
            public void onFailure(Call<VerificationStartResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    public void verifyResetCode(String challengeId, String code) {
        loading.setValue(true);

        authRepository.verifyResetCode(challengeId, code).enqueue(new Callback<VerificationStartResponse>() {
            @Override
            public void onResponse(Call<VerificationStartResponse> call, Response<VerificationStartResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    resetCodeVerified.setValue(response.body());
                } else {
                    authError.setValue(extractErrorMessage(response, "Invalid or expired reset code"));
                }
            }

            @Override
            public void onFailure(Call<VerificationStartResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    public void resetPassword(String challengeId, String password) {
        loading.setValue(true);

        authRepository.resetPassword(challengeId, password).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    String message = response.body().getMessage();
                    resetPasswordSuccess.setValue((message == null || message.trim().isEmpty()) ? "Password changed successfully" : message);
                } else {
                    authError.setValue(extractErrorMessage(response, "Failed to reset password"));
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    private <T> String extractErrorMessage(Response<T> response, String fallback) {
        try {
            if (response.errorBody() == null) {
                return fallback;
            }
            String errorJson = response.errorBody().string();
            JSONObject obj = new JSONObject(errorJson);
            String message = obj.optString("message", fallback);
            return (message == null || message.trim().isEmpty()) ? fallback : message;
        } catch (Exception ignored) {
            return fallback;
        }
    }
}
