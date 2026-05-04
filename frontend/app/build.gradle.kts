import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "lb.edu.aub.cmps279spring26.amm125.aether"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "lb.edu.aub.cmps279spring26.amm125.aether"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        val properties = Properties()
        val localPropertiesFile = rootProject.file("local.properties")
        if (localPropertiesFile.exists()) {
            properties.load(localPropertiesFile.inputStream())
        }
        buildConfigField("String", "CLIENT_SECRET_KEY", "\"${properties.getProperty("CLIENT_SECRET_KEY", "")}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.appcompat)
    implementation(libs.material)
    implementation(libs.activity)
    implementation(libs.constraintlayout)
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    // Retrofit for connecting Android to backend API
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Glide for image loading
    implementation("com.github.bumptech.glide:glide:4.16.0")

    // Gson for converting JSON to Java objects
    implementation("com.google.code.gson:gson:2.11.0")

    // MVVM: ViewModel and LiveData
    implementation("androidx.lifecycle:lifecycle-viewmodel:2.8.7")
    implementation("androidx.lifecycle:lifecycle-livedata:2.8.7")

    testImplementation(libs.junit)
    androidTestImplementation(libs.ext.junit)
    androidTestImplementation(libs.espresso.core)
}
