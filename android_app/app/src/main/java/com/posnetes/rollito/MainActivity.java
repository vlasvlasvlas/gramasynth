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
import java.lang.reflect.Method;
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
        layout.setPadding(40, 60, 40, 40);
        layout.setGravity(Gravity.CENTER);

        Button btnRandom = makeButton("PATRÓN ALEATORIO", 22, "#0284C7", 240, 40);
        btnRandom.setOnClickListener(v -> startPrint(true, false));
        layout.addView(btnRandom);

        Button btnEmpty = makeButton("CAJÓN VACÍO", 22, "#059669", 240, 40);
        btnEmpty.setOnClickListener(v -> startPrint(false, false));
        layout.addView(btnEmpty);

        Button btnTest = makeButton("Probar Bluetooth", 13, "#1E293B", 0, 16);
        btnTest.setTextColor(Color.parseColor("#94A3B8"));
        btnTest.setOnClickListener(v -> startPrint(false, true));
        layout.addView(btnTest);

        Button btnChange = makeButton("Cambiar impresora", 13, "#0F172A", 0, 0);
        btnChange.setTextColor(Color.parseColor("#64748B"));
        btnChange.setOnClickListener(v -> {
            prefs.edit().remove(PREF_PRINTER).apply();
            toast("Elegí la impresora la próxima vez que imprimas");
        });
        layout.addView(btnChange);

        setContentView(layout);
    }

    private Button makeButton(String text, float sizeSp, String colorHex, int heightDp, int marginBottomDp) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(sizeSp);
        b.setAllCaps(false);
        b.setTextColor(Color.WHITE);
        if (colorHex != null) b.setBackgroundColor(Color.parseColor(colorHex));
        float density = getResources().getDisplayMetrics().density;
        int h = heightDp > 0 ? (int)(heightDp * density) : ViewGroup.LayoutParams.WRAP_CONTENT;
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, h);
        p.setMargins(0, 0, 0, (int)(marginBottomDp * density));
        b.setLayoutParams(p);
        return b;
    }

    private void startPrint(boolean isRandom, boolean isTest) {
        BluetoothAdapter bt = BluetoothAdapter.getDefaultAdapter();
        if (bt == null)      { toast("Este dispositivo no tiene Bluetooth"); return; }
        if (!bt.isEnabled()) { toast("Activá el Bluetooth primero"); return; }

        String addr = prefs.getString(PREF_PRINTER, null);
        if (addr == null) {
            pickPrinter(bt, isRandom, isTest);
        } else {
            connectAndSend(bt, addr, isRandom, isTest);
        }
    }

    private void pickPrinter(BluetoothAdapter bt, boolean isRandom, boolean isTest) {
        Set<BluetoothDevice> bonded = bt.getBondedDevices();
        if (bonded.isEmpty()) {
            toast("No hay dispositivos Bluetooth emparejados.\nAndá a Ajustes → Bluetooth y emparejá la impresora.");
            return;
        }
        List<BluetoothDevice> list = new ArrayList<>(bonded);
        String[] labels = new String[list.size()];
        for (int i = 0; i < list.size(); i++) {
            String n = list.get(i).getName();
            labels[i] = (n != null && !n.isEmpty())
                    ? n + "  [" + list.get(i).getAddress() + "]"
                    : list.get(i).getAddress();
        }
        new AlertDialog.Builder(this)
                .setTitle("Elegir impresora Bluetooth")
                .setItems(labels, (d, i) -> {
                    prefs.edit().putString(PREF_PRINTER, list.get(i).getAddress()).apply();
                    connectAndSend(bt, list.get(i).getAddress(), isRandom, isTest);
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void connectAndSend(BluetoothAdapter bt, String address, boolean isRandom, boolean isTest) {
        toast("Conectando...");
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                BluetoothDevice device = bt.getRemoteDevice(address);
                bt.cancelDiscovery();
                socket = openSocket(device);

                OutputStream out = socket.getOutputStream();
                out.write(isTest ? makeTextTest() : makeBitmap(isRandom));
                out.flush();
                Thread.sleep(300);

                final String msg = isTest
                        ? "Prueba enviada — ¿salió algo de la impresora?"
                        : "✓ Enviado";
                runOnUiThread(() -> toast(msg));

            } catch (Exception e) {
                runOnUiThread(() -> {
                    toast("Error: " + e.getMessage()
                            + "\nVerificá que la impresora esté encendida y que elegiste el dispositivo correcto.");
                    prefs.edit().remove(PREF_PRINTER).apply();
                });
            } finally {
                if (socket != null) try { socket.close(); } catch (IOException ignored) {}
            }
        }).start();
    }

    /**
     * Intenta abrir el socket BT con 3 métodos, del más compatible al más directo.
     * Muchos módulos BT baratos (HC-05/HC-06) no anuncian su UUID correctamente
     * pero aceptan conexiones en el canal RFCOMM 1 via reflexión.
     */
    private BluetoothSocket openSocket(BluetoothDevice device) throws IOException {
        // Intento 1: SPP estándar con SDP
        try {
            BluetoothSocket s = device.createRfcommSocketToServiceRecord(BT_SPP_UUID);
            s.connect();
            return s;
        } catch (IOException ignored) {}

        // Intento 2: SPP sin cifrado
        try {
            BluetoothSocket s = device.createInsecureRfcommSocketToServiceRecord(BT_SPP_UUID);
            s.connect();
            return s;
        } catch (IOException ignored) {}

        // Intento 3: RFCOMM canal 1 directo (funciona con módulos que no tienen SDP)
        try {
            Method m = device.getClass().getMethod("createRfcommSocket", int.class);
            BluetoothSocket s = (BluetoothSocket) m.invoke(device, 1);
            s.connect();
            return s;
        } catch (Exception e) {
            throw new IOException("No se pudo conectar al dispositivo: " + device.getName());
        }
    }

    /** Solo texto — sirve para verificar que el Bluetooth está conectado a la impresora correcta. */
    private byte[] makeTextTest() {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        try {
            o.write(new byte[]{0x1B, 0x40});              // ESC @ init
            o.write(new byte[]{0x1B, 0x61, 0x01});        // ESC a 1 center
            o.write("\nROLLITO\n".getBytes("UTF-8"));
            o.write("--- Prueba BT OK ---\n\n\n".getBytes("UTF-8"));
            o.write(new byte[]{0x1D, 0x56, 0x42, 0x00}); // GS V B 0 cut
        } catch (Exception ignored) {}
        return o.toByteArray();
    }

    /**
     * Convierte el bitmap a ESC * (comando columnar, soportado por prácticamente
     * todas las impresoras térmicas, incluyendo las más económicas).
     * GS v 0 (raster) es más nuevo y no siempre está soportado.
     */
    private byte[] makeBitmap(boolean isRandom) {
        Bitmap bmp = generateBitmap(isRandom);
        int w = bmp.getWidth();
        int h = bmp.getHeight();
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        try {
            o.write(new byte[]{0x1B, 0x40});       // ESC @ init
            o.write(new byte[]{0x1B, 0x33, 0x08}); // ESC 3 8 — 8 dots line spacing

            // ESC * 0 nL nH [data]: imprime bandas de 8 filas de puntos
            for (int y = 0; y < h; y += 8) {
                o.write(new byte[]{0x1B, 0x2A, 0x00,
                        (byte)(w & 0xFF), (byte)((w >> 8) & 0xFF)});
                for (int x = 0; x < w; x++) {
                    byte col = 0;
                    for (int dy = 0; dy < 8; dy++) {
                        if (y + dy < h) {
                            int pixel = bmp.getPixel(x, y + dy);
                            int lum = (Color.red(pixel)
                                     + Color.green(pixel)
                                     + Color.blue(pixel)) / 3;
                            if (lum < 128) col |= (byte)(0x80 >> dy);
                        }
                    }
                    o.write(col);
                }
                o.write(0x0A); // LF — avanza al próximo bloque de 8 filas
            }

            o.write(new byte[]{0x1B, 0x32});        // ESC 2 — restaurar espaciado
            o.write(new byte[]{0x1B, 0x64, 0x05}); // ESC d 5 — avanzar 5 líneas
            o.write(new byte[]{0x1D, 0x56, 0x42, 0x00}); // GS V B cut
        } catch (Exception ignored) {}
        return o.toByteArray();
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
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

        // Línea divisoria central punteada
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
                        canvas.drawCircle(45 + rnd.nextInt(PRINT_WIDTH - 90), 52 + rnd.nextInt(55), 6, p);
                    for (int i = 0; i < 6; i++)
                        canvas.drawCircle(45 + rnd.nextInt(PRINT_WIDTH - 90), 150 + rnd.nextInt(60), 8, p);
                    break;
            }
        }
        return bmp;
    }
}
