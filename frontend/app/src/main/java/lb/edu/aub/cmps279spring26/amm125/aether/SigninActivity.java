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

public class SigninActivity extends AppCompatActivity {

    private EditText etEmail, etPassword;
    private ImageView ivShowPassword;
    private boolean isPasswordVisible = false;

    private AuthViewModel authViewModel;
    private SessionManager sessionManager;
    private Button btnSignIn;
    private String pendingChallengeId;
    private String pendingResetChallengeId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        sessionManager = new SessionManager(this);
        if (sessionManager.isLoggedIn() && sessionManager.getToken() != null) {
            Intent intent = new Intent(SigninActivity.this, HomeActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            finish();
            return;
        }

        setContentView(R.layout.activity_signin);

        etEmail = findViewById(R.id.etEmail);
        etPassword = findViewById(R.id.etPassword);
        ivShowPassword = findViewById(R.id.ivShowPassword);
        ImageButton btnBack = findViewById(R.id.btnBack);
        btnSignIn = findViewById(R.id.btnSignIn);
        TextView tvSignUp = findViewById(R.id.tvSignUp);
        TextView tvForgotPassword = findViewById(R.id.tvForgotPassword);

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

        authViewModel.getVerificationStarted().observe(this, verificationStartResponse -> {
            if (verificationStartResponse != null && !TextUtils.isEmpty(verificationStartResponse.getChallengeId())) {
                pendingChallengeId = verificationStartResponse.getChallengeId();
                showOtpDialog();
            }
        });

        authViewModel.getAuthError().observe(this, error -> {
            if (error != null) {
                Toast.makeText(SigninActivity.this, error, Toast.LENGTH_LONG).show();
            }
        });

        authViewModel.getResetStarted().observe(this, verificationStartResponse -> {
            if (verificationStartResponse != null && !TextUtils.isEmpty(verificationStartResponse.getChallengeId())) {
                pendingResetChallengeId = verificationStartResponse.getChallengeId();
                showResetCodeDialog();
            }
        });

        authViewModel.getResetCodeVerified().observe(this, verificationStartResponse -> {
            if (verificationStartResponse != null && !TextUtils.isEmpty(verificationStartResponse.getChallengeId())) {
                pendingResetChallengeId = verificationStartResponse.getChallengeId();
                showResetPasswordDialog();
            }
        });

        authViewModel.getResetPasswordSuccess().observe(this, message -> {
            if (!TextUtils.isEmpty(message)) {
                Toast.makeText(SigninActivity.this, message, Toast.LENGTH_LONG).show();
            }
        });

        tvSignUp.setOnClickListener(v -> {
            Intent intent = new Intent(SigninActivity.this, SignupActivity.class);
            startActivity(intent);
            finish();
        });

        tvForgotPassword.setOnClickListener(v -> showForgotPasswordDialog());
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
                    authViewModel.verifySignin(pendingChallengeId, code);
                    dialog.dismiss();
                }));

        dialog.show();
    }

    private void showForgotPasswordDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_forgot_password_email, null);
        final EditText input = dialogView.findViewById(R.id.etResetEmail);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .setCancelable(false)
                .setPositiveButton("Send Reset Code", null)
                .setNegativeButton("Cancel", (dialogInterface, which) -> dialogInterface.dismiss())
                .create();

        dialog.setOnShowListener(dialogInterface -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String email = input.getText().toString().trim();
            if (TextUtils.isEmpty(email)) {
                input.setError("Email is required");
                return;
            }
            input.setError(null);
            authViewModel.forgotPassword(email);
            dialog.dismiss();
        }));

        dialog.show();
    }

    private void showResetCodeDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_verification_code, null);
        final EditText input = dialogView.findViewById(R.id.etOtpCode);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .setCancelable(false)
                .setPositiveButton("Verify Code", null)
                .setNegativeButton("Cancel", (dialogInterface, which) -> dialogInterface.dismiss())
                .create();

        dialog.setOnShowListener(dialogInterface -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String code = input.getText().toString().trim();
            if (TextUtils.isEmpty(code) || code.length() != 6) {
                input.setError("Enter a valid 6-digit code");
                return;
            }
            input.setError(null);
            authViewModel.verifyResetCode(pendingResetChallengeId, code);
            dialog.dismiss();
        }));

        dialog.show();
    }

    private void showResetPasswordDialog() {
        View dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_reset_password, null);
        final EditText etNewPassword = dialogView.findViewById(R.id.etNewPassword);
        final EditText etConfirmNewPassword = dialogView.findViewById(R.id.etConfirmNewPassword);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setView(dialogView)
                .setCancelable(false)
                .setPositiveButton("Confirm", null)
                .setNegativeButton("Cancel", (dialogInterface, which) -> dialogInterface.dismiss())
                .create();

        dialog.setOnShowListener(dialogInterface -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String newPassword = etNewPassword.getText().toString().trim();
            String confirmNewPassword = etConfirmNewPassword.getText().toString().trim();

            if (TextUtils.isEmpty(newPassword)) {
                etNewPassword.setError("New password is required");
                return;
            }
            if (newPassword.length() < 6) {
                etNewPassword.setError("Password must be at least 6 characters");
                return;
            }
            if (TextUtils.isEmpty(confirmNewPassword)) {
                etConfirmNewPassword.setError("Confirm password is required");
                return;
            }
            if (!newPassword.equals(confirmNewPassword)) {
                etConfirmNewPassword.setError("Passwords do not match");
                return;
            }

            etConfirmNewPassword.setError(null);
            authViewModel.resetPassword(pendingResetChallengeId, newPassword);
            dialog.dismiss();
        }));

        dialog.show();
    }
}
