package lb.edu.aub.cmps279spring26.amm125.aether.api;

import lb.edu.aub.cmps279spring26.amm125.aether.model.AuthResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.LoginRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SignupRequest;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface ApiService {

    @POST("auth/signup")
    Call<AuthResponse> signup(@Body SignupRequest signupRequest);

    @POST("auth/signin")
    Call<AuthResponse> signin(@Body LoginRequest loginRequest);
}