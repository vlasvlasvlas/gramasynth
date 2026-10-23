package com.posnetes.rollito;

import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {

    private static final UUID BT_SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int PRINT_WIDTH = 384;
    private static final int PRINT_HEIGHT = 240;
    private static final String PREF_PRINTER = "printer_address";

    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getPreferences(MODE_PRIVATE);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.parseColor("#0F172A"));
        layout.setPadding(40, 80, 40, 80);
        layout.setGravity(Gravity.CENTER);

        Button btnRandom = new Button(this);
        btnRandom.setText("PATRÓN ALEATORIO");
        btnRandom.setTextSize(22);
        btnRandom.setAllCaps(false);
        btnRandom.setTextColor(Color.WHITE);
        btnRandom.setBackgroundColor(Color.parseColor("#0284C7"));
        LinearLayout.LayoutParams params1 = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 260);
        params1.setMargins(0, 0, 0, 56);
        btnRandom.setLayoutParams(params1);
        btnRandom.setOnClickListener(v -> printBlock(true));
        layout.addView(btnRandom);

        Button btnEmpty = new Button(this);
        btnEmpty.setText("CAJÓN VACÍO");
        btnEmpty.setTextSize(22);
        btnEmpty.setAllCaps(false);
        btnEmpty.setTextColor(Color.WHITE);
        btnEmpty.setBackgroundColor(Color.parseColor("#059669"));
        LinearLayout.LayoutParams params2 = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 260);
        btnEmpty.setLayoutParams(params2);
        btnEmpty.setOnClickListener(v -> printBlock(false));
        layout.addView(btnEmpty);

        setContentView(layout);
    }

    private void printBlock(boolean isRandom) {
        BluetoothAdapter bt = BluetoothAdapter.getDefaultAdapter();
        if (bt == null) { toast("Este dispositivo no tiene Bluetooth"); return; }
        if (!bt.isEnabled()) { toast("Activá el Bluetooth primero"); return; }

        String address = prefs.getString(PREF_PRINTER, null);
        if (address == null) {
            showPrinterSelector(bt, isRandom);
        } else {
            connectAndPrint(bt, address, isRandom);
        }
    }

    private void showPrinterSelector(BluetoothAdapter bt, boolean isRandom) {
        Set<BluetoothDevice> bonded = bt.getBondedDevices();
        if (bonded.isEmpty()) {
            toast("No hay impresoras emparejadas.\nAndá a Ajustes → Bluetooth y emparejá la impresora.");
            return;
        }
        List<BluetoothDevice> devices = new ArrayList<>(bonded);
        String[] names = new String[devices.size()];
        for (int i = 0; i < devices.size(); i++) {
            String n = devices.get(i).getName();
            names[i] = (n != null && !n.isEmpty()) ? n : devices.get(i).getAddress();
        }
        new AlertDialog.Builder(this)
                .setTitle("Elegir impresora Bluetooth")
                .setItems(names, (d, i) -> {
                    prefs.edit().putString(PREF_PRINTER, devices.get(i).getAddress()).apply();
                    connectAndPrint(bt, devices.get(i).getAddress(), isRandom);
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void connectAndPrint(BluetoothAdapter bt, String address, boolean isRandom) {
        toast("Conectando...");
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                BluetoothDevice device = bt.getRemoteDevice(address);
                bt.cancelDiscovery();
                socket = device.createRfcommSocketToServiceRecord(BT_SPP_UUID);
                socket.connect();

                OutputStream out = socket.getOutputStream();
                out.write(bitmapToEscPos(generateBitmap(isRandom)));
                out.flush();

                runOnUiThread(() -> toast("✓ Impreso"));
            } catch (IOException e) {
                runOnUiThread(() -> {
                    toast("Error de conexión. Revisá que la impresora esté encendida.");
                    prefs.edit().remove(PREF_PRINTER).apply();
                });
            } finally {
                if (socket != null) try { socket.close(); } catch (IOException ignored) {}
            }
        }).start();
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
    }

    private byte[] bitmapToEscPos(Bitmap bmp) throws IOException {
        int width = bmp.getWidth();
        int height = bmp.getHeight();
        int bytesPerRow = (width + 7) / 8;

        ByteArrayOutputStream out = new ByteArrayOutputStream();

        // ESC @ — inicializar impresora
        out.write(new byte[]{0x1B, 0x40});
        // ESC 3 0 — espaciado mínimo entre líneas
        out.write(new byte[]{0x1B, 0x33, 0x00});
        // GS v 0 — imagen raster (densidad normal)
        out.write(new byte[]{
            0x1D, 0x76, 0x30, 0x00,
            (byte)(bytesPerRow & 0xFF), (byte)((bytesPerRow >> 8) & 0xFF),
            (byte)(height & 0xFF), (byte)((height >> 8) & 0xFF)
        });

        for (int y = 0; y < height; y++) {
            for (int bx = 0; bx < bytesPerRow; bx++) {
                byte b = 0;
                for (int bit = 0; bit < 8; bit++) {
                    int px = bx * 8 + bit;
                    if (px < width) {
                        int pixel = bmp.getPixel(px, y);
                        int lum = (Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)) / 3;
                        if (lum < 128) b |= (byte)(0x80 >> bit);
                    }
                }
                out.write(b);
            }
        }

        // Avanzar papel y cortar
        out.write(new byte[]{0x1B, 0x64, 0x05});     // ESC d 5
        out.write(new byte[]{0x1D, 0x56, 0x42, 0x00}); // GS V B 0
        return out.toByteArray();
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

        // Marcadores de esquina (cuadrados sólidos 24×24 px)
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

        // Etiquetas de zona
        p.setStyle(Paint.Style.FILL);
        p.setTextSize(9);
        canvas.drawText("MELODIA", 38, 38, p);
        canvas.drawText("RITMO", 38, 134, p);

        if (!isRandom) {
            // Guías tenues para dibujar a mano
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
                case 0: // Pad sostenido + bombos
                    canvas.drawRect(40, 75, PRINT_WIDTH - 40, 87, p);
                    for (int b = 0; b < 4; b++) {
                        int bx = 42 + b * 72;
                        canvas.drawRect(bx, 204, bx + 20, 222, p);
                    }
                    break;
                case 1: // Onda / melodía en arco
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
                default: // Gotas / staccato
                    for (int i = 0; i < 12; i++)
                        canvas.drawCircle(45 + rnd.nextInt(PRINT_WIDTH - 90), 52 + rnd.nextInt(55), 6, p);
                    for (int i = 0; i < 6; i++)
                        canvas.drawCircle(45 + rnd.nextInt(PRINT_WIDTH - 90), 150 + rnd.nextInt(60), 8, p);
                    break;
            }
        }
        return bmp;
    }
}
