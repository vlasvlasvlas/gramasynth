# ROLLITO — Documento integral de concepto, teoría, diseño y especificación técnica

**Versión:** 0.1 — documentación del concepto y auditoría del primer mockup  
**Fecha:** 22 de octubre de 2026  
**Proyecto relacionado:** POSNETES — ecosistema electroacústico  
**Estado:** prototipo exploratorio; no confundir comportamiento implementado con arquitectura objetivo.

---

## 1. Resumen ejecutivo

**ROLLITO** es una interfaz musical físico-digital: una superficie de papel con patrones impresos y espacios vacíos donde las personas pueden dibujar patrones propios. Una webcam observa el papel, un sistema de visión transforma las marcas en una estructura musical discreta y un secuenciador reproduce el resultado en bucle. Mientras un patrón está sonando, el sistema permite leer y preparar otro sin interrumpir la reproducción. El nuevo patrón se puede colocar en espera y activarlo en un límite musical previsible.

La interacción no depende de conocimientos de notación musical tradicional: se dibuja, se muestra a la cámara, se observa la interpretación y se escucha. La interfaz hace visible la transformación desde imagen física hasta sonido.

**Idea esencial:** el papel es una partitura manipulable; la cámara es el lector; la grilla digital es la interpretación; el motor de audio es el intérprete; la cola de patrones permite continuidad.

### 1.1 Qué debe quedar claro en el objeto físico

- El rollito **ya contiene plantillas de patrones musicales predefinidos** que pueden utilizarse sin dibujar nada.
- También contiene **espacios delimitados vacíos** para que cada participante dibuje sus propios patrones.
- Ambos tipos de sección se leen con la misma cámara y se convierten al mismo formato interno de patrón.
- El rollito puede recorrerse, desplazarse, intercambiarse o mostrarse por partes; el sistema debe identificar **qué región concreta** está siendo leída.
- No se presupone todavía un mecanismo automático de arrastre del papel: la primera versión puede funcionar con posicionamiento manual.

### 1.2 Objetivo de experiencia

1. Escuchar un patrón ya activo.
2. Mostrar otra sección del rollito a la webcam.
3. Ver en pantalla imagen cruda, imagen procesada y grilla interpretada.
4. Corregir iluminación, contraste, encuadre o dibujo si es necesario.
5. Capturar el patrón candidato sin afectar al sonido actual.
6. Decidir si se descarta, se reemplaza en espera o se programa para sonar.
7. Cambiar de patrón en una frontera musical, sin silencio artificial entre patrones.
8. Continuar indefinidamente.

---

## 2. Marco conceptual y teórico

### 2.1 De la imagen al sonido

ROLLITO traduce una disposición espacial en eventos temporales. La dimensión horizontal de una grilla puede codificar **tiempo/pasos**; la dimensión vertical puede codificar **altura de nota**, **instrumento**, **pista** o **parámetro sonoro**. Para el primer prototipo se eligió horizontal = paso temporal y vertical = nota.

No hay una única traducción correcta: es una decisión de diseño musical. Es importante distinguir la **detección de marcas** (visión) de la **interpretación musical** (mapeo).

### 2.2 Antecedentes e ideas afines

- Pianolas, órganos mecánicos y soportes perforados: la información musical está codificada en un soporte físico desplazable.
- Secuenciadores por pasos: una matriz discreta representa eventos que se activan a intervalos regulares.
- Partituras gráficas: el dibujo funciona como instrucción sonora sin exigir notación convencional.
- Interfaces tangibles: se manipula un objeto físico para controlar procesos digitales.
- Instrumentos audiovisuales experimentales: la traducción entre medios es parte visible de la obra.

Estas son **afinidades conceptuales**, no afirmaciones de que ROLLITO replique exactamente esas tecnologías.

### 2.3 Principios de diseño

