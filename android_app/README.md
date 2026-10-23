# POSNETES — App de Impresión Térmica para Rollito (Android v6)

Esta aplicación está diseñada específicamente para terminales POS con impresora térmica Bluetooth integrada bajo **Android 6.0 (Marshmallow)** y la app **RawBT**.

Cuenta con **2 botones gigantes táctiles**:
1. **🎲 IMPRIMIR PATRÓN ALEATORIO:** Genera un bloque con música lista para sonar (líneas continuas, montañas rusas de arpegios, caídas de gotas o bombos) a 384 px de ancho (formato 58 mm).
2. **✍️ IMPRIMIR CAJÓN VACÍO:** Genera un bloque con los 4 marcadores de registro negros en las esquinas y carriles tenues para dibujar libremente a mano con marcador negro.

---

## ⚡ Método 1 (Inmediato sin compilar): Abrir en el Navegador del POS

No necesitas compilar el APK si no quieres; ya tienes la aplicación web táctil lista que se comunica directamente con **RawBT** en tu terminal:

1. Asegúrate de que tu terminal Android esté en la misma red Wi-Fi que tu computadora.
2. Abre Chrome o el navegador de tu POS y entra a:
   ```text
   http://<IP_DE_TU_COMPUTADORA>:8000/physical/pos_print.html
   ```
3. En el navegador del POS verás los 2 botones gigantes:
   - Al tocar **`🎲 PATRÓN ALEATORIO`** o **`✍️ CAJÓN VACÍO`**, se genera el bloque y dispara instantáneamente el Intent oficial de RawBT (`intent:#Intent;package=ru.a402412.rawbt`).
   - La impresora térmica imprimirá el rollito al instante.
4. *Tip:* En el navegador del POS toca los 3 puntos y selecciona **"Agregar a la pantalla principal"** para que quede como un ícono de app en tu pantalla.

---

## 📦 Método 2: Compilar el APK Nativo con Android Studio

Si prefieres instalar el archivo `.apk` nativo:

1. Abre la carpeta `android_app` en **Android Studio**.
2. Verifica que el SDK de Android incluya API 23 (Android 6.0) o superior.
3. Menú **Build** $\rightarrow$ **Build Bundle(s) / APK(s)** $\rightarrow$ **Build APK(s)**.
4. Conecta tu terminal POS por USB (o pásalo por tarjeta MicroSD / WhatsApp / Drive) e instala `app-debug.apk`.
5. Al abrir la app en tu terminal, tendrás los 2 botones funcionando a pantalla completa.
