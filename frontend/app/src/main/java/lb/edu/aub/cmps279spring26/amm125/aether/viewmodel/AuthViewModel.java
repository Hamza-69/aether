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

    public void signup(String name, String email, String password) {
        loading.setValue(true);

        authRepository.signup(name, email, password).enqueue(new Callback<VerificationStartResponse>() {
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
