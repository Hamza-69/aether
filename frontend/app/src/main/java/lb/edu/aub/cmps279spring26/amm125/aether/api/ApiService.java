package lb.edu.aub.cmps279spring26.amm125.aether.api;

import lb.edu.aub.cmps279spring26.amm125.aether.model.AuthResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.EmailRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.LoginRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ResetPasswordRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SignupRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.VerificationRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.VerificationStartResponse;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface ApiService {

    @POST("auth/signup")
    Call<VerificationStartResponse> signup(@Body SignupRequest signupRequest);

    @POST("auth/signin")
    Call<VerificationStartResponse> signin(@Body LoginRequest loginRequest);

    @POST("auth/signup/verify")
    Call<AuthResponse> verifySignup(@Body VerificationRequest verificationRequest);

    @POST("auth/signin/verify")
    Call<AuthResponse> verifySignin(@Body VerificationRequest verificationRequest);

    @POST("auth/password/forgot")
    Call<VerificationStartResponse> forgotPassword(@Body EmailRequest emailRequest);

    @POST("auth/password/verify")
    Call<VerificationStartResponse> verifyResetCode(@Body VerificationRequest verificationRequest);

    @POST("auth/password/reset")
    Call<AuthResponse> resetPassword(@Body ResetPasswordRequest resetPasswordRequest);
}
