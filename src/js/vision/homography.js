/**
 * Gramasynth ROLLITO — Homography & Perspective Rectification
 * 
 * Calcula la matriz de homografía 3x3 proyectiva (Direct Linear Transformation)
 * y rectifica el bloque de papel inclinado hacia un canvas ortogonal plano.
 */

export class HomographyTransformer {
  /**
   * Resuelve el sistema de ecuaciones para encontrar la matriz H 3x3
   * que mapea los puntos src [p0, p1, p2, p3] a dst [d0, d1, d2, d3]
   */
  static getPerspectiveTransform(src, dst) {
    // Cada punto tiene {x, y}
    const a = [];
    for (let i = 0; i < 4; i++) {
      const sx = src[i].x;
      const sy = src[i].y;
      const dx = dst[i].x;
      const dy = dst[i].y;

      a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy, dx]);
      a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy, dy]);
    }

    // Resolución por eliminación gaussiana simplificada
    const h = this.solveGaussian(a);
    return [
      h[0], h[1], h[2],
      h[3], h[4], h[5],
      h[6], h[7], 1.0
    ];
  }

  static solveGaussian(A) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }
      const tmp = A[i];
      A[i] = A[maxRow];
      A[maxRow] = tmp;

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j <= n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = A[i][n] / A[i][i];
      for (let k = i - 1; k >= 0; k--) {
        A[k][n] -= A[k][i] * x[i];
      }
    }
    return x;
  }

  /**
   * Invierte una matriz 3x3
   */
  static invertMatrix(M) {
    const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = M;
    const det = m00 * (m11 * m22 - m12 * m21) -
                m01 * (m10 * m22 - m12 * m20) +
                m02 * (m10 * m21 - m11 * m20);

    if (Math.abs(det) < 1e-8) return null;
    const invdet = 1.0 / det;

    return [
      (m11 * m22 - m12 * m21) * invdet,
      (m02 * m21 - m01 * m22) * invdet,
      (m01 * m12 - m02 * m11) * invdet,
      (m12 * m20 - m10 * m22) * invdet,
      (m00 * m22 - m02 * m20) * invdet,
      (m02 * m10 - m00 * m12) * invdet,
      (m10 * m21 - m11 * m20) * invdet,
      (m01 * m20 - m00 * m21) * invdet,
      (m00 * m11 - m01 * m10) * invdet
    ];
  }

  /**
   * Rectifica la imagen de origen a la imagen de destino ortogonal
   */
  static warpPerspective(srcImageData, dstCanvas, cornerPoints) {
    const dstWidth = dstCanvas.width;
    const dstHeight = dstCanvas.height;
    const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
    const dstImageData = dstCtx.createImageData(dstWidth, dstHeight);

    const dstPoints = [
      { x: 0, y: 0 },
      { x: dstWidth, y: 0 },
      { x: dstWidth, y: dstHeight },
      { x: 0, y: dstHeight }
    ];

    // Matriz de mapeo de dst -> src (mapeo inverso para evitar huecos en el destino)
    const H = this.getPerspectiveTransform(dstPoints, cornerPoints);

    const srcWidth = srcImageData.width;
    const srcHeight = srcImageData.height;
    const srcData = srcImageData.data;
    const dstData = dstImageData.data;

    const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;

    for (let dy = 0; dy < dstHeight; dy++) {
      for (let dx = 0; dx < dstWidth; dx++) {
        // Coordenadas homogéneas
        const w = h6 * dx + h7 * dy + h8;
        if (Math.abs(w) < 1e-6) continue;

        const sx = (h0 * dx + h1 * dy + h2) / w;
        const sy = (h3 * dx + h4 * dy + h5) / w;

        // Bilinear interpolation o nearest neighbor rápido
        const isx = Math.round(sx);
        const isy = Math.round(sy);

        if (isx >= 0 && isx < srcWidth && isy >= 0 && isy < srcHeight) {
          const srcIdx = (isy * srcWidth + isx) * 4;
          const dstIdx = (dy * dstWidth + dx) * 4;

          dstData[dstIdx] = srcData[srcIdx];
          dstData[dstIdx + 1] = srcData[srcIdx + 1];
          dstData[dstIdx + 2] = srcData[srcIdx + 2];
          dstData[dstIdx + 3] = 255;
        }
      }
    }

    dstCtx.putImageData(dstImageData, 0, 0);
  }
}
