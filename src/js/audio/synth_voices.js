/**
 * Gramasynth ROLLITO — Synth Voices & DSP Engine
 * 
 * Rows 0..3: Melodic Synth Voices (Pentatonic / Diatonic)
 * Rows 4..7: Synthetic Drum Voices (Perc, HiHat, Snare, Kick)
 */

const KITS = {
  electronic: {
    melodyWave: 'sine',
    kick:  { startFreq: 120, endFreq: 42,  dur: 0.22, vol: 0.6 },
    snare: { hpFreq: 1200, oscFreq: 185, dur: 0.15, vol: 0.35 },
    hat:   { hpFreq: 7500, openDur: 0.25, closedDur: 0.05, vol: 0.25 },
  },
  acoustic: {
    melodyWave: 'triangle',
    kick:  { startFreq: 90,  endFreq: 38,  dur: 0.35, vol: 0.7 },
    snare: { hpFreq: 900,  oscFreq: 160, dur: 0.22, vol: 0.45 },
    hat:   { hpFreq: 6000, openDur: 0.40, closedDur: 0.08, vol: 0.20 },
  },
  lofi: {
    melodyWave: 'square',
    kick:  { startFreq: 100, endFreq: 50,  dur: 0.28, vol: 0.5 },
    snare: { hpFreq: 800,  oscFreq: 200, dur: 0.20, vol: 0.40 },
    hat:   { hpFreq: 5000, openDur: 0.18, closedDur: 0.06, vol: 0.18 },
  },
  '8bit': {
    melodyWave: 'square',
    kick:  { startFreq: 200, endFreq: 60,  dur: 0.12, vol: 0.55 },
    snare: { hpFreq: 2000, oscFreq: 250, dur: 0.08, vol: 0.30 },
    hat:   { hpFreq: 9000, openDur: 0.10, closedDur: 0.03, vol: 0.22 },
  },
};

export class VoicePool {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.kit = KITS.electronic;

    this.melodyFrequencies = [
      523.25, // C5
      440.00, // A4
      392.00, // G4
      261.63  // C4
    ];

    this.noiseBuffer = this.createNoiseBuffer();
  }

  setKit(kitName) {
    this.kit = KITS[kitName] || KITS.electronic;
  }

  setRootNote(semitone) {
    // Intervalos de la pentatónica mayor desde la raíz: raíz+12, +9, +7, +0
    const intervals = [12, 9, 7, 0];
    this.melodyFrequencies = intervals.map(i =>
      440 * Math.pow(2, (60 + semitone + i - 69) / 12)
    );
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

    // Tipo de forma de onda: rich/accent sobreescriben el kit base
    if (cellType === 'rich') {
      osc.type = 'sawtooth';
    } else if (cellType === 'accent') {
      osc.type = 'triangle';
    } else {
      osc.type = this.kit.melodyWave || 'sine';
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

    // Duración de la envolvente según gesto
    let duration = 0.12;
    if (cellType === 'sustain') {
      duration = Math.max(0.18, stepDuration * 0.96); // Se sostiene durante toda la línea continua
    }

    // Envolvente ADSR suave sin clicks
    const peakGain = (cellType === 'accent') ? 0.36 : 0.24;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.015);

    // Si es una línea continua larga, mantener el nivel de sustain estable antes del release
    if (cellType === 'sustain' && duration > 0.2) {
      gain.gain.setValueAtTime(peakGain * 0.88, time + duration - 0.06);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.06);
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
    const k = this.kit.kick;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = (cellType === 'rich' || cellType === 'accent') ? k.startFreq * 1.3 : k.startFreq;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(k.endFreq, time + 0.08);

    const volume = (cellType === 'accent') ? k.vol * 1.3 : k.vol;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + k.dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + k.dur + 0.02);
  }

  playSnare(time, cellType) {
    const s = this.kit.snare;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(s.hpFreq, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(s.vol, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + s.dur);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(s.oscFreq, time);
    osc.frequency.exponentialRampToValueAtTime(s.oscFreq * 0.5, time + 0.07);

    oscGain.gain.setValueAtTime(s.vol * 0.85, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + s.dur * 0.7);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(time);
    osc.start(time);
    noise.stop(time + s.dur + 0.03);
    osc.stop(time + s.dur + 0.03);
  }

  playHiHat(time, isOpen, cellType) {
    const h = this.kit.hat;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(h.hpFreq, time);

    const gain = this.ctx.createGain();
    const duration = isOpen ? h.openDur : h.closedDur;
    const volume = (cellType === 'accent') ? h.vol * 1.6 : h.vol;

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + duration + 0.02);
  }
}
