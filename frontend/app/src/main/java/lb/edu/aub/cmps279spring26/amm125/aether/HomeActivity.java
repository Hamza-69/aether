package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Dialog;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;

public class HomeActivity extends AppCompatActivity {

    private RecyclerView rvProjects;
    private ProjectAdapter adapter;
    private List<Project> projectList;
    private TextView tvProjectCount;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_home);

        rvProjects = findViewById(R.id.rvProjects);
        tvProjectCount = findViewById(R.id.tvProjectCount);
        BottomNavigationView bottomNav = findViewById(R.id.bottomNav);
        FloatingActionButton fabAdd = findViewById(R.id.fabAdd);

        projectList = new ArrayList<>();

        projectList.add(new Project("Fitness Tracker", "Modern UI for health tracking", "Published"));
        projectList.add(new Project("E-commerce App", "AI-driven shopping experience", "Draft"));
        projectList.add(new Project("Smart Home", "Control your home appliances", "Published"));
        projectList.add(new Project("Recipe Finder", "Find dishes by ingredients", "Published"));

        updateProjectCount();

        adapter = new ProjectAdapter(projectList, this::updateProjectCount);
        rvProjects.setLayoutManager(new LinearLayoutManager(this));
        rvProjects.setAdapter(adapter);

        fabAdd.setOnClickListener(v -> showCreateProjectDialog());

        bottomNav.setSelectedItemId(R.id.nav_home);

        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();

            if (id == R.id.nav_home) {
                return true;
            }

            return true;
        });
    }

    private void showCreateProjectDialog() {
        final Dialog dialog = new Dialog(this);

        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_create_project);

        dialog.show();

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
        }

        View ivClose = dialog.findViewById(R.id.ivClose);
        Button btnCancel = dialog.findViewById(R.id.btnCancel);
        Button btnCreate = dialog.findViewById(R.id.btnCreate);

        EditText etName = dialog.findViewById(R.id.etProjectName);
        EditText etDesc = dialog.findViewById(R.id.etProjectDesc);

        ChipGroup chipGroup = dialog.findViewById(R.id.chipGroupSuggestions);

        ivClose.setOnClickListener(v -> dialog.dismiss());
        btnCancel.setOnClickListener(v -> dialog.dismiss());

        btnCreate.setEnabled(false);
        btnCreate.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#E0E0E0")));

        if (chipGroup != null) {
            for (int i = 0; i < chipGroup.getChildCount(); i++) {
                View child = chipGroup.getChildAt(i);
                if (child instanceof Chip) {
                    Chip chip = (Chip) child;
                    chip.setOnClickListener(v -> {
                        String suggestion = chip.getText().toString();

                        if (suggestion.equals("Task Manager")) {
                            etName.setText("Task Management App");
                            etDesc.setText("Create a comprehensive task management application that includes features like user authentication, categories, due dates, priority levels, and progress tracking with data visualization.");
                        } else if (suggestion.equals("Recipe Finder")) {
                            etName.setText("AI Recipe Finder");
                            etDesc.setText("Build an AI-powered recipe discovery app where users can input available ingredients to receive meal suggestions, step-by-step cooking instructions, and nutritional information.");
                        } else if (suggestion.equals("Habit Tracker")) {
                            etName.setText("Daily Habit Tracker");
                            etDesc.setText("Design a habit tracking tool that helps users form positive routines through streaks, customizable reminders, daily logs, and insightful analytics on their performance.");
                        }
                    });
                }
            }
        }

        TextWatcher createWatcher = new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                boolean hasName = !TextUtils.isEmpty(etName.getText().toString().trim());
                boolean hasDesc = !TextUtils.isEmpty(etDesc.getText().toString().trim());

                if (hasName && hasDesc) {
                    btnCreate.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#00B0FF")));
                    btnCreate.setEnabled(true);
                    btnCreate.setTextColor(Color.WHITE);
                } else {
                    btnCreate.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#E0E0E0")));
                    btnCreate.setEnabled(false);
                    btnCreate.setTextColor(Color.parseColor("#9E9E9E"));
                }
            }

            @Override
            public void afterTextChanged(Editable s) {}
        };

        etName.addTextChangedListener(createWatcher);
        etDesc.addTextChangedListener(createWatcher);

        btnCreate.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String desc = etDesc.getText().toString().trim();
            String status = "Not Published";

            if (!TextUtils.isEmpty(name) && !TextUtils.isEmpty(desc)) {
                projectList.add(0, new Project(name, desc, status));
                adapter.notifyItemInserted(0);
                rvProjects.scrollToPosition(0);
                updateProjectCount();
                dialog.dismiss();

                Intent intent = new Intent(HomeActivity.this, ChatActivity.class);
                intent.putExtra("PROJECT_TITLE", name);
                intent.putExtra("PROJECT_DESC", desc);
                intent.putExtra("PROJECT_STATUS", status);
                startActivity(intent);
            }
        });
    }

    private void updateProjectCount() {
        tvProjectCount.setText(projectList.size() + " total");
    }
}