**Legibilidad:** quien usa el sistema debe poder distinguir qué ve la cámara, qué detecta el algoritmo y qué se está escuchando.  
**Continuidad:** una nueva lectura nunca debe detener por sí sola la música.  
**Agencia:** detectar un patrón no equivale a aplicarlo inmediatamente.  
**Reversibilidad:** poder descartar o reemplazar un candidato.  
**Tolerancia al error:** los trazos imperfectos son parte de la experimentación, pero el software debe mostrar su interpretación.  
**Simplicidad:** pocas acciones principales y retroalimentación visual inmediata.  
**Transparencia:** evitar que el sistema parezca reconocer plantillas si en realidad solo umbraliza píxeles.

---

## 3. Modelo de interacción propuesto

### 3.1 Estados

- **ACTIVE:** patrón que suena actualmente.
- **PREVIEW:** patrón recién leído, todavía no aceptado.
- **PENDING:** patrón aceptado, programado para entrar.
- **TRANSITION:** cambio en el límite musical acordado.

El primer HTML solo tiene `active` y `pending`; **no implementa una etapa PREVIEW separada**. La separación PREVIEW/PENDING es una mejora de diseño recomendada.

### 3.2 Flujo de información

```text
ROLLITO FÍSICO
  ├── Plantillas ya impresas
  └── Zonas vacías para dibujar
             │
             ▼
          WEBCAM
             │
             ▼
    IMAGEN CRUDA + ENCUADRE
             │
             ▼
 BRILLO / CONTRASTE / UMBRAL
             │
             ▼
 RECTIFICACIÓN + LECTURA DE CELDAS
             │
             ▼
     PATRÓN CANDIDATO
             │
       PREVISUALIZACIÓN
             │
        ACEPTAR / DESCARTAR
             │
             ▼
        PATRÓN EN ESPERA
             │
       CAMBIO CUANTIZADO
             │
             ▼
     SECUENCIADOR ACTIVO ──► MOTOR DE AUDIO ──► SONIDO
             ▲                       │
             └────── LOOP CONTINUO ──┘
```

**Nota:** rectificación geométrica, aceptación explícita del preview y descarte no están implementados todavía.

### 3.3 Política recomendada para cambios

- Capturar **no** debe modificar ACTIVE.
- El patrón candidato se puede revisar antes de aceptarlo.
- Un único PENDING simplifica la primera versión: si se acepta otro, reemplaza al anterior.
- El cambio sucede al inicio del siguiente ciclo de 16 pasos, salvo que el usuario seleccione otro criterio.
- Se debe mostrar visualmente cuál está sonando y cuál está por entrar.
- Al detener y volver a iniciar, debe definirse explícitamente si se reinicia desde el paso 0.
- Un cambio de patrón no debe cerrar el contexto de audio ni cortar una voz que todavía está terminando, salvo que esa sea una decisión musical.

---

## 4. Diseño de interfaz

### 4.1 Distribución

**Panel A — cámara cruda:** video en vivo y rectángulo de encuadre; controles de brillo y contraste.  
**Panel B — procesamiento:** representación binaria o filtrada, umbral, y en versiones futuras detección de bordes, marcadores y confianza.  
**Panel C — interpretación sonora:** grilla grande con notas activas, cursor de reproducción y candidato en otro color.

### 4.2 Acciones principales

1. Activar cámara y audio.
2. Leer patrón.
3. Previsualizar lo detectado.
4. Aceptar para el siguiente ciclo.
5. Detener.

### 4.3 Lenguaje visual

- Marcas activas: color sólido.
- Patrón candidato/en espera: contorno o color secundario, nunca confundible con ACTIVE.
- Cursor: columna actual destacada.
- Estados: cámara desconectada, cámara activa, leyendo, lectura fallida, candidato listo, cambio programado, reproduciendo, detenido.
- Los controles de calibración deben reflejar **la misma transformación** que usa el detector.

---

## 5. Formato físico del rollito

### 5.1 Propuesta de diseño

Cada bloque del rollito debería contener:

