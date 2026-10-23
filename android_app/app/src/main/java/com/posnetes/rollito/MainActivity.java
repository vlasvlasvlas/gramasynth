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

    private static final int PRINT_WIDTH  = 240;
    private static final int PRINT_HEIGHT = 384;

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
        // Portrait: 240px wide (≈58 mm) × 384px tall (along the roll)
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

        // Marcadores de esquina sólidos 20×20 (en las 4 esquinas del área imprimible)
        int mk = 20;
        p.setStyle(Paint.Style.FILL);
        canvas.drawRect(8, 8, 8 + mk, 8 + mk, p);                                             // TL
        canvas.drawRect(PRINT_WIDTH - 8 - mk, 8, PRINT_WIDTH - 8, 8 + mk, p);                 // TR
        canvas.drawRect(8, PRINT_HEIGHT - 8 - mk, 8 + mk, PRINT_HEIGHT - 8, p);               // BL
        canvas.drawRect(PRINT_WIDTH - 8 - mk, PRINT_HEIGHT - 8 - mk, PRINT_WIDTH - 8, PRINT_HEIGHT - 8, p); // BR

        // Línea divisoria central horizontal (Melodía ↑ / Ritmo ↓)
        int midY = PRINT_HEIGHT / 2;  // = 192
        p.setStyle(Paint.Style.STROKE);
        p.setPathEffect(new DashPathEffect(new float[]{4, 4}, 0));
        canvas.drawLine(8, midY, PRINT_WIDTH - 8, midY, p);
        p.setPathEffect(null);

        // Etiquetas: fuera de la zona de esquinas (debajo de TL y debajo de la línea)
        p.setStyle(Paint.Style.FILL);
        p.setTextSize(9);
        canvas.drawText("MELODIA", 36, 42, p);   // zona superior, tras la esquina TL
        canvas.drawText("RITMO",   36, midY + 18, p); // zona inferior, bajo la línea

        // Área de contenido: x: 36..204, melodia y: 50..182, ritmo y: 202..360
        int cL = 36, cR = PRINT_WIDTH - 36;  // content left/right

        if (!isRandom) {
            // Guías vacías para que el usuario dibuje
            p.setStyle(Paint.Style.STROKE);
            p.setColor(Color.LTGRAY);
            p.setStrokeWidth(1);
            for (int y : new int[]{70, 95, 120, 155})  canvas.drawLine(cL, y, cR, y, p);
            for (int y : new int[]{215, 245, 280, 320}) canvas.drawLine(cL, y, cR, y, p);
        } else {
            p.setColor(Color.BLACK);
            Random rnd = new Random();
            switch (rnd.nextInt(3)) {
                case 0:
                    // Melodía: barra sólida horizontal
                    p.setStyle(Paint.Style.FILL);
                    canvas.drawRect(cL, 100, cR, 115, p);
                    // Ritmo: 4 cuadrados de beat distribuidos verticalmente
                    for (int b = 0; b < 4; b++) {
                        int by = 220 + b * 36;
                        canvas.drawRect(cL + 10, by, cR - 10, by + 22, p);
                    }
                    break;
                case 1:
                    // Melodía: zigzag
                    p.setStyle(Paint.Style.STROKE);
                    p.setStrokeWidth(7);
                    int w4 = (cR - cL) / 4;
                    canvas.drawLine(cL,          130, cL + w4,     70, p);
                    canvas.drawLine(cL + w4,      70, cL + w4*2,  130, p);
                    canvas.drawLine(cL + w4*2,   130, cL + w4*3,   80, p);
                    canvas.drawLine(cL + w4*3,    80, cR,          110, p);
                    // Ritmo: 4 cuadrados
                    p.setStyle(Paint.Style.FILL);
                    for (int b = 0; b < 4; b++) {
                        int by = 220 + b * 36;
                        canvas.drawRect(cL + 10, by, cR - 10, by + 22, p);
                    }
                    break;
                default:
                    // Puntos aleatorios
                    p.setStyle(Paint.Style.FILL);
                    for (int i = 0; i < 10; i++)
                        canvas.drawCircle(cL + rnd.nextInt(cR - cL), 55 + rnd.nextInt(120), 6, p);
                    for (int i = 0; i < 6; i++)
                        canvas.drawCircle(cL + rnd.nextInt(cR - cL), 210 + rnd.nextInt(140), 8, p);
                    break;
            }
        }
        return bmp;
    }
}
