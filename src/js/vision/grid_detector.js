/**
 * Gramasynth ROLLITO — Grid Detector & Cell Sampler
 * 
 * Muestrea la imagen rectificada (480x240 px) dividiéndola en 16x8 celdas.
 * Aplica una zona de guarda interior del 60% (ignorando las líneas impresas del papel)
 * y evalúa la clasificación morfológica con cálculo de confianza.
 */

import { Pattern } from '../core/pattern.js';
import { MorphologicalClassifier } from './morphological.js';

export class GridDetector {
  constructor(rectifiedCanvas) {
    this.canvas = rectifiedCanvas;
    this.cols = 16;
    this.rows = 8;
  }

  /**
   * Muestrea el canvas rectificado y devuelve un objeto Pattern candidato
   */
  detectPattern(thresholdValue = 125) {
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imgData.data;

    const cellWidth = this.canvas.width / this.cols;
    const cellHeight = this.canvas.height / this.rows;

    const pattern = new Pattern('camera_read', 'camera', 'hybrid');
    let totalConfidence = 0;
    let activeCellCount = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Coordenadas absolutas de la celda
        const startX = Math.round(c * cellWidth);
        const startY = Math.round(r * cellHeight);

        // Zona de guarda central del 60% (evita líneas de borde de la celda)
        const padX = Math.round(cellWidth * 0.20);
        const padY = Math.round(cellHeight * 0.20);

        const sampleX = startX + padX;
        const sampleY = startY + padY;
        const sampleW = Math.max(1, Math.round(cellWidth * 0.60));
        const sampleH = Math.max(1, Math.round(cellHeight * 0.60));

        // Binarización local
        const cellBinary = new Uint8Array(sampleW * sampleH);
        let cellLuminanceSum = 0;

        for (let py = 0; py < sampleH; py++) {
          for (let px = 0; px < sampleW; px++) {
            const idx = ((sampleY + py) * this.canvas.width + (sampleX + px)) * 4;
            // Luminancia ITU-R BT.601
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            cellLuminanceSum += lum;
          }
        }

        const avgLum = cellLuminanceSum / (sampleW * sampleH);
        // Umbral adaptativo: oscuro relativo al fondo del papel local
        const localThreshold = Math.min(thresholdValue, avgLum - 15);

        for (let py = 0; py < sampleH; py++) {
          for (let px = 0; px < sampleW; px++) {
            const idx = ((sampleY + py) * this.canvas.width + (sampleX + px)) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            // 1 si es trazo oscuro, 0 si es papel blanco
            cellBinary[py * sampleW + px] = (lum < localThreshold) ? 1 : 0;
          }
        }

        // Clasificación morfológica del trazo
        const result = MorphologicalClassifier.classify(cellBinary, sampleW, sampleH);
        pattern.setCell(r, c, result.active, result.type, result.confidence);

        totalConfidence += result.confidence;
        if (result.active) activeCellCount++;
      }
    }

    pattern.confidence = Math.round((totalConfidence / (this.rows * this.cols)) * 100) / 100;
    return {
      pattern,
      activeCellCount,
      confidence: pattern.confidence,
      isAcceptable: pattern.confidence >= 0.60
    };
  }
}