```text
┌───────────────────────────────────────────────┐
│ IDENTIFICADOR / MARCAS DE REGISTRO             │
├───────────────────────────────────────────────┤
│ 16 COLUMNAS (TIEMPO) × 8 FILAS (NOTAS)        │
│                                               │
│ □ □ ■ □ │ □ □ ■ □ │ □ □ ■ □ │ □ □ ■ □       │
│ □ □ □ □ │ □ □ □ □ │ □ □ □ □ │ □ □ □ □       │
│ ...                                           │
├───────────────────────────────────────────────┤
│ TIPO: PLANTILLA IMPRESA / ESPACIO LIBRE       │
└───────────────────────────────────────────────┘
```

Esta figura es esquemática. El diseño de impresión, las dimensiones, la orientación, la separación entre celdas y los marcadores siguen abiertos.

### 5.2 Tipos de bloque

**Plantilla predefinida:** patrón dibujado/impreso de fábrica, disponible para usar inmediatamente.  
**Bloque libre:** grilla vacía delimitada donde la persona dibuja.  
**Bloque híbrido (opcional):** una base preimpresa que puede modificarse con trazos adicionales.

### 5.3 Detección robusta: propuesta

Para distinguir celdas y regiones conviene incorporar marcas de registro (por ejemplo, cuatro esquinas reconocibles), un identificador de bloque y una zona de datos delimitada. Con cuatro puntos conocidos puede calcularse una **homografía** para rectificar perspectiva antes de muestrear la grilla. Los identificadores podrían ser símbolos simples o códigos impresos, pero la tecnología exacta no está decidida.

La detección de un identificador no debería sustituir la lectura del dibujo cuando el bloque admite intervención manual.

---

## 6. Arquitectura de software objetivo

```text
CAPTURE         Video MediaStream / frames
  ↓
PREPROCESS      ROI, iluminación, contraste, binarización
  ↓
GEOMETRY        esquinas, perspectiva, rectificación
  ↓
DECODE          celdas, densidad, confianza, tipo de bloque
  ↓
PATTERN MODEL   matriz + metadatos + versión
  ↓
STATE MANAGER   active / preview / pending
  ↓
TRANSPORT       tempo, fase, compás, cuantización
  ↓
AUDIO ENGINE    scheduling, voces, envolventes, salida
  ↓
VISUALIZATION   cursor, notas, diagnóstico
```

Separar estas capas facilita pruebas, cambios de mapeo musical y futuras instalaciones con otros dispositivos.

### 6.1 Contrato de patrón sugerido

```json
{
  "id": "pattern-001",
  "source": "camera",
  "kind": "hand_drawn",
  "steps": 16,
  "rows": 8,
  "cells": [
    [false, false, true, false],
    [false, true, false, false]
  ],
  "mapping": "pitch-8",
  "confidence": 0.91,
  "capturedAt": "ISO-8601"
}
```

**Ejemplo ilustrativo, no un objeto válido para el motor de 16×8:** el arreglo `cells` está abreviado para mostrar el esquema. En producción debe contener exactamente 8 filas de 16 booleanos. `confidence` y metadatos no existen en el mockup actual.

### 6.2 Convención de coordenadas

- `row`: 0..7, de arriba hacia abajo.
- `step`: 0..15, de izquierda a derecha.
- `cells[row][step] = true`: activar evento en ese paso.
- Una columna puede contener varias notas simultáneas.
- La duración del evento, la escala y el timbre pertenecen al mapeo sonoro, no al detector de píxeles.

---

## 7. Visión por computadora: teoría y decisiones

### 7.1 Captura

La cámara entrega fotogramas de video. En navegador, el acceso se solicita mediante `navigator.mediaDevices.getUserMedia({video:true,audio:false})`, que exige permiso y normalmente un contexto seguro (HTTPS o localhost; abrir un archivo local puede funcionar según navegador y configuración).

### 7.2 Región de interés (ROI)

