package lb.edu.aub.cmps279spring26.amm125.aether;

import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
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

import com.google.android.material.chip.Chip;
import com.google.android.material.floatingactionbutton.FloatingActionButton;

import java.util.ArrayList;
import java.util.List;

import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiClient;
import lb.edu.aub.cmps279spring26.amm125.aether.api.ApiService;
import lb.edu.aub.cmps279spring26.amm125.aether.model.BackendProject;
import lb.edu.aub.cmps279spring26.amm125.aether.model.CreateProjectRequest;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectWrapperResponse;
import lb.edu.aub.cmps279spring26.amm125.aether.model.ProjectsResponse;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HomeFragment extends Fragment {

    private RecyclerView rvProjects;
    private ProjectAdapter adapter;
    private TextView tvProjectCount;
    private View cardEmptyHome;
    private TextView tvEmptyHomeTitle;
    private TextView tvEmptyHomeSubtitle;
    private View btnEmptyHomeAction;
    private final List<Project> filteredList = new ArrayList<>();
    private final ApiService apiService = ApiClient.getApiService();

    private View searchBarContainer;
    private EditText etSearch;
    private SwipeRefreshLayout swipeRefreshProjects;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_home, container, false);

        rvProjects = view.findViewById(R.id.rvProjects);
        swipeRefreshProjects = view.findViewById(R.id.swipeRefreshProjects);
        tvProjectCount = view.findViewById(R.id.tvProjectCount);
        cardEmptyHome = view.findViewById(R.id.cardEmptyHome);
        tvEmptyHomeTitle = view.findViewById(R.id.tvEmptyHomeTitle);
        tvEmptyHomeSubtitle = view.findViewById(R.id.tvEmptyHomeSubtitle);
        btnEmptyHomeAction = view.findViewById(R.id.btnEmptyHomeAction);
        FloatingActionButton fabAdd = view.findViewById(R.id.fabAdd);

        searchBarContainer = view.findViewById(R.id.searchBarContainer);
        etSearch = view.findViewById(R.id.etSearchProjects);
        ImageView ivCloseSearch = view.findViewById(R.id.ivCloseSearch);

        refreshList();

        adapter = new ProjectAdapter(filteredList, this::updateProjectCount);
        rvProjects.setLayoutManager(new LinearLayoutManager(getContext()));
        rvProjects.setAdapter(adapter);

        fabAdd.setOnClickListener(v -> showCreateProjectDialog());
        if (btnEmptyHomeAction != null) {
            btnEmptyHomeAction.setOnClickListener(v -> showCreateProjectDialog());
        }

        View btnSearch = view.findViewById(R.id.btnSearchContainer);
        if (btnSearch != null) {
            btnSearch.setOnClickListener(v -> {
                searchBarContainer.setVisibility(View.VISIBLE);
                etSearch.requestFocus();
            });
        }

        if (ivCloseSearch != null) {
            ivCloseSearch.setOnClickListener(v -> {
                etSearch.setText("");
                searchBarContainer.setVisibility(View.GONE);
                filter("");
            });
        }

        etSearch.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                filter(s.toString());
            }

            @Override public void afterTextChanged(Editable s) {}
        });

        loadProjects();

        if (swipeRefreshProjects != null) {
            swipeRefreshProjects.setOnRefreshListener(this::loadProjects);
        }
        return view;
    }

    @Override
    public void onResume() {
        super.onResume();
        loadProjects();
    }

    private void loadProjects() {
        if (swipeRefreshProjects != null && !swipeRefreshProjects.isRefreshing()) {
            swipeRefreshProjects.setRefreshing(true);
        }
        apiService.getProjects().enqueue(new Callback<ProjectsResponse>() {
            @Override
            public void onResponse(Call<ProjectsResponse> call, Response<ProjectsResponse> response) {
                if (swipeRefreshProjects != null) swipeRefreshProjects.setRefreshing(false);
                if (!isAdded()) return;
                if (!response.isSuccessful() || response.body() == null || response.body().getProjects() == null) {
                    Toast.makeText(requireContext(), "Failed to load projects", Toast.LENGTH_SHORT).show();
                    refreshList();
                    return;
                }

                HomeActivity.userProjects.clear();
                for (BackendProject backendProject : response.body().getProjects()) {
                    Project mapped = mapBackendProject(backendProject);
                    HomeActivity.userProjects.add(mapped);
                }
                refreshList();
                if (adapter != null) {
                    adapter.notifyDataSetChanged();
                }
            }

            @Override
            public void onFailure(Call<ProjectsResponse> call, Throwable t) {
                if (swipeRefreshProjects != null) swipeRefreshProjects.setRefreshing(false);
                if (!isAdded()) return;
                Toast.makeText(requireContext(), "Could not reach backend", Toast.LENGTH_SHORT).show();
                refreshList();
            }
        });
    }

    private Project mapBackendProject(BackendProject backendProject) {
        String status = backendProject.isPublished() ? "Published" : "Not Published";
        Project project = new Project(
                backendProject.getName(),
                "Project from backend",
                status,
                "Project"
        );
        project.setBackendId(backendProject.getId());
        project.setScreenshotUrl(backendProject.getScreenshotUrl());
        return project;
    }

    private void refreshList() {
        filter(etSearch != null ? etSearch.getText().toString() : "");
    }

    private void filter(String text) {
        filteredList.clear();
        if (text.isEmpty()) {
            filteredList.addAll(HomeActivity.userProjects);
        } else {
            String query = text.toLowerCase().trim();
            for (Project p : HomeActivity.userProjects) {
                if (p.getTitle().toLowerCase().contains(query) || p.getDescription().toLowerCase().contains(query)) {
                    filteredList.add(p);
                }
            }
        }
        if (adapter != null) adapter.notifyDataSetChanged();
        updateProjectCount();
        updateEmptyState();
    }

    private void showCreateProjectDialog() {
        final Dialog dialog = new Dialog(getContext());
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.dialog_create_project);
        dialog.show();

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        View ivClose = dialog.findViewById(R.id.ivClose);
        Button btnCreate = dialog.findViewById(R.id.btnCreate);
        Button btnCancel = dialog.findViewById(R.id.btnCancel);
        EditText etName = dialog.findViewById(R.id.etProjectName);
        EditText etDesc = dialog.findViewById(R.id.etProjectDesc);

        Chip chip1 = dialog.findViewById(R.id.chip1);
        Chip chip2 = dialog.findViewById(R.id.chip2);
        Chip chip3 = dialog.findViewById(R.id.chip3);

        ivClose.setOnClickListener(v -> dialog.dismiss());
        btnCancel.setOnClickListener(v -> dialog.dismiss());

        etName.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                btnCreate.setEnabled(!s.toString().trim().isEmpty());
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        View.OnClickListener suggestionListener = v -> {
            Chip chip = (Chip) v;
            etName.setText(chip.getText().toString());
            etDesc.setText(buildStylePrompt(chip.getId()));
        };

        chip1.setOnClickListener(suggestionListener);
        chip2.setOnClickListener(suggestionListener);
        chip3.setOnClickListener(suggestionListener);

        btnCreate.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String desc = etDesc.getText().toString().trim();
            if (TextUtils.isEmpty(name)) return;

            String prompt = TextUtils.isEmpty(desc)
                    ? "Design a polished mobile app called " + name + " with login and signup, a dashboard, searchable content, filters, CRUD actions, saved items, and a responsive production-ready interface."
                    : desc;
            apiService.createProject(new CreateProjectRequest(prompt, name)).enqueue(new Callback<ProjectWrapperResponse>() {
                @Override
                public void onResponse(Call<ProjectWrapperResponse> call, Response<ProjectWrapperResponse> response) {
                    if (!isAdded()) return;
                    if (!response.isSuccessful() || response.body() == null || response.body().getProject() == null) {
                        Toast.makeText(requireContext(), "Failed to create project", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    BackendProject backendProject = response.body().getProject();
                    Project project = mapBackendProject(backendProject);
                    HomeActivity.userProjects.add(0, project);
                    refreshList();
                    dialog.dismiss();

                    Intent intent = new Intent(getActivity(), ChatActivity.class);
                    intent.putExtra("PROJECT_TITLE", project.getTitle());
                    intent.putExtra("PROJECT_DESC", prompt);
                    intent.putExtra("PROJECT_STATUS", project.getStatus());
                    intent.putExtra("PROJECT_INDEX", HomeActivity.userProjects.indexOf(project));
                    intent.putExtra("PROJECT_ID", project.getBackendId());
                    startActivity(intent);
                }

                @Override
                public void onFailure(Call<ProjectWrapperResponse> call, Throwable t) {
                    if (!isAdded()) return;
                    Toast.makeText(requireContext(), "Could not reach backend", Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    public void updateProjectCount() {
        if (tvProjectCount != null) {
            tvProjectCount.setText(filteredList.size() + " total");
        }
    }

    private void updateEmptyState() {
        if (cardEmptyHome == null || rvProjects == null) return;
        if (HomeActivity.userProjects.isEmpty()) {
            rvProjects.setVisibility(View.GONE);
            tvEmptyHomeTitle.setText("No projects yet");
            tvEmptyHomeSubtitle.setText("Create your first project and it will show up here.");
            cardEmptyHome.setVisibility(View.VISIBLE);
            btnEmptyHomeAction.setVisibility(View.VISIBLE);
            return;
        }
        rvProjects.setVisibility(View.VISIBLE);
        cardEmptyHome.setVisibility(View.GONE);
    }

    private String buildStylePrompt(int chipId) {
        if (chipId == R.id.chip1) {
            return "Design a neo-brutalist task board with email login, project creation, drag-and-drop Kanban columns, task priorities, due dates, labels, search, and an activity feed.";
        }
        if (chipId == R.id.chip2) {
            return "Design a glassmorphism finance hub with account linking, balance cards, transaction history, spending charts, budget goals, recurring bill reminders, and quick transfer actions.";
        }
        if (chipId == R.id.chip3) {
            return "Design an editorial recipe studio with recipe search, ingredient filters, favorites, cooking mode step cards, shopping list generation, saved collections, and shareable recipe pages.";
        }
        return "Design a polished mobile app with authentication, a dashboard, search, filters, CRUD flows, saved items, and responsive layouts.";
    }
}
