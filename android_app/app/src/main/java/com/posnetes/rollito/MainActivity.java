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
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Random;

public class MainActivity extends Activity {

    private final int PRINT_WIDTH = 384;  // Ancho estándar impresora térmica 58mm (203 DPI)
    private final int PRINT_HEIGHT = 240; // Alto de bloque proporcional

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Layout vertical centrado con interfaz touch de botones gigantes
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.parseColor("#0F172A"));
        layout.setPadding(32, 48, 32, 48);
        layout.setGravity(Gravity.CENTER);

        TextView title = new TextView(this);
        title.setText("POSNETES ROLLITO");
        title.setTextSize(22);
        title.setTextColor(Color.parseColor("#38BDF8"));
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 8);
        layout.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Impresora Térmica Bluetooth (RawBT / Android 6)");
        subtitle.setTextSize(13);
        subtitle.setTextColor(Color.parseColor("#94A3B8"));
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 0, 0, 48);
        layout.addView(subtitle);

        // BOTÓN 1: PATRÓN ALEATORIO
        Button btnRandom = new Button(this);
        btnRandom.setText("🎲 IMPRIMIR PATRÓN ALEATORIO\n(Música lista para sonar)");
        btnRandom.setTextSize(16);
        btnRandom.setTextColor(Color.WHITE);
        btnRandom.setBackgroundColor(Color.parseColor("#0284C7"));
        LinearLayout.LayoutParams params1 = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 220);
        params1.setMargins(0, 0, 0, 32);
        btnRandom.setLayoutParams(params1);
        btnRandom.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printThermalBlock(true);
            }
        });
        layout.addView(btnRandom);

        // BOTÓN 2: CAJÓN VACÍO PARA DIBUJAR
        Button btnEmpty = new Button(this);
        btnEmpty.setText("✍️ IMPRIMIR CAJÓN VACÍO\n(Para dibujar a mano alzada)");
        btnEmpty.setTextSize(16);
        btnEmpty.setTextColor(Color.WHITE);
        btnEmpty.setBackgroundColor(Color.parseColor("#059669"));
        LinearLayout.LayoutParams params2 = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 220);
        params2.setMargins(0, 0, 0, 32);
        btnEmpty.setLayoutParams(params2);
        btnEmpty.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                printThermalBlock(false);
            }
        });
        layout.addView(btnEmpty);

        setContentView(layout);
    }

    private void printThermalBlock(boolean isRandom) {
        try {
            Bitmap bitmap = generateThermalBitmap(isRandom);

            // Guardar imagen en cache temporal para compartir con RawBT
            File cachePath = new File(getExternalCacheDir(), "print_temp.png");
            FileOutputStream stream = new FileOutputStream(cachePath);
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
            stream.close();

            // Enviar a RawBT mediante Intent de impresión directa
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setPackage("ru.a402412.rawbt");
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, Uri.fromFile(cachePath));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                startActivity(intent);
                Toast.makeText(this, "Enviando a RawBT...", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                // Si RawBT no está instalado por paquete directo, intentar selector genérico
                Intent chooser = Intent.createChooser(intent, "Imprimir con RawBT");
                startActivity(chooser);
            }

        } catch (Exception e) {
            Toast.makeText(this, "Error al generar imagen: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private Bitmap generateThermalBitmap(boolean isRandom) {
        Bitmap bitmap = Bitmap.createBitmap(PRINT_WIDTH, PRINT_HEIGHT, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // Fondo blanco térmico
        canvas.drawColor(Color.WHITE);

        Paint paint = new Paint();
        paint.setColor(Color.BLACK);
        paint.setAntiAlias(false); // Nitidez pixelada para cabezal térmico

        // Borde exterior
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2);
        canvas.drawRect(6, 6, PRINT_WIDTH - 6, PRINT_HEIGHT - 6, paint);

        // 4 Marcadores de registro en esquinas (cuadrados negros sólidos de 24x24 px)
        paint.setStyle(Paint.Style.FILL);
        int mSize = 24;
        canvas.drawRect(8, 8, 8 + mSize, 8 + mSize, paint);
        canvas.drawRect(PRINT_WIDTH - 8 - mSize, 8, PRINT_WIDTH - 8, 8 + mSize, paint);
        canvas.drawRect(8, PRINT_HEIGHT - 8 - mSize, 8 + mSize, PRINT_HEIGHT - 8, paint);
        canvas.drawRect(PRINT_WIDTH - 8 - mSize, PRINT_HEIGHT - 8 - mSize, PRINT_WIDTH - 8, PRINT_HEIGHT - 8, paint);

        // Línea divisoria central punteada en Y = 120 (30 mm Melodía, 30 mm Ritmo)
        paint.setStyle(Paint.Style.STROKE);
        paint.setPathEffect(new DashPathEffect(new float[]{4, 4}, 0));
        canvas.drawLine(8, PRINT_HEIGHT / 2, PRINT_WIDTH - 8, PRINT_HEIGHT / 2, paint);
        paint.setPathEffect(null);

        // Textos
        paint.setStyle(Paint.Style.FILL);
        paint.setTextSize(12);
        canvas.drawText(isRandom ? "POSNETES: PATRÓN MÚSICA" : "POSNETES: CAJÓN LIBRE", 38, 24, paint);

        paint.setTextSize(9);
        canvas.drawText("▲ MELODÍA (30mm)", 38, 38, paint);
        canvas.drawText("▼ RITMO (30mm)", 38, 134, paint);

        if (!isRandom) {
            // Guías tenues para cajón vacío
            paint.setStyle(Paint.Style.STROKE);
            paint.setColor(Color.LTGRAY);
            paint.setStrokeWidth(1);

            int[] yMelody = {52, 70, 88, 106};
            for (int y : yMelody) {
                canvas.drawLine(38, y, PRINT_WIDTH - 38, y, paint);
            }
            int[] yRhythm = {148, 168, 192, 214};
            for (int y : yRhythm) {
                canvas.drawLine(38, y, PRINT_WIDTH - 38, y, paint);
            }
        } else {
            // Patrón musical expresivo aleatorio
            paint.setColor(Color.BLACK);
            paint.setStyle(Paint.Style.FILL);

            Random rnd = new Random();
            int style = rnd.nextInt(3);

            if (style == 0) {
                // Línea horizontal continua (Pad sostenido)
                canvas.drawRect(40, 75, PRINT_WIDTH - 40, 87, paint);
                // Bombos abajo
                for (int b = 0; b < 4; b++) {
                    int bx = 42 + b * 72;
                    canvas.drawRect(bx, 204, bx + 20, 222, paint);
                }
            } else if (style == 1) {
                // Onda / Montaña rusa
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(8);
                canvas.drawLine(42, 95, 120, 55, paint);
                canvas.drawLine(120, 55, 200, 105, paint);
                canvas.drawLine(200, 105, 280, 55, paint);
                canvas.drawLine(280, 55, 340, 85, paint);

                paint.setStyle(Paint.Style.FILL);
                for (int b = 0; b < 4; b++) {
                    int bx = 42 + b * 72;
                    canvas.drawRect(bx, 204, bx + 18, 222, paint);
                }
            } else {
                // Lluvia de gotas (Staccato)
                for (int i = 0; i < 12; i++) {
                    float gx = 45 + rnd.nextInt(PRINT_WIDTH - 90);
                    float gy = 52 + rnd.nextInt(55);
                    canvas.drawCircle(gx, gy, 6, paint);
                }
                for (int i = 0; i < 6; i++) {
                    float gx = 45 + rnd.nextInt(PRINT_WIDTH - 90);
                    float gy = 150 + rnd.nextInt(60);
                    canvas.drawCircle(gx, gy, 8, paint);
                }
            }
        }

        return bitmap;
    }
}