El objetivo es analizar solo la superficie útil del papel, evitando manos, fondo, sombras y otras marcas. La ROI debe corresponder al rectángulo que se muestra en la interfaz. En el mockup esa correspondencia **no es exacta**: el overlay es una guía visual CSS y el muestreo usa coordenadas fijas distintas.

### 7.3 Preprocesamiento

El mockup usa filtros CSS de canvas al dibujar la imagen:

- Brillo: 50–180 %, inicial 100 %.
- Contraste: 50–250 %, inicial 160 %.
- Umbral: 30–230, inicial 125.

Luego calcula luminancia aproximada:

```text
Y = 0.299 R + 0.587 G + 0.114 B
pixel_binario = 255 si Y < umbral; si no, 0
```

Así, los píxeles **oscuros** del papel se muestran **blancos** en el procesamiento. No es una segmentación semántica: sombras y trazos oscuros pueden producir el mismo resultado.

### 7.4 Muestreo de celdas

En el HTML, el lienzo de procesamiento mide 320×240 píxeles. Para cada celda `r,c`, se inspeccionan puntos cada 3 píxeles dentro de regiones aproximadas:

```text
x: 38 + c*15 ... 38 + (c+1)*15
 y: 30 + r*22 ... 30 + (r+1)*22
```

Se calcula `hits/total`, donde `hits` es la cantidad de píxeles binarios blancos; la celda queda activa cuando la proporción es **mayor que 0.30**.

**Limitaciones reales:** la zona cubierta es aproximadamente 240×176 píxeles; el código no detecta papel, esquinas, líneas de grilla, orientación, inclinación ni tamaño real. Una marca fuera de esa zona no se interpreta. Tampoco se eliminan automáticamente líneas impresas de la plantilla.

### 7.5 Mejoras necesarias

1. Calibración de cámara y orientación horizontal/inversión espejo.
2. Detección automática del papel o de marcadores de esquina.
3. Rectificación de perspectiva.
4. Segmentación adaptativa ante iluminación desigual.
5. Exclusión de líneas de grilla y elementos preimpresos que no son notas.
6. Detección de ocupación por celda con margen interior y filtrado morfológico.
7. Estimación de confianza, y advertencia ante movimiento/desenfoque.
8. Estabilización temporal mediante varios frames.
9. Pruebas con distintos marcadores, bolígrafos, papeles y condiciones de luz.
10. Pruebas de inversión horizontal: la vista de video se espeja con CSS, pero el procesamiento actual no se espeja.

### 7.6 Criterio de aceptación sugerido

Probar al menos 20 patrones impresos y 20 dibujados, con variaciones de iluminación, ángulo y distancia. Medir precisión/recall de celdas activas, falsos positivos, tiempo de captura y estabilidad entre lecturas. **Estos números son un plan de pruebas, no resultados obtenidos.**

---

## 8. Motor musical y temporización

### 8.1 Representación musical

La primera versión utiliza una grilla de **16 pasos × 8 notas**. El motor reproduce la columna actual, avanza a la siguiente y vuelve a cero después de la 15.

### 8.2 Mapeo actual de notas

De arriba hacia abajo, las frecuencias están fijadas en:

| Fila | Frecuencia (Hz) | Nota aproximada |
|---:|---:|---|
| 0 | 523.25 | C5 / Do5 |
| 1 | 493.88 | B4 / Si4 |
| 2 | 440.00 | A4 / La4 |
| 3 | 392.00 | G4 / Sol4 |
| 4 | 349.23 | F4 / Fa4 |
| 5 | 329.63 | E4 / Mi4 |
| 6 | 293.66 | D4 / Re4 |
| 7 | 261.63 | C4 / Do4 |

La escala actual es diatónica en Do mayor, descendente. No hay selección de tonalidad ni de instrumentos en el HTML.

### 8.3 Tempo

El control BPM va de **50 a 200**, con valor inicial **110**. Cada paso se programa mediante un intervalo de JavaScript:

```text
intervalo_ms = 60000 / BPM / 4
```

