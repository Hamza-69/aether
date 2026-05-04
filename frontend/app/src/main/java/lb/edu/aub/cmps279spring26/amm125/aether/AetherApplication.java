package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Application;
import android.content.Context;

public class AetherApplication extends Application {
    private static Context appContext;

    @Override
    public void onCreate() {
        super.onCreate();
        appContext = getApplicationContext();
    }

    public static Context getAppContext() {
        return appContext;
    }
}
