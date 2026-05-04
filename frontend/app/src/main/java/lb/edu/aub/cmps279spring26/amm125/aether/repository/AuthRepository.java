package lb.edu.aub.cmps279spring26.amm125.aether.repository;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.AuthResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.EmailRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.LoginRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ResetPasswordRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SignupRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.VerificationRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.VerificationStartResponse;
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

    public Call<VerificationStartResponse> signup(String name, String username, String email, String password) {
        SignupRequest signupRequest = new SignupRequest(name, username, email, password);
        return apiService.signup(signupRequest);
    }

    public Call<AuthResponse> verifySignin(String challengeId, String code) {
        VerificationRequest verificationRequest = new VerificationRequest(challengeId, code);
        return apiService.verifySignin(verificationRequest);
    }

    public Call<AuthResponse> verifySignup(String challengeId, String code) {
        VerificationRequest verificationRequest = new VerificationRequest(challengeId, code);
        return apiService.verifySignup(verificationRequest);
    }

    public Call<VerificationStartResponse> forgotPassword(String email) {
        EmailRequest emailRequest = new EmailRequest(email);
        return apiService.forgotPassword(emailRequest);
    }

    public Call<VerificationStartResponse> verifyResetCode(String challengeId, String code) {
        VerificationRequest verificationRequest = new VerificationRequest(challengeId, code);
        return apiService.verifyResetCode(verificationRequest);
    }

    public Call<AuthResponse> resetPassword(String challengeId, String password) {
        ResetPasswordRequest resetPasswordRequest = new ResetPasswordRequest(challengeId, password);
        return apiService.resetPassword(resetPasswordRequest);
    }
}