Esto equivale a una subdivisión de semicorcheas si BPM se interpreta como negras por minuto. A 110 BPM, cada paso dura aproximadamente **136.36 ms** y el ciclo de 16 pasos aproximadamente **2.18 s**.

### 8.4 Síntesis actual

Para cada nota activa se crea un `OscillatorNode` de onda **senoidal** y un `GainNode`. La envolvente empieza cerca de silencio, sube a una ganancia de 0.12 en 15 ms y desciende exponencialmente hacia silencio alrededor de los 170 ms; el oscilador se detiene a los 180 ms. Varias notas pueden sonar simultáneamente.

### 8.5 Riesgos temporales

El mockup usa `setInterval` para disparar los eventos. Los temporizadores de JavaScript pueden presentar **jitter**, especialmente cuando la pestaña pierde foco o el equipo está ocupado. Además, las notas duran hasta 180 ms, más que un paso a 110 BPM (~136 ms), por lo que puede existir superposición; esto no equivale a un corte entre patrones.

**Mejora recomendada:** mantener un reloj musical basado en `AudioContext.currentTime`, programar notas con anticipación (lookahead scheduler) y realizar cambios de patrón en fronteras de compás determinadas por ese reloj. Un `AudioWorklet` puede evaluarse si la exigencia temporal lo justifica.

### 8.6 Continuidad sonora: definición precisa

Hay que diferenciar:

- **Continuidad del transporte:** el contador de pasos nunca se detiene durante la lectura.
- **Continuidad de la salida de audio:** el contexto sigue funcionando.
- **Continuidad audible:** no se oyen silencios involuntarios, clics o cortes entre patrones.

El prototipo implementa la primera intención y mantiene el contexto mientras corre, pero **no garantiza continuidad audible absoluta**: patrones con silencios, envolventes cortas y jitter pueden generar pausas perceptibles. El criterio artístico de “sin cortar la música” requiere pruebas auditivas y posiblemente crossfade, colas de efectos o voces sostenidas.

---

## 9. Auditoría exacta del primer mockup HTML

**Archivo:** `rollito_mockup.html`  
**Tecnología:** HTML + CSS + JavaScript vanilla, `getUserMedia`, Canvas 2D y Web Audio API.  
**Dependencias externas:** ninguna.  
**Backend:** ninguno.  
**Persistencia:** ninguna.  
**Servidor:** no incluido.  
**Reconocimiento de templates físicos:** no implementado.

### 9.1 Elementos de UI existentes

- Botón `Activar webcam + audio`.
- Botón `Leer patrón y poner en espera`.
- Botón `Cambiar al patrón en espera`.
- Botón `Detener`.
- Video crudo espejado horizontalmente.
- Rectángulo punteado superpuesto a la imagen.
- Sliders de brillo, contraste y umbral.
- Canvas de procesamiento de 320×240.
- Selector de plantillas digitales: cámara/dibujo libre, pulso, escalera y puntos.
- Slider BPM y etiqueta de valor.
- Canvas de secuenciador de 960×280 (16×8).
- Textos de estado ACTIVE y PENDING.
- Edición por clic de las celdas del patrón pendiente.

### 9.2 Variables principales

```javascript
stream       // MediaStream de cámara o null
audio        // AudioContext o null
timer        // ID del intervalo del secuenciador
step         // siguiente paso a reproducir: 0..15
active       // matriz booleana 8x16 que está sonando
pending      // matriz booleana 8x16 en espera, o null
source       // etiqueta del patrón activo
pendingName  // etiqueta del patrón pendiente
running      // estado de reproducción
```

### 9.3 Funciones existentes

| Función | Responsabilidad |
|---|---|
| `template(name)` | Construye patrones digitales predefinidos. |
| `draw()` | Dibuja grilla, cursor y contorno del patrón pendiente. |
| `tick()` | Dispara las notas de un paso, incrementa paso y aplica pendiente al volver a 0. |
| `schedule()` | Reinicia el `setInterval` según BPM. |
| `start()` | Pide webcam, inicia video, crea/reanuda AudioContext y transporte. |
| `process()` | Procesa continuamente frames de video en el canvas binario. |
| `capture()` | Muestrea el canvas procesado y crea `pending`. |

