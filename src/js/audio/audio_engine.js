/**
 * Gramasynth ROLLITO — Lookahead Audio Engine & Transport
 * 
 * Basado en el estándar de Web Audio Lookahead Scheduler:
 * - Temporizador web periódico ligero (cada 25 ms)
 * - Programa notas con anticipación (ventana de 100 ms) sobre AudioContext.currentTime
 * - Inmune al jitter del hilo principal de JS
 * - Garantiza transiciones sin cortes (gapless) en fronteras de compás (paso 15 -> paso 0)
 */

import { VoicePool } from './synth_voices.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.voices = null;
    this.bpm = 110;
    this.isRunning = false;

    // Parámetros de Lookahead
    this.lookaheadMs = 25.0;      // Frecuencia con la que se evalúa la cola (ms)
    this.scheduleAheadSec = 0.1;  // Ventana de anticipación para programar audio (s)
    this.currentStep = 0;         // Paso musical (0..15)
    this.nextStepTime = 0.0;      // Tiempo exacto de AudioContext para el siguiente paso
    this.timerId = null;

    // Callbacks
    this.onStepChange = null;       // (step: number) => void
    this.onLoopBoundary = null;     // () => void (al pasar de 15 a 0)

    // Referencia al patrón activo
    this.activePattern = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.voices = new VoicePool(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, bpm));
  }

  getStepDuration() {
    // BPM = negras por minuto. 1 compás de 4/4 = 16 semicorcheas.
    // Duración de 1 semicorchea = (60 / BPM) / 4
    return (60.0 / this.bpm) / 4.0;
  }

  start(pattern) {
    this.init();
    this.activePattern = pattern;
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentStep = 0;
    // Programamos el primer paso ligeramente adelante en el tiempo de hardware
    this.nextStepTime = this.ctx.currentTime + 0.05;

    this.timerId = setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentStep = 0;
    if (this.onStepChange) this.onStepChange(-1);
  }

  scheduler() {
    if (!this.isRunning || !this.ctx) return;

    // Mientras el siguiente paso caiga dentro de la ventana de anticipación
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadSec) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  scheduleStep(step, time) {
    if (!this.activePattern) return;

    const stepDuration = this.getStepDuration();

    // Disparamos las notas de cada fila para este paso con soporte de ligaduras continuas
    for (let r = 0; r < 8; r++) {
      const cell = this.activePattern.cells[r][step];
      if (cell && cell.active) {
        if (r < 4 && cell.type === 'sustain') {
          // ¿Viene continuando una línea horizontal del paso anterior?
          const prevStep = (step - 1 + 16) % 16;
          const prevCell = this.activePattern.cells[r][prevStep];
          if (prevCell && prevCell.active && prevCell.type === 'sustain' && step !== 0) {
            // Ya está sonando la nota sostenida en legato; no re-disparamos el ataque
            continue;
          }

          // Calcular la longitud total de la línea continua
          let span = 1;
          for (let next = 1; next < 16; next++) {
            const s = (step + next) % 16;
            const nextCell = this.activePattern.cells[r][s];
            if (nextCell && nextCell.active && nextCell.type === 'sustain') {
              span++;
            } else {
              break;
            }
          }

          // Duración continua de la línea horizontal
          const continuousDuration = span * stepDuration;
          this.voices.trigger(r, time, cell.type, continuousDuration);
        } else {
          this.voices.trigger(r, time, cell.type, stepDuration);
        }
      }
    }

    // Sincronización visual con la interfaz mediante requestAnimationFrame en el momento exacto
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isRunning && this.onStepChange) {
        requestAnimationFrame(() => this.onStepChange(step));
      }
    }, delayMs);
  }

  advanceStep() {
    const stepDuration = this.getStepDuration();
    this.nextStepTime += stepDuration;

    this.currentStep = (this.currentStep + 1) % 16;

    // Frontera de compás / loop: al volver al paso 0 notificamos para cambio cuantizado
    if (this.currentStep === 0 && this.onLoopBoundary) {
      this.onLoopBoundary();
    }
  }

  updateActivePattern(newPattern) {
    this.activePattern = newPattern;
  }
}
