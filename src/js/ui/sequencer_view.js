/**
 * Gramasynth ROLLITO — Sequencer Grid Canvas View
 * 
 * Renderizado de alta resolución de la grilla 16x8:
 * - Banda Melódica Superior (Filas 0..3)
 * - Banda Rítmica Inferior (Filas 4..7)
 * - Visualización de ACTIVE (Cyan), PENDING (Magenta), PREVIEW (Ámbar)
 * - Cursor de reproducción sincronizado
 * - Edición interactiva por clic
 */

export class SequencerView {
  constructor(canvasElement, onCellClick = null) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onCellClick = onCellClick;

    this.activePattern = null;
    this.previewPattern = null;
    this.pendingPattern = null;
    this.currentStep = -1;

    this.rowLabels = [
      '▲ C5 Lead',
      '▲ A4 Mid',
      '▲ G4 Low',
      '▲ C4 Bass',
      '▼ Perc / OH',
      '▼ Closed Hat',
      '▼ Snare',
      '▼ Kick'
    ];

    this.setupEvents();
  }

  setupEvents() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const labelWidth = Math.round(this.canvas.width * 0.105);
      if (clickX < labelWidth) return;

      const gridWidth = this.canvas.width - labelWidth;
      const colWidth = gridWidth / 16;
      const rowHeight = this.canvas.height / 8;

      const col = Math.floor((clickX - labelWidth) / colWidth);
      const row = Math.floor(clickY / rowHeight);

      if (row >= 0 && row < 8 && col >= 0 && col < 16 && this.onCellClick) {
        this.onCellClick(row, col);
      }
    });
  }

  update(active, preview, pending, currentStep) {
    this.activePattern = active;
    this.previewPattern = preview;
    this.pendingPattern = pending;
    this.currentStep = currentStep;
    this.draw();
  }

  draw() {
    // Sincronizar resolución interna del canvas con su tamaño real en pantalla
    const dw = this.canvas.offsetWidth;
    const dh = this.canvas.offsetHeight;
    if (dw > 0 && dh > 0 && (this.canvas.width !== dw || this.canvas.height !== dh)) {
      this.canvas.width = dw;
      this.canvas.height = dh;
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Fondo general
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, w, h);

    const labelWidth = Math.round(w * 0.105); // ~10.5% del ancho — escala con el canvas
    const gridWidth = w - labelWidth;
    const colWidth = gridWidth / 16;
    const rowHeight = h / 8;
    const fontSize = Math.max(10, Math.min(14, Math.round(rowHeight * 0.32)));

    // Línea divisoria central en Y = 4 filas (Separación Melodía / Ritmo de 3 cm)
    ctx.fillStyle = '#161922';
    ctx.fillRect(labelWidth, 0, gridWidth, rowHeight * 4); // Melodía
    ctx.fillStyle = '#11131a';
    ctx.fillRect(labelWidth, rowHeight * 4, gridWidth, rowHeight * 4); // Ritmo

    // Resaltar columna del paso actual
    if (this.currentStep >= 0 && this.currentStep < 16) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fillRect(labelWidth + this.currentStep * colWidth, 0, colWidth, h);
    }

    // Dibujar etiquetas de filas
    for (let r = 0; r < 8; r++) {
      const y = r * rowHeight;
      ctx.fillStyle = (r < 4) ? '#6ee7b7' : '#f472b6';
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.fillText(this.rowLabels[r], 8, y + rowHeight * 0.62);

      // Línea horizontal de grilla
      ctx.strokeStyle = (r === 4) ? '#38bdf8' : '#232838';
      ctx.lineWidth = (r === 4) ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(labelWidth, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Líneas verticales de columnas
    for (let c = 0; c <= 16; c++) {
      const x = labelWidth + c * colWidth;
      ctx.strokeStyle = (c % 4 === 0) ? '#475569' : '#1e2433';
      ctx.lineWidth = (c % 4 === 0) ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Dibujar celdas ACTIVE (Cyan sólido)
    if (this.activePattern) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 16; c++) {
          const cell = this.activePattern.cells[r][c];
          if (cell && cell.active) {
            const cx = labelWidth + c * colWidth;
            const cy = r * rowHeight;
            this.drawCellShape(ctx, cx, cy, colWidth, rowHeight, cell.type, '#00f0ff', true);
          }
        }
      }
    }

    // Dibujar celdas PENDING (Magenta outline brillante)
    if (this.pendingPattern) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 16; c++) {
          const cell = this.pendingPattern.cells[r][c];
          if (cell && cell.active) {
            const cx = labelWidth + c * colWidth;
            const cy = r * rowHeight;
            this.drawCellShape(ctx, cx, cy, colWidth, rowHeight, cell.type, '#ec4899', false);
          }
        }
      }
    }

    // Dibujar celdas PREVIEW (Ámbar punteado/congelado)
    if (this.previewPattern) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 16; c++) {
          const cell = this.previewPattern.cells[r][c];
          if (cell && cell.active) {
            const cx = labelWidth + c * colWidth;
            const cy = r * rowHeight;
            this.drawCellShape(ctx, cx, cy, colWidth, rowHeight, cell.type, '#f59e0b', false, true);
          }
        }
      }
    }
  }

  drawCellShape(ctx, x, y, w, h, type, color, fill = true, isDashed = false) {
    const padX = w * 0.15;
    const padY = h * 0.15;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (isDashed) ctx.setLineDash([3, 3]);

    if (type === 'sustain') {
      // Barra horizontal alargada
      const by = y + h * 0.35;
      const bh = h * 0.3;
      if (fill) {
        ctx.fillRect(x + 2, by, w - 4, bh);
      } else {
        ctx.strokeRect(x + 2, by, w - 4, bh);
      }
    } else if (type === 'accent') {
      // Marca vertical de acento
      const bx = x + w * 0.4;
      const bw = w * 0.2;
      if (fill) {
        ctx.fillRect(bx, y + 4, bw, h - 8);
      } else {
        ctx.strokeRect(bx, y + 4, bw, h - 8);
      }
    } else if (type === 'rich') {
      // Bloque cuadrado completo
      if (fill) {
        ctx.fillRect(x + padX, y + padY, innerW, innerH);
      } else {
        ctx.strokeRect(x + padX, y + padY, innerW, innerH);
      }
    } else {
      // Trigger: Círculo / Punto
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(innerW, innerH) * 0.38;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (fill) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
