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
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.chip.Chip;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import java.util.ArrayList;
import java.util.List;

public class HomeFragment extends Fragment {

    private RecyclerView rvProjects;
    private ProjectAdapter adapter;
    private TextView tvProjectCount;
    private List<Project> filteredList = new ArrayList<>();

    private View searchBarContainer, headerLayout;
    private EditText etSearch;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_home, container, false);

        rvProjects = view.findViewById(R.id.rvProjects);
        tvProjectCount = view.findViewById(R.id.tvProjectCount);
        FloatingActionButton fabAdd = view.findViewById(R.id.fabAdd);

        searchBarContainer = view.findViewById(R.id.searchBarContainer);
        headerLayout = view.findViewById(R.id.headerLayout);
        etSearch = view.findViewById(R.id.etSearchProjects);
        ImageView ivCloseSearch = view.findViewById(R.id.ivCloseSearch);

        if (HomeActivity.userProjects.isEmpty()) {
            HomeActivity.userProjects.add(new Project("Fitness Tracker", "Modern UI for health tracking", "Published"));
            HomeActivity.userProjects.add(new Project("E-commerce App", "AI-driven shopping experience", "Draft"));
            HomeActivity.userProjects.add(new Project("Smart Home", "Control your home appliances", "Published"));
            HomeActivity.userProjects.add(new Project("Recipe Finder", "Find dishes by ingredients", "Published"));
        }

        refreshList();

        adapter = new ProjectAdapter(filteredList, this::updateProjectCount);
        rvProjects.setLayoutManager(new LinearLayoutManager(getContext()));
        rvProjects.setAdapter(adapter);

        fabAdd.setOnClickListener(v -> showCreateProjectDialog());

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

        return view;
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshList();
        if (adapter != null) {
            adapter.notifyDataSetChanged();
        }
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
            etDesc.setText("Build a " + chip.getText().toString().toLowerCase() + " with a modern UI and great features.");
        };

        chip1.setOnClickListener(suggestionListener);
        chip2.setOnClickListener(suggestionListener);
        chip3.setOnClickListener(suggestionListener);

        btnCreate.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            String desc = etDesc.getText().toString().trim();
            if (!TextUtils.isEmpty(name)) {
                Project newProject = new Project(name, desc, "Not Published");
                HomeActivity.userProjects.add(0, newProject);
                refreshList();
                dialog.dismiss();
                
                Intent intent = new Intent(getActivity(), ChatActivity.class);
                intent.putExtra("PROJECT_TITLE", name);
                intent.putExtra("PROJECT_DESC", desc);
                intent.putExtra("PROJECT_STATUS", "Not Published");
                intent.putExtra("PROJECT_INDEX", 0);
                startActivity(intent);
            }
        });
    }

    public void updateProjectCount() {
        if (tvProjectCount != null) {
            tvProjectCount.setText(filteredList.size() + " total");
        }
    }
}