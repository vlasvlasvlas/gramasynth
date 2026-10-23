/**
 * Gramasynth ROLLITO — Automatic Corner Detector
 * 
 * Detecta automáticamente los 4 marcadores de esquina del bloque de dibujo en el frame de la webcam.
 * Utiliza umbralización adaptativa, búsqueda de extremos y refinamiento por centroide de marcador.
 */

export class CornerDetector {
  /**
   * Intenta detectar automáticamente las 4 esquinas del bloque
   * frameData: ImageData del frame crudo de la cámara
   * currentPins: pines actuales como fallback / guía de búsqueda
   * Retorna: Array de 4 puntos [{x, y}, ...] normalizados (0..1) o null si no se detecta con certeza.
   */
  static detectCorners(frameData, currentPins = null) {
    const width = frameData.width;
    const height = frameData.height;
    const data = frameData.data;

    // Reducir resolución para procesado ultrarrápido (escala 1/4)
    const scale = 4;
    const sw = Math.floor(width / scale);
    const sh = Math.floor(height / scale);

    const gray = new Uint8Array(sw * sh);
    let sumLum = 0;

    for (let sy = 0; sy < sh; sy++) {
      for (let sx = 0; sx < sw; sx++) {
        const srcX = sx * scale;
        const srcY = sy * scale;
        const idx = (srcY * width + srcX) * 4;
        const lum = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        gray[sy * sw + sx] = lum;
        sumLum += lum;
      }
    }

    const avgLum = sumLum / (sw * sh);
    // Marcadores negros son notablemente más oscuros que la media
    const markerThreshold = Math.max(30, Math.min(100, avgLum * 0.65));

    // Búsqueda en los 4 cuadrantes correspondientes a las 4 esquinas
    // 0: Top-Left, 1: Top-Right, 2: Bottom-Right, 3: Bottom-Left
    const bounds = [
      { minX: 0.05, maxX: 0.50, minY: 0.05, maxY: 0.50 }, // TL
      { minX: 0.50, maxX: 0.95, minY: 0.05, maxY: 0.50 }, // TR
      { minX: 0.50, maxX: 0.95, minY: 0.50, maxY: 0.95 }, // BR
      { minX: 0.05, maxX: 0.50, minY: 0.50, maxY: 0.95 }  // BL
    ];

    const detectedPoints = [];

    for (let i = 0; i < 4; i++) {
      const b = bounds[i];
      const startX = Math.floor(b.minX * sw);
      const endX = Math.floor(b.maxX * sw);
      const startY = Math.floor(b.minY * sh);
      const endY = Math.floor(b.maxY * sh);

      // Si tenemos pines previos, podemos buscar centrándonos alrededor del pin anterior
      let anchorX = (startX + endX) / 2;
      let anchorY = (startY + endY) / 2;
      if (currentPins && currentPins[i]) {
        anchorX = currentPins[i].x * sw;
        anchorY = currentPins[i].y * sh;
      }

      // Buscar el blob oscuro más concentrado (marcador de 4.5x4.5mm)
      let bestX = -1, bestY = -1;
      let minDarkness = 255;
      let bestScore = 0;

      // Radio de búsqueda
      const searchRadiusX = Math.floor(sw * 0.22);
      const searchRadiusY = Math.floor(sh * 0.22);

      const x0 = Math.max(startX, Math.floor(anchorX - searchRadiusX));
      const x1 = Math.min(endX, Math.floor(anchorX + searchRadiusX));
      const y0 = Math.max(startY, Math.floor(anchorY - searchRadiusY));
      const y1 = Math.min(endY, Math.floor(anchorY + searchRadiusY));

      // Kernel pequeño para detectar masa sólida oscura
      const kw = 3;
      for (let y = y0; y <= y1 - kw; y += 2) {
        for (let x = x0; x <= x1 - kw; x += 2) {
          let patchDarkSum = 0;
          for (let ky = 0; ky < kw; ky++) {
            for (let kx = 0; kx < kw; kx++) {
              patchDarkSum += gray[(y + ky) * sw + (x + kx)];
            }
          }
          const patchAvg = patchDarkSum / (kw * kw);

          // Si es muy oscuro
          if (patchAvg < markerThreshold) {
            // Evaluar contraste con los alrededores
            const score = markerThreshold - patchAvg;
            if (score > bestScore) {
              bestScore = score;
              bestX = x + Math.floor(kw / 2);
              bestY = y + Math.floor(kw / 2);
            }
          }
        }
      }

      if (bestX !== -1 && bestY !== -1) {
        // Refinamiento subpíxel por centroide local en la imagen original
        const origX = bestX * scale;
        const origY = bestY * scale;
        const refined = this.refineCentroid(data, width, height, origX, origY, 20);

        detectedPoints.push({
          x: refined.x / width,
          y: refined.y / height
        });
      } else if (currentPins && currentPins[i]) {
        // Mantener posición previa si no se encontró en este cuadrante
        detectedPoints.push({ x: currentPins[i].x, y: currentPins[i].y });
      } else {
        return null;
      }
    }

    // Validar geometría del cuadrilátero resultante
    if (!this.isValidQuad(detectedPoints)) {
      return null;
    }

    return detectedPoints;
  }

  /**
   * Refina el centroide de un marcador oscuro en una ventana local
   */
  static refineCentroid(data, width, height, centerX, centerY, windowSize) {
    const half = Math.floor(windowSize / 2);
    const x0 = Math.max(0, centerX - half);
    const x1 = Math.min(width - 1, centerX + half);
    const y0 = Math.max(0, centerY - half);
    const y1 = Math.min(height - 1, centerY + half);

    let sumX = 0, sumY = 0, totalWeight = 0;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const weight = Math.max(0, 120 - lum); // Más peso a píxeles más oscuros
        if (weight > 20) {
          sumX += x * weight;
          sumY += y * weight;
          totalWeight += weight;
        }
      }
    }

    if (totalWeight > 0) {
      return { x: sumX / totalWeight, y: sumY / totalWeight };
    }
    return { x: centerX, y: centerY };
  }

  /**
   * Valida que los 4 puntos formen un cuadrilátero coherente
   */
  static isValidQuad(pts) {
    if (pts.length !== 4) return false;

    const [tl, tr, br, bl] = pts;

    // Top-left debe estar a la izquierda de top-right y arriba de bottom-left
    if (tl.x >= tr.x || bl.x >= br.x) return false;
    if (tl.y >= bl.y || tr.y >= br.y) return false;

    // Ancho y alto mínimos
    const topWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const botWidth = Math.hypot(br.x - bl.x, br.y - bl.y);
    const leftHeight = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const rightHeight = Math.hypot(br.x - tr.x, br.y - tr.y);

    const avgWidth = (topWidth + botWidth) / 2;
    const avgHeight = (leftHeight + rightHeight) / 2;

    if (avgWidth < 0.15 || avgHeight < 0.10) return false;

    // Relación de aspecto del rollito (ideal ~ 1.5 a 1.6)
    const aspect = avgWidth / avgHeight;
    if (aspect < 0.9 || aspect > 2.6) return false;

    return true;
  }
}
