package lb.edu.aub.cmps279spring26.amm125.aether.api;

import lb.edu.aub.cmps279spring26.amm125.aether.model.AuthResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ActionResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.CreateProjectRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.CurrentUserResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.DiscoverResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.EmailRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.GenerateKeystoreRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.LoginRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.MessagesResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProfilePictureRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProfilePictureResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectsResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectWrapperResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.RealtimeTokenRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.RealtimeTokenResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ResetPasswordRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SendMessageRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SecretsWriteResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.SignupRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertProjectSecretsRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.UpsertUserSecretsRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.VerificationRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.VerificationStartResponse;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.Path;
import retrofit2.http.POST;
import retrofit2.http.PUT;

public interface ApiService {

    @POST("auth/signup")
    Call<VerificationStartResponse> signup(@Body SignupRequest signupRequest);

    @POST("auth/signin")
    Call<AuthResponse> signin(@Body LoginRequest loginRequest);

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

    @GET("projects")
    Call<ProjectsResponse> getProjects();

    @GET("projects/{projectId}")
    Call<ProjectWrapperResponse> getProject(@Path("projectId") String projectId);

    @POST("projects")
    Call<ProjectWrapperResponse> createProject(@Body CreateProjectRequest createProjectRequest);

    @GET("discover")
    Call<DiscoverResponse> getDiscoverProjects();

    @POST("discover/{id}/clone")
    Call<ProjectWrapperResponse> cloneDiscoverProject(@Path("id") String publishedProjectId);

    @GET("projects/{projectId}/messages")
    Call<MessagesResponse> getProjectMessages(@Path("projectId") String projectId);

    @POST("projects/{projectId}/messages")
    Call<ActionResponse> sendProjectMessage(@Path("projectId") String projectId, @Body SendMessageRequest sendMessageRequest);

    @POST("realtime")
    Call<RealtimeTokenResponse> createRealtimeToken(@Body RealtimeTokenRequest realtimeTokenRequest);

    @POST("projects/{projectId}/deploy")
    Call<ActionResponse> deployProject(@Path("projectId") String projectId);

    @POST("projects/{projectId}/keystore")
    Call<ActionResponse> generateKeystore(@Path("projectId") String projectId, @Body GenerateKeystoreRequest request);

    @POST("projects/{projectId}/export-apk")
    Call<ActionResponse> exportApk(@Path("projectId") String projectId);

    @POST("projects/{projectId}/preview")
    Call<ActionResponse> runPreview(@Path("projectId") String projectId);

    @POST("projects/{projectId}/preview/restart")
    Call<ActionResponse> restartPreview(@Path("projectId") String projectId);

    @POST("projects/{projectId}/publish")
    Call<ActionResponse> publishProject(@Path("projectId") String projectId);

    @POST("projects/{projectId}/unpublish")
    Call<ActionResponse> unpublishProject(@Path("projectId") String projectId);

    @GET("auth/me")
    Call<CurrentUserResponse> getCurrentUser();

    @PUT("auth/me/profile-picture")
    Call<ProfilePictureResponse> uploadProfilePicture(@Body ProfilePictureRequest profilePictureRequest);

    @DELETE("auth/me/profile-picture")
    Call<ActionResponse> deleteProfilePicture();

    @GET("secrets")
    Call<SecretsResponse> getUserSecrets();

    @POST("secrets")
    Call<SecretsWriteResponse> upsertUserSecrets(@Body UpsertUserSecretsRequest request);

    @DELETE("secrets/{name}")
    Call<Void> deleteUserSecret(@Path("name") String name);

    @GET("projects/{projectId}/secrets")
    Call<SecretsResponse> getProjectSecrets(@Path("projectId") String projectId);

    @POST("projects/{projectId}/secrets")
    Call<SecretsWriteResponse> upsertProjectSecrets(@Path("projectId") String projectId, @Body UpsertProjectSecretsRequest request);

    @DELETE("projects/{projectId}/secrets/{name}")
    Call<Void> deleteProjectSecret(@Path("projectId") String projectId, @Path("name") String name);
}
