package lb.edu.aub.cmps279spring26.amm125.aether;

import android.os.Bundle;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;
import androidx.viewpager2.adapter.FragmentStateAdapter;
import androidx.viewpager2.widget.ViewPager2;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import java.util.ArrayList;
import java.util.List;

public class HomeActivity extends AppCompatActivity {

    private ViewPager2 viewPager;
    private BottomNavigationView bottomNav;
    public static List<Project> userProjects = new ArrayList<>();
    public static List<Project> communityProjects = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_home);

        viewPager = findViewById(R.id.mainViewPager);
        bottomNav = findViewById(R.id.bottomNav);

        if (userProjects.isEmpty()) {
            userProjects.add(new Project("Fitness Tracker", "Modern UI for health tracking", "Published"));
            userProjects.add(new Project("E-commerce App", "AI-driven shopping experience", "Draft"));
            userProjects.add(new Project("Smart Home", "Control your home appliances", "Published"));
            userProjects.add(new Project("Recipe Finder", "Find dishes by ingredients", "Published"));
        }
        
        if (communityProjects.isEmpty()) {
            communityProjects.add(new Project("Meditation Timer", "Peaceful meditation sessions", "Published", "Project"));
            communityProjects.add(new Project("E-commerce UI", "Modern shopping template", "Published", "Template"));
            communityProjects.add(new Project("Fitness Tracker", "Track your daily steps", "Published", "Project"));
            communityProjects.add(new Project("Recipe App", "Find meals by ingredients", "Published", "Template"));
            communityProjects.add(new Project("Smart Home", "Control your IoT devices", "Published", "Project"));
            communityProjects.add(new Project("Chat UI Kit", "Messaging app template", "Published", "Template"));
        }

        MainPagerAdapter adapter = new MainPagerAdapter(this);
        viewPager.setAdapter(adapter);
        viewPager.setOffscreenPageLimit(3);

        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_home) viewPager.setCurrentItem(0, true);
            else if (id == R.id.nav_discover) viewPager.setCurrentItem(1, true);
            else if (id == R.id.nav_profile) viewPager.setCurrentItem(2, true);
            return true;
        });

        viewPager.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageSelected(int position) {
                switch (position) {
                    case 0: bottomNav.setSelectedItemId(R.id.nav_home); break;
                    case 1: bottomNav.setSelectedItemId(R.id.nav_discover); break;
                    case 2: bottomNav.setSelectedItemId(R.id.nav_profile); break;
                }
            }
        });
    }

    private static class MainPagerAdapter extends FragmentStateAdapter {
        public MainPagerAdapter(@NonNull FragmentActivity fragmentActivity) {
            super(fragmentActivity);
        }

        @NonNull
        @Override
        public Fragment createFragment(int position) {
            switch (position) {
                case 1: return new DiscoverFragment();
                case 2: return new ProfileFragment();
                default: return new HomeFragment();
            }
        }

        @Override
        public int getItemCount() {
            return 3;
        }
    }
}
