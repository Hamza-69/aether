package lb.edu.aub.cmps279spring26.amm125.aether.repository;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.AuthResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.LoginRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SignupRequest;
import retrofit2.Call;

public class AuthRepository {

    private final ApiService apiService;

    public AuthRepository() {
        apiService = ApiClient.getApiService();
    }

    public Call<AuthResponse> signin(String email, String password) {
        LoginRequest loginRequest = new LoginRequest(email, password);
        return apiService.signin(loginRequest);
    }

    public Call<AuthResponse> signup(String name, String email, String password) {
        SignupRequest signupRequest = new SignupRequest(name, email, password);
        return apiService.signup(signupRequest);
    }
}