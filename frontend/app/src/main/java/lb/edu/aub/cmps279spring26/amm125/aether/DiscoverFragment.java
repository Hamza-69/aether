package lb.edu.aub.cmps279spring26.amm125.aether;

import android.graphics.Color;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.card.MaterialCardView;

import java.util.ArrayList;
import java.util.List;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.DiscoverResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.PublishedProject;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DiscoverFragment extends Fragment {

    private RecyclerView rvDiscover;
    private DiscoverAdapter adapter;
    private final List<Project> filteredList = new ArrayList<>();
    private final ApiService apiService = ApiClient.getApiService();
    private TextView tvCount;
    private View cardEmptyDiscover;
    private TextView tvEmptyDiscoverTitle;
    private TextView tvEmptyDiscoverSubtitle;
    private View btnEmptyDiscoverAction;

    private MaterialCardView btnAll, btnProjects, btnTemplates;
    private TextView tvAll, tvProjects, tvTemplates;

    private View searchBarContainer;
    private EditText etSearch;
    private String currentFilterType = "All";
    private SwipeRefreshLayout swipeRefreshDiscover;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_discover, container, false);

        rvDiscover = view.findViewById(R.id.rvDiscover);
        swipeRefreshDiscover = view.findViewById(R.id.swipeRefreshDiscover);
        tvCount = view.findViewById(R.id.tvDiscoverCount);
        cardEmptyDiscover = view.findViewById(R.id.cardEmptyDiscover);
        tvEmptyDiscoverTitle = view.findViewById(R.id.tvEmptyDiscoverTitle);
        tvEmptyDiscoverSubtitle = view.findViewById(R.id.tvEmptyDiscoverSubtitle);
        btnEmptyDiscoverAction = view.findViewById(R.id.btnEmptyDiscoverAction);

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
        loadDiscoverProjects();
        if (swipeRefreshDiscover != null) {
            swipeRefreshDiscover.setOnRefreshListener(this::loadDiscoverProjects);
        }
        if (btnEmptyDiscoverAction != null) {
            btnEmptyDiscoverAction.setOnClickListener(v -> loadDiscoverProjects());
        }

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

    private void loadDiscoverProjects() {
        if (swipeRefreshDiscover != null && !swipeRefreshDiscover.isRefreshing()) {
            swipeRefreshDiscover.setRefreshing(true);
        }
        apiService.getDiscoverProjects().enqueue(new Callback<DiscoverResponse>() {
            @Override
            public void onResponse(Call<DiscoverResponse> call, Response<DiscoverResponse> response) {
                if (swipeRefreshDiscover != null) swipeRefreshDiscover.setRefreshing(false);
                if (!isAdded()) return;
                if (!response.isSuccessful() || response.body() == null || response.body().getPublishedProjects() == null) {
                    Toast.makeText(requireContext(), "Failed to load discover projects", Toast.LENGTH_SHORT).show();
                    applyFilters();
                    return;
                }
                HomeActivity.communityProjects.clear();
                for (PublishedProject p : response.body().getPublishedProjects()) {
                    Project project = new Project(
                            p.getName(),
                            "Published by @" + (p.getAuthorUsername() == null ? "unknown" : p.getAuthorUsername()),
                            "Published",
                            "Project"
                    );
                    project.setBackendId(p.getId());
                    project.setScreenshotUrl(p.getScreenshotUrl());
                    project.setAuthorUsername(p.getAuthorUsername());
                    HomeActivity.communityProjects.add(project);
                }
                applyFilters();
            }

            @Override
            public void onFailure(Call<DiscoverResponse> call, Throwable t) {
                if (swipeRefreshDiscover != null) swipeRefreshDiscover.setRefreshing(false);
                if (!isAdded()) return;
                Toast.makeText(requireContext(), "Could not reach backend", Toast.LENGTH_SHORT).show();
                applyFilters();
            }
        });
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

        String query = etSearch.getText().toString().toLowerCase().trim();
        filteredList.clear();

        for (Project p : HomeActivity.communityProjects) {
            boolean matchesType = currentFilterType.equals("All") || p.getType().equalsIgnoreCase(currentFilterType);
            boolean matchesQuery = query.isEmpty()
                    || p.getTitle().toLowerCase().contains(query)
                    || p.getDescription().toLowerCase().contains(query);

            if (matchesType && matchesQuery) {
                filteredList.add(p);
            }
        }

        adapter.notifyDataSetChanged();
        updateCountUI();
        updateEmptyState();
    }

    private void updateCountUI() {
        if (tvCount != null) {
            tvCount.setText(filteredList.size() + " " + currentFilterType.toLowerCase()
                    + (filteredList.size() == 1 ? "" : (currentFilterType.equals("All") ? " total" : "s")));
        }
    }

    private void updateEmptyState() {
        if (cardEmptyDiscover == null || rvDiscover == null) return;
        if (HomeActivity.communityProjects.isEmpty()) {
            rvDiscover.setVisibility(View.GONE);
            tvEmptyDiscoverTitle.setText("Nothing to discover yet");
            tvEmptyDiscoverSubtitle.setText("When projects are published, they will appear here.");
            cardEmptyDiscover.setVisibility(View.VISIBLE);
            return;
        }
        rvDiscover.setVisibility(View.VISIBLE);
        cardEmptyDiscover.setVisibility(View.GONE);
    }
}
