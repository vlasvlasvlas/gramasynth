/**
 * Gramasynth ROLLITO — Pattern Data Model
 * 16 steps (horizontal) x 8 rows (vertical)
 * 
 * Rows 0..3: Melodía (Lead, Arp, Harmony, Bass)
 * Rows 4..7: Ritmo (Perc/OpenHat, ClosedHat, Snare, Kick)
 * 
 * Cell Types:
 * - 'trigger': Punto/círculo (staccato corto / golpe percusivo)
 * - 'sustain': Línea horizontal (nota ligada que se prolonga)
 * - 'accent': Línea vertical (golpe con acento / apertura de filtro)
 * - 'rich': Cuadrado relleno (timbre rico en armónicos / distorsión)
 */

export class Pattern {
  constructor(id = 'custom', source = 'manual', kind = 'hand_drawn') {
    this.id = id;
    this.source = source; // 'template' | 'camera' | 'manual'
    this.kind = kind;     // 'printed' | 'hand_drawn' | 'hybrid'
    this.steps = 16;
    this.rows = 8;
    this.confidence = 1.0;
    this.capturedAt = new Date().toISOString();
    
    // Matriz de 8 filas x 16 columnas
    this.cells = Array.from({ length: 8 }, () =>
      Array.from({ length: 16 }, () => ({
        active: false,
        type: 'trigger', // 'trigger' | 'sustain' | 'accent' | 'rich'
        confidence: 1.0
      }))
    );
  }

  clone() {
    const copy = new Pattern(this.id, this.source, this.kind);
    copy.confidence = this.confidence;
    copy.capturedAt = this.capturedAt;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 16; c++) {
        copy.cells[r][c] = { ...this.cells[r][c] };
      }
    }
    return copy;
  }

  toggleCell(row, col, cellType = 'trigger') {
    if (row < 0 || row >= 8 || col < 0 || col >= 16) return;
    const cell = this.cells[row][col];
    if (cell.active) {
      cell.active = false;
    } else {
      cell.active = true;
      cell.type = cellType;
    }
  }

  setCell(row, col, active, type = 'trigger', confidence = 1.0) {
    if (row < 0 || row >= 8 || col < 0 || col >= 16) return;
    this.cells[row][col] = { active, type, confidence };
  }

  clear() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 16; c++) {
        this.cells[r][c] = { active: false, type: 'trigger', confidence: 1.0 };
      }
    }
  }
}

/**
 * 5 Plantillas Musicales Predefinidas correspondientes a la tira física
 */
export const TEMPLATES = {
  template_01: () => {
    const p = new Pattern('t1', 'template', 'printed');
    // Ritmo: 4-on-the-floor
    // Fila 7: Kick en 0, 4, 8, 12
    [0, 4, 8, 12].forEach(c => p.setCell(7, c, true, 'rich'));
    // Fila 6: Snare en 4, 12
    [4, 12].forEach(c => p.setCell(6, c, true, 'trigger'));
    // Fila 5: Closed Hat en 2, 6, 10, 14
    [2, 6, 10, 14].forEach(c => p.setCell(5, c, true, 'trigger'));
    // Melodía: Bajo con sustain en fila 3
    [0, 1, 4, 5, 8, 9, 12, 13].forEach(c => p.setCell(3, c, true, 'sustain'));
    // Nota alta en fila 1
    [2, 10].forEach(c => p.setCell(1, c, true, 'trigger'));
    return p;
  },

  template_02: () => {
    const p = new Pattern('t2', 'template', 'printed');
    // Ritmo sincopado: Kick en 0, 3, 8, 11
    [0, 3, 8, 11].forEach(c => p.setCell(7, c, true, 'rich'));
    [4, 12].forEach(c => p.setCell(6, c, true, 'trigger'));
    [2, 6, 10, 14].forEach(c => p.setCell(5, c, true, 'trigger'));
    // Arpegio ascendente / descendente
    p.setCell(3, 0, true, 'trigger');
    p.setCell(2, 2, true, 'trigger');
    p.setCell(1, 4, true, 'trigger');
    p.setCell(0, 6, true, 'accent');
    p.setCell(1, 8, true, 'trigger');
    p.setCell(2, 10, true, 'trigger');
    p.setCell(3, 12, true, 'trigger');
    p.setCell(2, 14, true, 'trigger');
    return p;
  },

  template_03: () => {
    const p = new Pattern('t3', 'template', 'printed');
    // Ambient Pads sostenidos (Líneas horizontales continuas)
    for (let c = 0; c < 8; c++) p.setCell(1, c, true, 'sustain');
    for (let c = 8; c < 16; c++) p.setCell(2, c, true, 'sustain');
    // Percusión minimalista
    [0, 8].forEach(c => p.setCell(7, c, true, 'trigger'));
    [4, 12].forEach(c => p.setCell(4, c, true, 'trigger'));
    return p;
  },

  template_04: () => {
    const p = new Pattern('t4', 'template', 'printed');
    // Electro Acid con acentos verticales
    [0, 4, 8, 12].forEach(c => p.setCell(7, c, true, 'rich'));
    [2, 6, 10, 14].forEach(c => p.setCell(5, c, true, 'trigger'));
    // Bajo con acentos en pasos específicos
    p.setCell(3, 0, true, 'trigger');
    p.setCell(3, 2, true, 'accent');
    p.setCell(3, 4, true, 'trigger');
    p.setCell(2, 6, true, 'accent');
    p.setCell(3, 8, true, 'trigger');
    p.setCell(1, 10, true, 'accent');
    p.setCell(2, 12, true, 'trigger');
    p.setCell(0, 14, true, 'accent');
    return p;
  },

  template_05: () => {
    const p = new Pattern('t5', 'template', 'printed');
    // Polirritmia 3 contra 4
    // Polirritmo en percusión (cada 3 semicorcheas)
    [0, 3, 6, 9, 12, 15].forEach(c => p.setCell(6, c, true, 'trigger'));
    [0, 4, 8, 12].forEach(c => p.setCell(7, c, true, 'rich'));
    // Melodía pentatónica en contrapunto
    [0, 1, 6, 7, 12, 13].forEach(c => p.setCell(2, c, true, 'sustain'));
    [4, 10].forEach(c => p.setCell(0, c, true, 'trigger'));
    return p;
  }
};