### 9.4 Comportamiento implementado

- Al iniciar, suena una plantilla inicial con notas en la fila 3, cada cuatro pasos.
- La lectura de cámara ocurre **solo al pulsar capturar**; la visualización procesada se actualiza continuamente.
- Capturar sobrescribe `pending`, sin detener `active`.
- Seleccionar una plantilla digital también sobrescribe `pending`.
- Hacer clic en una celda modifica `pending`; si no existe, se clona `active` y se edita esa copia.
- Si el motor está reproduciendo, el cambio pendiente se aplica automáticamente al finalizar el ciclo (al volver el contador a 0).
- Si el motor está detenido, pulsar `Cambiar al patrón en espera` aplica el patrón inmediatamente.
- Detener cierra el contexto de audio, libera las pistas de webcam y detiene el intervalo.

### 9.5 Desajustes importantes entre UI y comportamiento

**A. El botón de aplicar no gobierna realmente el cambio durante la reproducción.** Un patrón en `pending` entra automáticamente al siguiente ciclo, incluso si nunca se presionó `Cambiar`. Durante la reproducción, ese botón solo actualiza un mensaje. Para el flujo objetivo hay que separar `preview` y `pending` y requerir confirmación explícita.

**B. El video crudo se muestra espejado, pero la imagen procesada no.** Puede confundir la correspondencia izquierda/derecha.

**C. La superposición punteada no coincide exactamente con la ROI que se muestrea.** El marco es decorativo; no hay calibración.

**D. Las plantillas del selector son digitales, no reconocimiento de plantillas impresas.** El HTML no distingue una zona preimpresa de una zona libre.

**E. La etiqueta «Cámara / dibujo libre» no cambia un modo de captura específico.** Es una opción del selector sin lógica de reconocimiento asociada.

**F. No hay almacenamiento de patrones ni cola múltiple.** Solo se conserva un patrón pendiente.

**G. La lectura usa el frame procesado más reciente.** No existe bloqueo de frame, control de desenfoque ni validación de confianza.

**H. No hay detección automática de la grilla del papel.** Se presupone alineación manual con coordenadas fijas.

**I. No se garantiza audio gapless profesional.** El transporte depende de `setInterval`.

**J. `start()` puede reiniciar el intervalo sin reiniciar el paso y el estado.** Es un comportamiento a especificar, no necesariamente un error crítico.

### 9.6 Plantillas digitales actuales

- **Pulso:** una nota en fila 3 cada cuatro columnas.
- **Escalera:** la fila se desplaza cada dos columnas.
- **Puntos:** patrón determinista calculado mediante una fórmula modular; no es aleatorio real, aunque el identificador interno se llame `random`.

---

## 10. Especificación de una versión 0.2

### 10.1 Alcance mínimo

**P0 — obligatorio:**

- Webcam con selección de dispositivo cuando existan varias cámaras.
- ROI visual y ROI efectiva sincronizadas.
- Corrección de inversión horizontal.
- Captura congelada para inspección.
- `preview` separado de `pending`.
- Aceptar, descartar y reemplazar candidato.
- Cambio cuantizado real al inicio del ciclo.
- Audio basado en tiempo de AudioContext, no exclusivamente en `setInterval`.
- Visualización de la grilla leída y la grilla activa simultáneamente.
- Diagnóstico visible cuando no se detecta patrón válido.

**P1 — importante:**

- Marcadores físicos y rectificación de perspectiva.
- Diferenciación entre plantilla impresa y espacio dibujable.
- Detección de confianza por celda.
- Guardar/cargar patrones como JSON.
- Editor de mapeo fila → nota/sonido.
- Selección de escala y timbre.

**P2 — exploratorio:**

