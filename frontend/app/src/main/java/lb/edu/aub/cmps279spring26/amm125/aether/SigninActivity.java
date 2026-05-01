package lb.edu.aub.cmps279spring26.amm125.aether;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.text.method.HideReturnsTransformationMethod;
import android.text.method.PasswordTransformationMethod;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;

import lb.edu.aub.cmps279spring26.amm125.aether.utils.SessionManager;
import lb.edu.aub.cmps279spring26.amm125.aether.viewmodel.AuthViewModel;

public class SigninActivity extends AppCompatActivity {

    private EditText etEmail, etPassword;
    private ImageView ivShowPassword;
    private boolean isPasswordVisible = false;

    private AuthViewModel authViewModel;
    private SessionManager sessionManager;
    private Button btnSignIn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_signin);

        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        ivShowPassword = findViewById(R.id.ivShowPassword);
        ImageButton btnBack = findViewById(R.id.btnBack);
        btnSignIn = findViewById(R.id.btnSignIn);
        TextView tvSignUp = findViewById(R.id.tvSignUp);

        authViewModel = new ViewModelProvider(this).get(AuthViewModel.class);
        sessionManager = new SessionManager(this);

        btnBack.setOnClickListener(v -> onBackPressed());

        ivShowPassword.setOnClickListener(v -> {
            if (isPasswordVisible) {
                etPassword.setTransformationMethod(PasswordTransformationMethod.getInstance());
                ivShowPassword.setImageResource(android.R.drawable.ic_menu_view);
                isPasswordVisible = false;
            } else {
                etPassword.setTransformationMethod(HideReturnsTransformationMethod.getInstance());
                ivShowPassword.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
                isPasswordVisible = true;
            }
            etPassword.setSelection(etPassword.getText().length());
        });

        btnSignIn.setOnClickListener(v -> {
            String email = etEmail.getText().toString().trim();
            String password = etPassword.getText().toString().trim();

            if (TextUtils.isEmpty(email)) {
                etEmail.setError("Email is required");
                return;
            }

            if (TextUtils.isEmpty(password)) {
                etPassword.setError("Password is required");
                return;
            }

            authViewModel.signin(email, password);
        });

        authViewModel.getLoading().observe(this, isLoading -> {
            if (isLoading != null && isLoading) {
                btnSignIn.setEnabled(false);
                btnSignIn.setText("Signing in...");
            } else {
                btnSignIn.setEnabled(true);
                btnSignIn.setText("Sign In");
            }
        });

        authViewModel.getAuthSuccess().observe(this, authResponse -> {
            if (authResponse != null && authResponse.getUser() != null) {
                sessionManager.saveSession(authResponse.getToken(), authResponse.getUser());

                Toast.makeText(SigninActivity.this, "Signin successful", Toast.LENGTH_SHORT).show();

                Intent intent = new Intent(SigninActivity.this, HomeActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            }
        });

        authViewModel.getAuthError().observe(this, error -> {
            if (error != null) {
                Toast.makeText(SigninActivity.this, error, Toast.LENGTH_LONG).show();
            }
        });

        tvSignUp.setOnClickListener(v -> {
            Intent intent = new Intent(SigninActivity.this, SignupActivity.class);
            startActivity(intent);
            finish();
        });
    }
}