/**
 * Gramasynth ROLLITO — State Machine (FSM)
 * 
 * Estados:
 * - IDLE: Motor detenido, esperando activación
 * - RUNNING: Reproduciendo patrón ACTIVE en bucle
 * - PREVIEW: Patrón candidato recién capturado por la cámara (congelado para inspección / edición)
 * - PENDING: Patrón aceptado, encolado para ingresar exactamente en el próximo compás (paso 0)
 */

export const EngineState = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PREVIEW: 'PREVIEW',
  PENDING: 'PENDING'
};

export class StateMachine {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.state = EngineState.IDLE;

    this.activePattern = null;
    this.previewPattern = null;
    this.pendingPattern = null;

    // Listeners
    this.listeners = new Set();

    // Conectar el callback de frontera de compás del motor de audio
    this.audio.onLoopBoundary = () => this.handleLoopBoundary();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        state: this.state,
        active: this.activePattern,
        preview: this.previewPattern,
        pending: this.pendingPattern
      });
    }
  }

  start(initialPattern) {
    this.activePattern = initialPattern;
    this.previewPattern = null;
    this.pendingPattern = null;
    this.state = EngineState.RUNNING;
    this.audio.start(this.activePattern);
    this.notify();
  }

  stop() {
    this.audio.stop();
    this.state = EngineState.IDLE;
    this.notify();
  }

  setBpm(bpm) {
    this.audio.setBpm(bpm);
  }

  /**
   * Captura un nuevo patrón desde la cámara o selector digital.
   * Lo coloca en estado PREVIEW (congelado para revisión, NO afecta al sonido activo).
   */
  setPreview(pattern) {
    this.previewPattern = pattern;
    if (this.state === EngineState.RUNNING || this.state === EngineState.IDLE) {
      this.state = EngineState.PREVIEW;
    }
    this.notify();
  }

  /**
   * Acepta el candidato de PREVIEW y lo encola en PENDING.
   * Se activará en el próximo límite de compás (paso 0).
   */
  acceptCandidate() {
    if (!this.previewPattern) return;

    this.pendingPattern = this.previewPattern;
    this.previewPattern = null;

    if (this.audio.isRunning) {
      this.state = EngineState.PENDING;
    } else {
      // Si el motor está detenido, pasa a ser active directamente
      this.activePattern = this.pendingPattern;
      this.pendingPattern = null;
      this.state = EngineState.RUNNING;
      this.audio.updateActivePattern(this.activePattern);
    }

    this.notify();
  }

  /**
   * Descarta el candidato en PREVIEW.
   */
  discardCandidate() {
    this.previewPattern = null;
    if (this.state === EngineState.PREVIEW) {
      this.state = this.pendingPattern ? EngineState.PENDING : (this.audio.isRunning ? EngineState.RUNNING : EngineState.IDLE);
    }
    this.notify();
  }

  /**
   * Se ejecuta automáticamente en el límite del compás (al pasar de 15 a 0).
   * Realiza el cambio cuantizado sin cortes ni interrupción del audio.
   */
  handleLoopBoundary() {
    if (this.pendingPattern) {
      // Transición cuantizada suave
      this.activePattern = this.pendingPattern;
      this.pendingPattern = null;
      this.audio.updateActivePattern(this.activePattern);

      if (this.state === EngineState.PENDING) {
        this.state = EngineState.RUNNING;
      }
      this.notify();
    }
  }

  /**
   * Permite editar manualmente una celda en PREVIEW o ACTIVE
   */
  editCell(row, col, target = 'preview') {
    const pattern = target === 'preview' ? (this.previewPattern || this.activePattern) : this.activePattern;
    if (!pattern) return;

    pattern.toggleCell(row, col);
    this.notify();
  }
}
