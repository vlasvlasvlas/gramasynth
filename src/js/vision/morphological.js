/**
 * Gramasynth ROLLITO — Morphological Stroke Classifier
 * 
 * Analiza las marcas binarias dentro de una celda para distinguir el gesto:
 * - 'trigger': Punto / círculo (aspect ratio ~ 1.0, densidad media)
 * - 'sustain': Línea horizontal (ancho >> alto)
 * - 'accent': Línea vertical (alto >> ancho)
 * - 'rich': Cuadrado o bloque relleno (densidad alta > 70%)
 */

export class MorphologicalClassifier {
  /**
   * Analiza un recorte binario de celda (0 = fondo blanco papel, 1 = tinta oscura)
   * cellPixels: Uint8Array con 0 o 1
   * width: ancho del recorte
   * height: alto del recorte
   */
  static classify(cellPixels, width, height) {
    let minX = width, maxX = 0;
    let minY = height, maxY = 0;
    let darkCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = cellPixels[y * width + x];
        if (val === 1) {
          darkCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const totalPixels = width * height;
    const density = darkCount / totalPixels;

    // Si la densidad es menor al 12%, se considera celda vacía
    if (density < 0.12 || darkCount < 8) {
      return { active: false, type: 'trigger', confidence: 1.0 - density };
    }

    const strokeWidth = Math.max(1, maxX - minX + 1);
    const strokeHeight = Math.max(1, maxY - minY + 1);
    const aspectRatio = strokeWidth / strokeHeight;

    let gestureType = 'trigger';
    let confidence = 0.85;

    // 1. Bloque muy denso o cuadrado relleno
    if (density > 0.65) {
      gestureType = 'rich';
      confidence = 0.95;
    }
    // 2. Línea horizontal (Sustain / Ligadura)
    else if (aspectRatio > 2.2 && strokeWidth > width * 0.5) {
      gestureType = 'sustain';
      confidence = 0.92;
    }
    // 3. Línea vertical (Acento / Modulación)
    else if (aspectRatio < 0.45 && strokeHeight > height * 0.5) {
      gestureType = 'accent';
      confidence = 0.90;
    }
    // 4. Punto o círculo estándar (Trigger)
    else {
      gestureType = 'trigger';
      confidence = 0.88;
    }

    return {
      active: true,
      type: gestureType,
      confidence: confidence
    };
  }
}