- Cola de varios patrones y ordenación manual.
- Mezcla o crossfade entre patrones.
- Múltiples pistas/instrumentos.
- Exportación MIDI y audio.
- Modo instalación/kiosco.
- Identificación de rollitos por códigos.
- Lectura continua del papel en movimiento.

### 10.2 Máquina de estados sugerida

```text
IDLE
 └─ activar ─► RUNNING(active)
                  ├─ capturar ─► PREVIEW_READY(candidate)
                  │                 ├─ descartar ─► RUNNING
                  │                 └─ aceptar ─► PENDING(next)
                  │                                  └─ fin de ciclo ─► RUNNING(new active)
                  └─ detener ─► STOPPED
```

El motor de audio sigue sonando en RUNNING, PREVIEW_READY y PENDING.

### 10.3 Interfaces de módulos sugeridas

```typescript
type Pattern = {
  id: string;
  cells: boolean[][]; // validar 8 filas x 16 columnas
  source: 'camera' | 'template' | 'manual';
  kind?: 'printed' | 'hand_drawn' | 'hybrid';
  confidence?: number;
};

type DetectionResult = {
  pattern: Pattern | null;
  confidence: number;
  warnings: string[];
};

interface VisionEngine {
  detect(frame: ImageData): DetectionResult;
}

interface PatternController {
  preview(candidate: Pattern): void;
  accept(): void;
  discard(): void;
  commitAtNextLoop(): void;
}

interface Transport {
  start(): void;
  stop(): void;
  setBpm(value: number): void;
  onLoopBoundary(callback: () => void): void;
}
```

Son contratos de diseño; no describen interfaces ya existentes en el HTML.

---

## 11. Ensayos técnicos y validación

### 11.1 Visión

| Ensayo | Qué verificar |
|---|---|
| Hoja bien iluminada | Detección consistente de celdas. |
| Sombra parcial | Resistencia a falsos positivos. |
| Papel inclinado | Rectificación de perspectiva. |
| Distintas distancias | Independencia de escala. |
| Trazo fino/grueso | Umbral y ocupación por celda. |
| Grilla impresa | No confundir líneas con notas. |
| Papel en movimiento | Evitar capturas inestables. |
| Webcam espejada | Orientación correcta de los pasos. |

### 11.2 Audio

| Ensayo | Qué verificar |
|---|---|
| Loop de 16 pasos | Tiempo y orden de notas. |
| Cambio con nota sostenida | Ausencia de corte accidental. |
| Captura durante reproducción | Audio ininterrumpido. |
| Pestaña en segundo plano | Jitter y suspensión del navegador. |
| Cambio de BPM | Transición temporal controlada. |
| Repetición durante 30 minutos | Estabilidad de transporte y memoria. |
| Silencios intencionales | Diferenciar pausa musical de error técnico. |

### 11.3 Experiencia de usuario

Verificar si alguien sin instrucciones entiende qué se está leyendo, cuál es el patrón activo, qué está pendiente y cómo hacer sonar su dibujo. Registrar confusiones y tiempos de interacción.

---

## 12. Decisiones abiertas

1. ¿El rollito es una tira continua de papel, una tarjeta con grillas o ambos?
2. ¿Qué dimensiones físicas y cuántos bloques preimpresos tendrá?
3. ¿Qué significa cada fila: nota, percusión, instrumento o parámetro?
4. ¿Las plantillas predefinidas son solo patrones de notas o incluyen timbres/tempo?
5. ¿Qué símbolos cuentan como marca: puntos, líneas, manchas, perforaciones?
6. ¿Una marca que atraviesa varias celdas activa todas esas celdas?
7. ¿Qué hace el usuario para confirmar una lectura: botón, gesto, marcador físico?
8. ¿Se permite cambiar al próximo paso, al próximo compás o exclusivamente al próximo loop?
9. ¿Qué ocurre si se lee un bloque ilegible?
10. ¿El público debe poder intervenir sobre las plantillas impresas?
11. ¿Cómo se resuelven dos rollitos visibles simultáneamente?
12. ¿Cuál es el estándar de continuidad audible aceptable para una instalación?

