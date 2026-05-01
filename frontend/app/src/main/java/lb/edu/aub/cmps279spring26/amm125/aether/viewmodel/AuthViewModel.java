package lb.edu.aub.cmps279spring26.amm125.aether.viewmodel;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;

import lb.edu.aub.cmps279spring26.amm125.aether.model.AuthResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.repository.AuthRepository;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AuthViewModel extends ViewModel {

    private final AuthRepository authRepository;

    private final MutableLiveData<AuthResponse> authSuccess = new MutableLiveData<>();
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

    public LiveData<Boolean> getLoading() {
        return loading;
    }

    public void signin(String email, String password) {
        loading.setValue(true);

        authRepository.signin(email, password).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    authSuccess.setValue(response.body());
                } else {
                    authError.setValue("Invalid email or password");
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }

    public void signup(String name, String email, String password) {
        loading.setValue(true);

        authRepository.signup(name, email, password).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                loading.setValue(false);

                if (response.isSuccessful() && response.body() != null) {
                    authSuccess.setValue(response.body());
                } else {
                    authError.setValue("Signup failed. Email may already be used.");
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                loading.setValue(false);
                authError.setValue("Connection failed: " + t.getMessage());
            }
        });
    }
}