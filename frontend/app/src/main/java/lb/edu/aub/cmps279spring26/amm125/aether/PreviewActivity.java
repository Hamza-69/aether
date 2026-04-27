package lb.edu.aub.cmps279spring26.amm125.aether;

import android.graphics.Color;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.style.ForegroundColorSpan;
import android.widget.ImageView;
import android.widget.PopupMenu;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class PreviewActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_preview);

        String title = getIntent().getStringExtra("PROJECT_TITLE");
        if (title != null) {
            TextView tvTitle = findViewById(R.id.tvPreviewTitle);
            tvTitle.setText(title);
        }

        ImageView btnBack = findViewById(R.id.btnBackPreview);
        btnBack.setOnClickListener(v -> finish());

        ImageView btnOptions = findViewById(R.id.btnOptionsPreview);
        btnOptions.setOnClickListener(v -> {
            PopupMenu popup = new PopupMenu(this, v);
            
            SpannableString s = new SpannableString("Report");
            s.setSpan(new ForegroundColorSpan(Color.RED), 0, s.length(), 0);
            popup.getMenu().add(0, 1, 0, s);
            
            popup.setOnMenuItemClickListener(menuItem -> {
                if (menuItem.getItemId() == 1) {
                    Toast.makeText(this, "Project reported", Toast.LENGTH_SHORT).show();
                    return true;
                }
                return false;
            });
            popup.show();
        });
    }
}