---

## 13. Plan de desarrollo incremental

**Etapa 1 — prototipo digital (realizada parcialmente).** Webcam, umbralización, grilla 16×8, patrones digitales, síntesis básica y cambio en fin de ciclo. Entregable existente: HTML autónomo.

**Etapa 2 — interacción correcta.** Captura congelada, preview independiente, aceptación explícita, estados claros, sincronización visual y sonora.

**Etapa 3 — rollito físico.** Diseño imprimible, marcadores, rectificación de perspectiva, reconocimiento de bloques preimpresos y libres.

**Etapa 4 — musicalidad.** Reloj preciso, instrumentos/escala, articulación, transiciones, pruebas auditivas.

**Etapa 5 — instalación.** Robustez, reinicio, selección de webcam, calibración en sitio, accesibilidad, instrucciones públicas y mantenimiento.

---

## 14. Ejecución del prototipo existente

1. Guardar `rollito_mockup.html`.
2. Abrirlo en un navegador moderno; para compatibilidad confiable con permisos de cámara, servirlo desde `localhost`.
3. Una opción con Python, desde la carpeta que contiene el HTML:

```bash
python3 -m http.server 8000
```

4. Abrir `http://localhost:8000/rollito_mockup.html`.
5. Presionar **Activar webcam + audio** y conceder permisos.
6. Mostrar un papel con marcas dentro de la zona de referencia.
7. Ajustar brillo, contraste y umbral hasta que los trazos aparezcan blancos en la vista procesada.
8. Presionar **Leer patrón y poner en espera**.
9. Observar la grilla: el patrón pendiente se indica mediante contornos y entra automáticamente al siguiente ciclo mientras está reproduciendo.
10. Usar **Detener** para cerrar cámara y audio.

**Importante:** el archivo es una prueba de concepto; su lectura física no es suficientemente robusta para exhibición pública sin calibración.

---

## 15. Glosario

- **Rollito:** soporte físico con plantillas y áreas dibujables.
- **Patrón:** conjunto de eventos codificados en una grilla.
- **Paso:** posición temporal discreta del secuenciador.
- **ROI:** región de interés de la imagen.
- **Binarización:** conversión de imagen a dos valores según un criterio.
- **Homografía:** transformación proyectiva para rectificar un plano visto en perspectiva.
- **Preview:** lectura candidata aún no aceptada.
- **Pending:** patrón aceptado y programado para entrar.
- **Quantization / cuantización temporal:** alinear un evento a una división musical.
- **Loop:** repetición cíclica de una secuencia.
- **Jitter:** variación no deseada en la precisión temporal.
- **Web Audio API:** API del navegador para síntesis y procesamiento sonoro.
- **Canvas:** superficie de dibujo/procesamiento 2D en navegador.

---

## 16. Criterios de éxito

ROLLITO se considerará listo para una primera demostración física cuando una persona pueda elegir una plantilla impresa o dibujar una propia, mostrarla a cámara, verificar la lectura y hacer que suene en el siguiente ciclo **sin detener el patrón anterior**, con reconocimiento consistente y sin artefactos sonoros atribuibles al cambio.

El objetivo no es solamente convertir píxeles en notas: es construir un instrumento comprensible, jugable y abierto a la experimentación donde el soporte físico, la lectura visual y la interpretación sonora formen una experiencia única.

---

## 17. Archivos y trazabilidad

- `rollito_mockup.html`: implementación real v0.1, fuente principal para las afirmaciones de comportamiento actual.
- `ROLLITO_documentacion_integral.md`: este documento; reúne el concepto, decisiones, arquitectura futura, auditoría del prototipo, riesgos y pruebas.

**Convención documental:** cuando un punto se presenta como *propuesta*, *recomendación* o *versión futura*, no debe interpretarse como funcionalidad ya implementada.
