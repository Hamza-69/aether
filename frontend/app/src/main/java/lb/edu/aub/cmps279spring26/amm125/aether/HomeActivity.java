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
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.android.material.card.MaterialCardView;
import java.util.ArrayList;
import java.util.List;

public class HomeActivity extends AppCompatActivity {

    private RecyclerView rvProjects;
    private ProjectAdapter adapter;
    public static List<Project> userProjects = new ArrayList<>();
    private TextView tvProjectCount;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_home);

        rvProjects = findViewById(R.id.rvProjects);
        tvProjectCount = findViewById(R.id.tvProjectCount);
        BottomNavigationView bottomNav = findViewById(R.id.bottomNav);
        FloatingActionButton fabAdd = findViewById(R.id.fabAdd);

        if (userProjects.isEmpty()) {
            userProjects.add(new Project("Fitness Tracker", "Modern UI for health tracking", "Published"));
            userProjects.add(new Project("E-commerce App", "AI-driven shopping experience", "Draft"));
            userProjects.add(new Project("Smart Home", "Control your home appliances", "Published"));
            userProjects.add(new Project("Recipe Finder", "Find dishes by ingredients", "Published"));
        }

        updateProjectCount();

        adapter = new ProjectAdapter(userProjects, this::updateProjectCount);
        rvProjects.setLayoutManager(new LinearLayoutManager(this));
        rvProjects.setAdapter(adapter);

        fabAdd.setOnClickListener(v -> showCreateProjectDialog());

        View btnSearch = findViewById(R.id.btnSearchContainer);
        if (btnSearch != null) {
            btnSearch.setOnClickListener(v -> showSearchDialog(userProjects));
        }

        bottomNav.setSelectedItemId(R.id.nav_home);
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_home) return true;
            else if (id == R.id.nav_discover) {
                startActivity(new Intent(this, DiscoverActivity.class));
                overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left);
                finish();
                return true;
            }
            return true;
        });
    }

    private void showSearchDialog(List<Project> sourceList) {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_search);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            dialog.getWindow().setGravity(Gravity.TOP);
            
            // Add margin from top
            android.view.WindowManager.LayoutParams params = dialog.getWindow().getAttributes();
            params.y = 40; 
            dialog.getWindow().setAttributes(params);
        }

        EditText etSearch = dialog.findViewById(R.id.etSearch);
        ImageView ivClear = dialog.findViewById(R.id.ivClearSearch);
        RecyclerView rvResults = dialog.findViewById(R.id.rvSearchResults);
        
        MaterialCardView btnMyProjects = dialog.findViewById(R.id.btnSearchMyProjects);
        MaterialCardView btnDiscover = dialog.findViewById(R.id.btnSearchDiscover);
        TextView tvMyProjects = dialog.findViewById(R.id.tvSearchMyProjects);
        TextView tvDiscover = dialog.findViewById(R.id.tvSearchDiscover);
        
        // Initial state for Home: My Projects selected
        etSearch.setHint("Search your projects...");
        btnMyProjects.setCardBackgroundColor(Color.parseColor("#7C4DFF"));
        tvMyProjects.setTextColor(Color.WHITE);
        btnDiscover.setCardBackgroundColor(Color.parseColor("#F5F5F5"));
        tvDiscover.setTextColor(Color.parseColor("#1A1A1A"));

        List<Project> searchResults = new ArrayList<>();
        ProjectAdapter searchAdapter = new ProjectAdapter(searchResults, null);
        rvResults.setLayoutManager(new LinearLayoutManager(this));
        rvResults.setAdapter(searchAdapter);

        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                String query = s.toString().toLowerCase().trim();
                ivClear.setVisibility(query.isEmpty() ? View.GONE : View.VISIBLE);

                searchResults.clear();
                if (!query.isEmpty()) {
                    for (Project p : sourceList) {
                        if (p.getTitle().toLowerCase().contains(query) || p.getDescription().toLowerCase().contains(query)) {
                            searchResults.add(p);
                        }
                    }
                }
                searchAdapter.notifyDataSetChanged();
            }
            @Override
            public void afterTextChanged(Editable s) {}
        });

        ivClear.setOnClickListener(v -> etSearch.setText(""));
        
        ImageView ivClose = dialog.findViewById(R.id.ivCloseSearch);
        if (ivClose != null) {
            ivClose.setOnClickListener(v -> dialog.dismiss());
        }

        dialog.show();
    }

    private void showCreateProjectDialog() {
        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_create_project);
        dialog.show();

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        View ivClose = dialog.findViewById(R.id.ivClose);
        Button btnCreate = dialog.findViewById(R.id.btnCreate);
        EditText etName = dialog.findViewById(R.id.etProjectName);
        EditText etDesc = dialog.findViewById(R.id.etProjectDesc);

        ivClose.setOnClickListener(v -> dialog.dismiss());

        btnCreate.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String desc = etDesc.getText().toString().trim();
            if (!TextUtils.isEmpty(name)) {
                userProjects.add(0, new Project(name, desc, "Not Published"));
                adapter.notifyItemInserted(0);
                updateProjectCount();
                dialog.dismiss();
            }
        });
    }

    private void updateProjectCount() {
        tvProjectCount.setText(userProjects.size() + " total");
    }
}
