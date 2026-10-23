package com.posnetes.rollito;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Random;

public class MainActivity extends Activity {

    private static final int PRINT_WIDTH  = 384;
    private static final int PRINT_HEIGHT = 240;

    // Nombres de paquete de RawBT (free y Pro tienen paquetes distintos)
    private static final String[] RAWBT_PACKAGES = {
        "ru.a402412.rawbt",        // RawBT free
        "ru.a402412.rawbtadmin"    // RawBT Pro / Admin
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.parseColor("#0F172A"));
        layout.setPadding(40, 80, 40, 80);
        layout.setGravity(Gravity.CENTER);

        Button btnRandom = btn("PATRÓN ALEATORIO", "#0284C7", 260, 56);
        btnRandom.setOnClickListener(v -> print(true));
        layout.addView(btnRandom);

        Button btnEmpty = btn("CAJÓN VACÍO", "#059669", 260, 0);
        btnEmpty.setOnClickListener(v -> print(false));
        layout.addView(btnEmpty);

        setContentView(layout);
    }

    private void print(boolean isRandom) {
        try {
            Bitmap bmp = generateBitmap(isRandom);

            // Guardar PNG en caché externa (legible por otras apps en Android 6)
            File outDir = getExternalCacheDir();
            if (outDir == null) outDir = getCacheDir();
            File imgFile = new File(outDir, "rollito.png");

            FileOutputStream fos = new FileOutputStream(imgFile);
            bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.flush();
            fos.close();

            Uri imgUri = Uri.fromFile(imgFile); // Uri.fromFile es válido en Android 6 (API 23)

            // Intentar con cada variante conocida del paquete RawBT
            for (String pkg : RAWBT_PACKAGES) {
                if (tryRawBT(pkg, imgUri)) return;
            }

            // Si ningún paquete directo funcionó, mostrar el selector del sistema
            // (el usuario puede elegir RawBT manualmente si tiene otra variante instalada)
            Intent chooser = new Intent(Intent.ACTION_SEND);
            chooser.setType("image/png");
            chooser.putExtra(Intent.EXTRA_STREAM, imgUri);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(chooser, "Enviar a impresora"));

        } catch (Exception e) {
            toast("Error al preparar imagen: " + e.getMessage());
        }
    }

    private boolean tryRawBT(String pkg, Uri imgUri) {
        try {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setPackage(pkg);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, imgUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                          | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private Button btn(String text, String color, int heightDp, int marginBottomDp) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(22);
        b.setAllCaps(false);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(Color.parseColor(color));
        float d = getResources().getDisplayMetrics().density;
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, (int)(heightDp * d));
        p.setMargins(0, 0, 0, (int)(marginBottomDp * d));
        b.setLayoutParams(p);
        return b;
    }

    private Bitmap generateBitmap(boolean isRandom) {
        Bitmap bmp = Bitmap.createBitmap(PRINT_WIDTH, PRINT_HEIGHT, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        canvas.drawColor(Color.WHITE);

        Paint p = new Paint();
        p.setAntiAlias(false);
        p.setColor(Color.BLACK);

        // Borde exterior
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(2);
        canvas.drawRect(6, 6, PRINT_WIDTH - 6, PRINT_HEIGHT - 6, p);

        // Marcadores de esquina sólidos 24×24
        int m = 24;
        p.setStyle(Paint.Style.FILL);
        canvas.drawRect(8, 8, 8 + m, 8 + m, p);
        canvas.drawRect(PRINT_WIDTH - 8 - m, 8, PRINT_WIDTH - 8, 8 + m, p);
        canvas.drawRect(8, PRINT_HEIGHT - 8 - m, 8 + m, PRINT_HEIGHT - 8, p);
        canvas.drawRect(PRINT_WIDTH - 8 - m, PRINT_HEIGHT - 8 - m, PRINT_WIDTH - 8, PRINT_HEIGHT - 8, p);

        // Línea divisoria central punteada (Melodía / Ritmo)
        p.setStyle(Paint.Style.STROKE);
        p.setPathEffect(new DashPathEffect(new float[]{4, 4}, 0));
        canvas.drawLine(8, PRINT_HEIGHT / 2, PRINT_WIDTH - 8, PRINT_HEIGHT / 2, p);
        p.setPathEffect(null);

        p.setStyle(Paint.Style.FILL);
        p.setTextSize(9);
        canvas.drawText("MELODIA", 38, 38, p);
        canvas.drawText("RITMO", 38, 134, p);

        if (!isRandom) {
            p.setStyle(Paint.Style.STROKE);
            p.setColor(Color.LTGRAY);
            p.setStrokeWidth(1);
            for (int y : new int[]{52, 70, 88, 106}) canvas.drawLine(38, y, PRINT_WIDTH - 38, y, p);
            for (int y : new int[]{148, 168, 192, 214}) canvas.drawLine(38, y, PRINT_WIDTH - 38, y, p);
        } else {
            p.setColor(Color.BLACK);
            p.setStyle(Paint.Style.FILL);
            Random rnd = new Random();
            switch (rnd.nextInt(3)) {
                case 0:
                    canvas.drawRect(40, 75, PRINT_WIDTH - 40, 87, p);
                    for (int b = 0; b < 4; b++) {
                        int bx = 42 + b * 72;
                        canvas.drawRect(bx, 204, bx + 20, 222, p);
                    }
                    break;
                case 1:
                    p.setStyle(Paint.Style.STROKE);
                    p.setStrokeWidth(8);
                    canvas.drawLine(42, 95, 120, 55, p);
                    canvas.drawLine(120, 55, 200, 105, p);
                    canvas.drawLine(200, 105, 280, 55, p);
                    canvas.drawLine(280, 55, 340, 85, p);
                    p.setStyle(Paint.Style.FILL);
                    for (int b = 0; b < 4; b++) {
                        int bx = 42 + b * 72;
                        canvas.drawRect(bx, 204, bx + 18, 222, p);
                    }
                    break;
                default:
                    for (int i = 0; i < 12; i++)
                        canvas.drawCircle(45 + rnd.nextInt(PRINT_WIDTH - 90),
                                          52 + rnd.nextInt(55), 6, p);
                    for (int i = 0; i < 6; i++)
                        canvas.drawCircle(45 + rnd.nextInt(PRINT_WIDTH - 90),
                                          150 + rnd.nextInt(60), 8, p);
                    break;
            }
        }
        return bmp;
    }
}
