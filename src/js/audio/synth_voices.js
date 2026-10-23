/**
 * Gramasynth ROLLITO — Synth Voices & DSP Engine
 * 
 * Rows 0..3: Melodic Synth Voices (Pentatonic / Diatonic)
 * Rows 4..7: Synthetic Drum Voices (Perc, HiHat, Snare, Kick)
 */

export class VoicePool {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Frecuencias base para las 4 filas melódicas (Escala Pentatónica Mayor en Do: C5, A4, G4, E4 / C4)
    this.melodyFrequencies = [
      523.25, // Fila 0: Do5 / C5 (Lead agudo)
      440.00, // Fila 1: La4 / A4
      392.00, // Fila 2: Sol4 / G4
      261.63  // Fila 3: Do4 / C4 (Bajo)
    ];

    // Buffer de ruido blanco precalculado para percusión (Snare / Hats)
    this.noiseBuffer = this.createNoiseBuffer();
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Dispara una voz según la fila (0..7) y el tipo de gesto
   */
  trigger(row, time, cellType = 'trigger', stepDuration = 0.125) {
    if (row < 4) {
      this.playMelodic(row, time, cellType, stepDuration);
    } else {
      this.playDrum(row, time, cellType);
    }
  }

  // ==================== VOCES MELÓDICAS (0..3) ====================
  playMelodic(row, time, cellType, stepDuration) {
    const freq = this.melodyFrequencies[row] || 440;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    // Tipo de forma de onda según gesto
    if (cellType === 'rich') {
      osc.type = 'sawtooth';
    } else if (cellType === 'accent') {
      osc.type = 'triangle';
    } else {
      osc.type = 'sine';
    }
    osc.frequency.setValueAtTime(freq, time);

    // Configuración de filtro resonante
    filter.type = 'lowpass';
    if (cellType === 'accent') {
      // Apertura dramática de filtro para acentos
      filter.frequency.setValueAtTime(3200, time);
      filter.frequency.exponentialRampToValueAtTime(800, time + 0.18);
      filter.Q.setValueAtTime(6.0, time);
    } else {
      filter.frequency.setValueAtTime(1400, time);
      filter.Q.setValueAtTime(2.0, time);
    }

    // Duración de la envolvente
    let duration = 0.12;
    if (cellType === 'sustain') {
      duration = stepDuration * 1.25; // Se solapa suavemente con el siguiente paso
    }

    // Envolvente ADSR suave sin clicks
    const peakGain = (cellType === 'accent') ? 0.35 : 0.22;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // ==================== VOCES PERCUSIVAS (4..7) ====================
  playDrum(row, time, cellType) {
    switch (row) {
      case 7: // Fila 7: Bombo / Kick
        this.playKick(time, cellType);
        break;
      case 6: // Fila 6: Caja / Snare
        this.playSnare(time, cellType);
        break;
      case 5: // Fila 5: Hi-Hat Cerrado
        this.playHiHat(time, false, cellType);
        break;
      case 4: // Fila 4: Hi-Hat Abierto / Percusión
        this.playHiHat(time, true, cellType);
        break;
    }
  }

  playKick(time, cellType) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = (cellType === 'rich' || cellType === 'accent') ? 160 : 120;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    const volume = (cellType === 'accent') ? 0.8 : 0.6;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  playSnare(time, cellType) {
    // Ruido filtrado
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1200, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Tono base
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, time);
    osc.frequency.exponentialRampToValueAtTime(90, time + 0.07);

    oscGain.gain.setValueAtTime(0.3, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.18);
    osc.stop(time + 0.18);
  }

  playHiHat(time, isOpen, cellType) {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    const duration = isOpen ? 0.25 : 0.05;
    const volume = (cellType === 'accent') ? 0.4 : 0.25;

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + duration + 0.02);
  }
}
