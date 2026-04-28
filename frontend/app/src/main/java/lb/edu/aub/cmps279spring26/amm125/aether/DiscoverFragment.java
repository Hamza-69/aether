package lb.edu.aub.cmps279spring26.amm125.aether;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.card.MaterialCardView;
import java.util.ArrayList;
import java.util.List;

public class DiscoverFragment extends Fragment {

    private RecyclerView rvDiscover;
    private DiscoverAdapter adapter;
    private List<Project> filteredList = new ArrayList<>();
    private TextView tvCount;
    
    private MaterialCardView btnAll, btnProjects, btnTemplates;
    private TextView tvAll, tvProjects, tvTemplates;
    
    private View searchBarContainer;
    private EditText etSearch;
    private String currentFilterType = "All";

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_discover, container, false);

        rvDiscover = view.findViewById(R.id.rvDiscover);
        tvCount = view.findViewById(R.id.tvDiscoverCount);
        
        btnAll = view.findViewById(R.id.btnFilterAll);
        btnProjects = view.findViewById(R.id.btnFilterProjects);
        btnTemplates = view.findViewById(R.id.btnFilterTemplates);
        
        tvAll = view.findViewById(R.id.tvFilterAll);
        tvProjects = view.findViewById(R.id.tvFilterProjects);
        tvTemplates = view.findViewById(R.id.tvFilterTemplates);

        searchBarContainer = view.findViewById(R.id.discoverSearchBar);
        etSearch = view.findViewById(R.id.etSearchDiscover);
        ImageView ivCloseSearch = view.findViewById(R.id.ivCloseDiscoverSearch);

        filteredList.addAll(HomeActivity.communityProjects);
        
        adapter = new DiscoverAdapter(filteredList);
        rvDiscover.setLayoutManager(new LinearLayoutManager(getContext()));
        rvDiscover.setAdapter(adapter);

        setupFilters();

        view.findViewById(R.id.btnSearchDiscoverContainer).setOnClickListener(v -> {
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

        updateCountUI();

        return view;
    }

    private void setupFilters() {
        btnAll.setOnClickListener(v -> {
            currentFilterType = "All";
            applyFilters();
        });
        btnProjects.setOnClickListener(v -> {
            currentFilterType = "Project";
            applyFilters();
        });
        btnTemplates.setOnClickListener(v -> {
            currentFilterType = "Template";
            applyFilters();
        });
    }

    private void applyFilters() {
        // Update Filter UI
        btnAll.setCardBackgroundColor(Color.parseColor("#F5F5F5"));
        tvAll.setTextColor(Color.parseColor("#1A1A1A"));
        btnProjects.setCardBackgroundColor(Color.parseColor("#F5F5F5"));
        tvProjects.setTextColor(Color.parseColor("#1A1A1A"));
        btnTemplates.setCardBackgroundColor(Color.parseColor("#F5F5F5"));
        tvTemplates.setTextColor(Color.parseColor("#1A1A1A"));

        if (currentFilterType.equals("All")) {
            btnAll.setCardBackgroundColor(Color.parseColor("#7C4DFF"));
            tvAll.setTextColor(Color.WHITE);
        } else if (currentFilterType.equals("Project")) {
            btnProjects.setCardBackgroundColor(Color.parseColor("#7C4DFF"));
            tvProjects.setTextColor(Color.WHITE);
        } else {
            btnTemplates.setCardBackgroundColor(Color.parseColor("#7C4DFF"));
            tvTemplates.setTextColor(Color.WHITE);
        }

        // Filter List
        String query = etSearch.getText().toString().toLowerCase().trim();
        filteredList.clear();

        for (Project p : HomeActivity.communityProjects) {
            boolean matchesType = currentFilterType.equals("All") || p.getType().equalsIgnoreCase(currentFilterType);
            boolean matchesQuery = query.isEmpty() || p.getTitle().toLowerCase().contains(query) || p.getDescription().toLowerCase().contains(query);
            
            if (matchesType && matchesQuery) {
                filteredList.add(p);
            }
        }

        adapter.notifyDataSetChanged();
        updateCountUI();
    }

    private void updateCountUI() {
        if (tvCount != null) {
            tvCount.setText(filteredList.size() + " " + currentFilterType.toLowerCase() + (filteredList.size() == 1 ? "" : (currentFilterType.equals("All") ? " total" : "s")));
        }
    }
    
    // Helper to avoid import errors if Color is missing (though standard in Android)
    private static class Color {
        static int parseColor(String c) { return android.graphics.Color.parseColor(c); }
        static int WHITE = android.graphics.Color.WHITE;
    }
}