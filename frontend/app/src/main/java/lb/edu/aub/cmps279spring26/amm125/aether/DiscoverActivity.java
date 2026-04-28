package lb.edu.aub.cmps279spring26.amm125.aether;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.card.MaterialCardView;
import java.util.ArrayList;
import java.util.List;

public class DiscoverActivity extends AppCompatActivity {

    private RecyclerView rvDiscover;
    private DiscoverAdapter adapter;
    private List<Project> displayedList = new ArrayList<>();
    private TextView tvCount;
    
    private MaterialCardView btnAll, btnProjects, btnTemplates;
    private TextView tvAll, tvProjects, tvTemplates;
    
    private View searchBarContainer;
    private EditText etSearch;
    private String currentTypeFilter = "All";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_discover);

        rvDiscover = findViewById(R.id.rvDiscover);
        tvCount = findViewById(R.id.tvDiscoverCount);
        
        btnAll = findViewById(R.id.btnFilterAll);
        btnProjects = findViewById(R.id.btnFilterProjects);
        btnTemplates = findViewById(R.id.btnFilterTemplates);
        
        tvAll = findViewById(R.id.tvFilterAll);
        tvProjects = findViewById(R.id.tvFilterProjects);
        tvTemplates = findViewById(R.id.tvFilterTemplates);

        searchBarContainer = findViewById(R.id.searchBarContainer);
        etSearch = findViewById(R.id.etSearchDiscover);
        ImageView ivCloseSearch = findViewById(R.id.ivCloseSearch);
        ImageView btnSearch = findViewById(R.id.btnSearch);

        displayedList.addAll(HomeActivity.communityProjects);
        
        adapter = new DiscoverAdapter(displayedList);
        rvDiscover.setLayoutManager(new LinearLayoutManager(this));
        rvDiscover.setAdapter(adapter);

        setupFilters();

        btnSearch.setOnClickListener(v -> {
            searchBarContainer.setVisibility(View.VISIBLE);
            etSearch.requestFocus();
        });

        if (ivCloseSearch != null) {
            ivCloseSearch.setOnClickListener(v -> {
                etSearch.setText("");
                searchBarContainer.setVisibility(View.GONE);
                applyFilters();
            });
        }

        etSearch.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                applyFilters();
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        BottomNavigationView bottomNav = findViewById(R.id.bottomNav);
        bottomNav.setSelectedItemId(R.id.nav_discover);
        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_home) {
                startActivity(new Intent(this, HomeActivity.class));
                overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right);
                finish();
                return true;
            }
            return id == R.id.nav_discover;
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyFilters();
    }

    private void setupFilters() {
        btnAll.setOnClickListener(v -> {
            currentTypeFilter = "All";
            applyFilters();
        });
        btnProjects.setOnClickListener(v -> {
            currentTypeFilter = "Project";
            applyFilters();
        });
        btnTemplates.setOnClickListener(v -> {
            currentTypeFilter = "Template";
            applyFilters();
        });
    }

    private void applyFilters() {
        // UI feedback for filter buttons
        btnAll.setCardBackgroundColor(Color.parseColor("#F5F5F5"));
        tvAll.setTextColor(Color.parseColor("#1A1A1A"));
        btnProjects.setCardBackgroundColor(Color.parseColor("#F5F5F5"));
        tvProjects.setTextColor(Color.parseColor("#1A1A1A"));
        btnTemplates.setCardBackgroundColor(Color.parseColor("#F5F5F5"));
        tvTemplates.setTextColor(Color.parseColor("#1A1A1A"));

        if (currentTypeFilter.equals("All")) {
            btnAll.setCardBackgroundColor(Color.parseColor("#7C4DFF"));
            tvAll.setTextColor(Color.WHITE);
        } else if (currentTypeFilter.equals("Project")) {
            btnProjects.setCardBackgroundColor(Color.parseColor("#7C4DFF"));
            tvProjects.setTextColor(Color.WHITE);
        } else {
            btnTemplates.setCardBackgroundColor(Color.parseColor("#7C4DFF"));
            tvTemplates.setTextColor(Color.WHITE);
        }

        // Logical filtering
        String query = etSearch.getText().toString().toLowerCase().trim();
        displayedList.clear();

        for (Project p : HomeActivity.communityProjects) {
            boolean matchesType = currentTypeFilter.equals("All") || p.getType().equalsIgnoreCase(currentTypeFilter);
            boolean matchesQuery = query.isEmpty() || p.getTitle().toLowerCase().contains(query) || p.getDescription().toLowerCase().contains(query);
            
            if (matchesType && matchesQuery) {
                displayedList.add(p);
            }
        }
        
        adapter.notifyDataSetChanged();
        tvCount.setText(displayedList.size() + " " + currentTypeFilter.toLowerCase() + 
                (displayedList.size() == 1 ? "" : (currentTypeFilter.equals("All") ? " total" : "s")));
    }
}
