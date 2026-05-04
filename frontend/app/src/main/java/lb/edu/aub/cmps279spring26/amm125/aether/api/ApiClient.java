package lb.edu.aub.cmps279spring26.amm125.aether.api;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;
import lb.edu.aub.cmps279spring26.amm125.aether.AetherApplication;
import lb.edu.aub.cmps279spring26.amm125.aether.utils.SessionManager;

public class ApiClient {

    private static final String BASE_URL = "https://cmps-279-aether.fly.dev/api/";

    private static Retrofit retrofit = null;
    private static OkHttpClient okHttpClient = null;

    public static OkHttpClient getOkHttpClient() {
        if (okHttpClient == null) {
            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BODY);

            okHttpClient = new OkHttpClient.Builder()
                    .addInterceptor(logging)
                    .addInterceptor(chain -> {
                        Request original = chain.request();
                        SessionManager sessionManager = new SessionManager(AetherApplication.getAppContext());
                        String token = sessionManager.getToken();
                        if (token != null) {
                            Request request = original.newBuilder()
                                    .header("Authorization", "Bearer " + token)
                                    .build();
                            return chain.proceed(request);
                        }
                        return chain.proceed(original);
                    })
                    .build();
        }
        return okHttpClient;
    }

    public static ApiService getApiService() {
        if (retrofit == null) {
            retrofit = new Retrofit.Builder()
                    .baseUrl(BASE_URL)
                    .client(getOkHttpClient())
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }

        return retrofit.create(ApiService.class);
    }
}