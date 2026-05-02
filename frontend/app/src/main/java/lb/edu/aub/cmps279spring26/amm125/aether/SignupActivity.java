package lb.edu.aub.cmps279spring26.amm125.aether;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.text.method.HideReturnsTransformationMethod;
import android.text.method.PasswordTransformationMethod;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;

import lb.edu.aub.cmps279spring26.amm125.aether.utils.SessionManager;
import lb.edu.aub.cmps279spring26.amm125.aether.viewmodel.AuthViewModel;

public class SignupActivity extends AppCompatActivity {

    private EditText etName, etEmail, etPassword;
    private ImageView ivShowPassword;
    private boolean isPasswordVisible = false;

    private AuthViewModel authViewModel;
    private SessionManager sessionManager;
    private Button btnCreateAccount;
    private String pendingChallengeId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        sessionManager = new SessionManager(this);
        if (sessionManager.isLoggedIn() && sessionManager.getToken() != null) {
            Intent intent = new Intent(SignupActivity.this, HomeActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            finish();
            return;
        }

        setContentView(R.layout.activity_signup);

        etName = findViewById(R.id.etName);
        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        ivShowPassword = findViewById(R.id.ivShowPassword);
        TextView tvSignIn = findViewById(R.id.tvSignIn);

        ImageButton btnBack = findViewById(R.id.btnBack);
        btnCreateAccount = findViewById(R.id.btnCreateAccount);

        authViewModel = new ViewModelProvider(this).get(AuthViewModel.class);

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

        tvSignIn.setOnClickListener(v -> {
            Intent intent = new Intent(SignupActivity.this, SigninActivity.class);
            startActivity(intent);
            finish();
        });

        btnCreateAccount.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String email = etEmail.getText().toString().trim();
            String password = etPassword.getText().toString().trim();

            if (TextUtils.isEmpty(name)) {
                etName.setError("Name is required");
                return;
            }

            if (TextUtils.isEmpty(email)) {
                etEmail.setError("Email is required");
                return;
            }

            if (TextUtils.isEmpty(password)) {
                etPassword.setError("Password is required");
                return;
            }

            if (password.length() < 6) {
                etPassword.setError("Password must be at least 6 characters");
                return;
            }

            authViewModel.signup(name, email, password);
        });

        authViewModel.getLoading().observe(this, isLoading -> {
            if (isLoading != null && isLoading) {
                btnCreateAccount.setEnabled(false);
                btnCreateAccount.setText("Creating...");
            } else {
                btnCreateAccount.setEnabled(true);
                btnCreateAccount.setText("Create Account");
            }
        });

        authViewModel.getAuthSuccess().observe(this, authResponse -> {
            if (authResponse != null && authResponse.getUser() != null) {
                sessionManager.saveSession(authResponse.getToken(), authResponse.getUser());

                Toast.makeText(SignupActivity.this, "Account created successfully", Toast.LENGTH_SHORT).show();

                Intent intent = new Intent(SignupActivity.this, HomeActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            }
        });

        authViewModel.getVerificationStarted().observe(this, verificationStartResponse -> {
            if (verificationStartResponse != null && !TextUtils.isEmpty(verificationStartResponse.getChallengeId())) {
                pendingChallengeId = verificationStartResponse.getChallengeId();
                showOtpDialog();
            }
        });

        authViewModel.getAuthError().observe(this, error -> {
            if (error != null) {
                Toast.makeText(SignupActivity.this, error, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void showOtpDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_verification_code, null);
        final EditText input = dialogView.findViewById(R.id.etOtpCode);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .setCancelable(false)
                .setPositiveButton("Verify", null)
                .setNegativeButton("Cancel", (dialogInterface, which) -> dialogInterface.dismiss())
                .create();

        dialog.setOnShowListener(dialogInterface -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                    String code = input.getText().toString().trim();
                    if (TextUtils.isEmpty(code) || code.length() != 6) {
                        input.setError("Enter a valid 6-digit code");
                        return;
                    }
                    input.setError(null);
                    authViewModel.verifySignup(pendingChallengeId, code);
                    dialog.dismiss();
                }));

        dialog.show();
    }
}
