import { Pattern, TEMPLATES } from './core/pattern.js';
import { AudioEngine } from './audio/audio_engine.js';
import { StateMachine, EngineState } from './core/state_machine.js';
import { CameraManager } from './vision/camera.js';
import { HomographyTransformer } from './vision/homography.js';
import { GridDetector } from './vision/grid_detector.js';
import { CornerDetector } from './vision/corner_detector.js';
import { SequencerView } from './ui/sequencer_view.js';

class App {
  constructor() {
    // DOM Elements
    this.video = document.getElementById('webcam');
    this.pinCanvas = document.getElementById('pinCanvas');
    this.rectifiedCanvas = document.getElementById('rectifiedCanvas');
    this.processedCanvas = document.getElementById('processedCanvas');
    this.sequencerCanvas = document.getElementById('sequencerCanvas');

    this.statusBadge = document.getElementById('statusBadge');
    this.confidenceMeter = document.getElementById('confidenceMeter');
    this.candidateBanner = document.getElementById('candidateBanner');
    this.bannerIcon = document.getElementById('bannerIcon');
    this.bannerText = document.getElementById('bannerText');
    this.btnHelp = document.getElementById('btnHelp');
    this.helpModal = document.getElementById('helpModal');
    this.btnCloseHelp = document.getElementById('btnCloseHelp');
    this.cameraSelect = document.getElementById('cameraSelect');

    this.btnCamera = document.getElementById('btnCamera');
    this.btnMirror = document.getElementById('btnMirror');
    this.btnFlipV = document.getElementById('btnFlipV');
    this.btnAutoCorner = document.getElementById('btnAutoCorner');
    this.btnResetPins = document.getElementById('btnResetPins');
    this.autoTrackCheck = document.getElementById('autoTrackCheck');
    this.cornerDetectStatus = document.getElementById('cornerDetectStatus');

    this.btnCapture = document.getElementById('btnCapture');
    this.btnLiveMode = document.getElementById('btnLiveMode');
    this.btnAutoThreshold = document.getElementById('btnAutoThreshold');
    this.rootNoteSelect = document.getElementById('rootNoteSelect');
    this.btnPlay = document.getElementById('btnPlay');
    this.btnAccept = document.getElementById('btnAccept');
    this.btnDiscard = document.getElementById('btnDiscard');
    this.btnLoadTemplate = document.getElementById('btnLoadTemplate');
    this.templateSelect = document.getElementById('templateSelect');
    this.kitSelect = document.getElementById('kitSelect');

    this.brightnessSlider = document.getElementById('brightnessSlider');
    this.brightnessVal = document.getElementById('brightnessVal');
    this.contrastSlider = document.getElementById('contrastSlider');
    this.contrastVal = document.getElementById('contrastVal');
    this.thresholdSlider = document.getElementById('thresholdSlider');
    this.thresholdVal = document.getElementById('thresholdVal');
    this.bpmSlider = document.getElementById('bpmSlider');
    this.bpmVal = document.getElementById('bpmVal');

    // Canvases auxiliares
    this.rawCanvas = document.createElement('canvas');
    this.warpCanvas = document.createElement('canvas');
    this.warpCanvas.width = 480;
    this.warpCanvas.height = 240;

    // Modules
    this.audioEngine = new AudioEngine();
    this.stateMachine = new StateMachine(this.audioEngine);
    this.cameraManager = new CameraManager(this.video);
    this.gridDetector = new GridDetector(this.rectifiedCanvas);

    // Patrón detectado en vivo (último frame analizado)
    this.liveDetectedPattern = null;
    this.liveModePending = null;   // patrón esperando ser aplicado en el próximo compás
    this.isLiveModeOn = false;
    this.frameCount = 0;

    // 4 Corner Pins para la homografía interactiva (normalizados 0..1)
    // 0: TL, 1: TR, 2: BR, 3: BL
    this.cornerPins = [
      { x: 0.20, y: 0.25 }, // Top-Left
      { x: 0.80, y: 0.25 }, // Top-Right
      { x: 0.85, y: 0.80 }, // Bottom-Right
      { x: 0.15, y: 0.80 }  // Bottom-Left
    ];
    this.draggedPin = null;

    // Inicializar Sequencer View
    this.sequencerView = new SequencerView(this.sequencerCanvas, (r, c) => {
      this.stateMachine.editCell(r, c, this.stateMachine.previewPattern ? 'preview' : 'active');
    });

    this.init();
  }

  async init() {
    // Patrón inicial
    const initialPattern = TEMPLATES.template_01();
    this.stateMachine.activePattern = initialPattern;
    this.sequencerView.update(initialPattern, null, null, -1);

    // Audio Step Callback
    this.audioEngine.onStepChange = (step) => {
      // Modo Live: al inicio de cada compás (step 0) aplicar el patrón detectado
      if (step === 0 && this.isLiveModeOn && this.liveModePending) {
        this.stateMachine.activePattern = this.liveModePending;
        this.stateMachine.previewPattern = null;
        this.liveModePending = null;
      }

      this.sequencerView.update(
        this.stateMachine.activePattern,
        this.stateMachine.previewPattern,
        this.stateMachine.pendingPattern,
        step
      );
    };

    // FSM State Listener
    this.stateMachine.subscribe((fsm) => this.handleStateChange(fsm));

    this.setupUIEvents();
    this.setupPinCanvasEvents();
    this.setupKeyboardShortcuts();
    this.populateCameraDevices();

    // Loop de render de video, homografía y binarización en tiempo real
    requestAnimationFrame(() => this.videoProcessingLoop());
  }

  handleStateChange(fsm) {
    this.statusBadge.textContent = fsm.state;
    this.statusBadge.className = `status-badge status-${fsm.state.toLowerCase()}`;

    this.btnAccept.disabled = !fsm.preview;
    this.btnDiscard.disabled = !fsm.preview;

    if (this.candidateBanner) {
      this.candidateBanner.className = `candidate-banner state-${fsm.state.toLowerCase()}`;
      if (fsm.state === 'PREVIEW') {
        this.bannerIcon.textContent = '⚡';
        this.bannerText.textContent = 'Nuevo patrón capturado — ¿Sincronizar al próximo loop?';
      } else if (fsm.state === 'PENDING') {
        this.bannerIcon.textContent = '⌛';
        this.bannerText.textContent = 'Patrón en cola: entrará en el paso 0 del próximo compás.';
      } else if (fsm.state === 'RUNNING') {
        this.bannerIcon.textContent = '●';
        this.bannerText.textContent = 'En reproducción continua sincronizada (16 pasos en bucle).';
      } else {
        this.bannerIcon.textContent = '⏸';
        this.bannerText.textContent = 'Secuenciador listo. Captura un patrón de papel o inicia el audio.';
      }
    }

    this.sequencerView.update(
      fsm.active,
      fsm.preview,
      fsm.pending,
      this.audioEngine.currentStep
    );
  }

  setupUIEvents() {
    // Cámara
    this.btnCamera.addEventListener('click', async () => {
      if (this.cameraManager.stream) {
        this.cameraManager.stop();
        this.btnCamera.textContent = 'Activar Cámara';
      } else {
        await this.cameraManager.start(this.cameraSelect.value || null);
        this.btnCamera.textContent = 'Desactivar Cámara';
      }
    });

    // Inversión Horizontal (Paso 0 <-> 15)
    this.btnMirror.addEventListener('click', () => {
      this.cameraManager.toggleMirror();
      this.btnMirror.classList.toggle('btn-primary', this.cameraManager.isMirrored);
      this.drawPins();
      this.cornerDetectStatus.textContent = this.cameraManager.isMirrored ? "⇄ Espejo activo" : "⇄ Normal";
    });

    // Inversión Vertical (Melodía <-> Ritmo)
    this.btnFlipV.addEventListener('click', () => {
      this.cameraManager.toggleFlipV();
      this.btnFlipV.classList.toggle('btn-primary', this.cameraManager.isFlippedV);
      this.drawPins();
      this.cornerDetectStatus.textContent = this.cameraManager.isFlippedV ? "⇅ Ritmo arriba / Melodía abajo" : "⇅ Melodía arriba / Ritmo abajo";
    });

    // Auto-ajuste de esquinas
    this.btnAutoCorner.addEventListener('click', () => {
      this.autoDetectCorners(true);
    });

    // Reset / Centrar pines
    this.btnResetPins.addEventListener('click', () => {
      this.resetPins();
    });

    this.cameraSelect.addEventListener('change', async () => {
      if (this.cameraManager.stream) {
        await this.cameraManager.start(this.cameraSelect.value || null);
      }
    });

    // Root note selector
    if (this.rootNoteSelect) {
      this.rootNoteSelect.addEventListener('change', (e) => {
        const semitone = parseInt(e.target.value, 10);
        this.audioEngine.voices && this.audioEngine.voices.setRootNote(semitone);
      });
    }

    // Kit selector
    if (this.kitSelect) {
      this.kitSelect.addEventListener('change', (e) => {
        this.audioEngine.voices && this.audioEngine.voices.setKit(e.target.value);
      });
    }

    // Audio Transport
    this.btnPlay.addEventListener('click', () => {
      if (this.audioEngine.isRunning) {
        this.stateMachine.stop();
        this.btnPlay.textContent = '▶ Iniciar Audio';
        this.btnPlay.className = 'btn btn-play';
      } else {
        this.stateMachine.start(this.stateMachine.activePattern || TEMPLATES.template_01());
        this.btnPlay.textContent = '⏹ Detener Audio';
        this.btnPlay.className = 'btn btn-discard';
      }
    });

    // Capturar a Preview
    this.btnCapture.addEventListener('click', () => {
      this.captureToPreview();
    });

    // Modo Live: toggle — aplica el patrón detectado automáticamente en cada compás
    if (this.btnLiveMode) {
      this.btnLiveMode.addEventListener('click', () => {
        this.isLiveModeOn = !this.isLiveModeOn;
        this.btnLiveMode.classList.toggle('live-active', this.isLiveModeOn);
        this.btnLiveMode.textContent = this.isLiveModeOn ? '⦿ LIVE' : '⦿ LIVE';
        if (!this.isLiveModeOn) this.liveModePending = null;
      });
    }

    // Auto-umbral por método de Otsu
    this.btnAutoThreshold.addEventListener('click', () => {
      const t = this.computeOtsuThreshold();
      this.thresholdSlider.value = t;
      this.thresholdVal.textContent = t;
    });

    // Aceptar candidato
    this.btnAccept.addEventListener('click', () => {
      this.stateMachine.acceptCandidate();
    });

    // Descartar candidato
    this.btnDiscard.addEventListener('click', () => {
      this.stateMachine.discardCandidate();
    });

    // Cargar plantilla digital
    this.btnLoadTemplate.addEventListener('click', () => {
      const templateFn = TEMPLATES[this.templateSelect.value];
      if (templateFn) {
        const pattern = templateFn();
        this.stateMachine.setPreview(pattern);
      }
    });

    // Sliders de Visión
    this.brightnessSlider.addEventListener('input', (e) => {
      this.brightnessVal.textContent = `${e.target.value}%`;
    });

    this.contrastSlider.addEventListener('input', (e) => {
      this.contrastVal.textContent = `${e.target.value}%`;
    });

    this.thresholdSlider.addEventListener('input', (e) => {
      this.thresholdVal.textContent = e.target.value;
    });

    // Slider BPM
    this.bpmSlider.addEventListener('input', (e) => {
      const bpm = parseInt(e.target.value, 10);
      this.bpmVal.textContent = bpm;
      this.stateMachine.setBpm(bpm);
    });

    // Modal de Ayuda / Información
    if (this.btnHelp && this.helpModal) {
      this.btnHelp.addEventListener('click', () => {
        this.helpModal.style.display = 'flex';
      });

      if (this.btnCloseHelp) {
        this.btnCloseHelp.addEventListener('click', () => {
          this.helpModal.style.display = 'none';
        });
      }

      this.helpModal.addEventListener('click', (e) => {
        if (e.target === this.helpModal) {
          this.helpModal.style.display = 'none';
        }
      });
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        // Si el modal está abierto, no capturar
        if (this.helpModal && this.helpModal.style.display !== 'none') return;
        e.preventDefault();
        if (this.stateMachine.previewPattern) {
          this.stateMachine.acceptCandidate();
        } else {
          this.captureToPreview();
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (this.helpModal && this.helpModal.style.display !== 'none') {
          this.helpModal.style.display = 'none';
        } else {
          this.stateMachine.discardCandidate();
        }
      }
    });
  }

  resetPins() {
    this.cornerPins = [
      { x: 0.20, y: 0.25 }, // Top-Left
      { x: 0.80, y: 0.25 }, // Top-Right
      { x: 0.85, y: 0.80 }, // Bottom-Right
      { x: 0.15, y: 0.80 }  // Bottom-Left
    ];
    this.cornerDetectStatus.textContent = "Pines centrados";
    this.cornerDetectStatus.style.color = "#94a3b8";
    this.drawPins();
  }

  autoDetectCorners(interactive = false) {
    if (!this.cameraManager.stream || this.video.readyState < 2) {
      if (interactive) {
        this.cornerDetectStatus.textContent = "⚠ Activa la cámara primero";
        this.cornerDetectStatus.style.color = "#f59e0b";
      }
      return false;
    }

    const frameData = this.cameraManager.captureFrame(this.rawCanvas);
    if (!frameData) return false;

    const detected = CornerDetector.detectCorners(frameData, this.cornerPins);
    if (detected) {
      this.cornerPins = detected;
      this.drawPins();
      this.cornerDetectStatus.textContent = "✓ Esquinas auto-ajustadas";
      this.cornerDetectStatus.style.color = "#10b981";
      return true;
    } else {
      if (interactive) {
        this.cornerDetectStatus.textContent = "⚠ No se detectó el bloque (centra el papel)";
        this.cornerDetectStatus.style.color = "#f59e0b";
      }
      return false;
    }
  }

  captureToPreview() {
    if (this.liveDetectedPattern) {
      this.stateMachine.setPreview(this.liveDetectedPattern.clone());
    } else {
      const threshold = parseInt(this.thresholdSlider.value, 10);
      const result = this.gridDetector.detectPattern(threshold);
      this.stateMachine.setPreview(result.pattern);
    }
  }

  setupPinCanvasEvents() {
    const resizePins = () => {
      this.pinCanvas.width = this.pinCanvas.clientWidth;
      this.pinCanvas.height = this.pinCanvas.clientHeight;
      this.drawPins();
    };
    window.addEventListener('resize', resizePins);
    setTimeout(resizePins, 200);

    const getPosFromClient = (clientX, clientY) => {
      const rect = this.pinCanvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height
      };
    };

    const findClosestPin = (pos) => {
      let closest = -1, minDist = 0.10;
      this.cornerPins.forEach((p, i) => {
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (d < minDist) { minDist = d; closest = i; }
      });
      return closest;
    };

    const clamp = (v) => Math.max(0.02, Math.min(0.98, v));

    // Mouse
    this.pinCanvas.addEventListener('mousedown', (e) => {
      this.draggedPin = findClosestPin(getPosFromClient(e.clientX, e.clientY));
    });
    window.addEventListener('mousemove', (e) => {
      if (this.draggedPin === null) return;
      const pos = getPosFromClient(e.clientX, e.clientY);
      this.cornerPins[this.draggedPin].x = clamp(pos.x);
      this.cornerPins[this.draggedPin].y = clamp(pos.y);
      this.drawPins();
    });
    window.addEventListener('mouseup', () => { this.draggedPin = null; });

    // Touch (mobile / tablet)
    this.pinCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this.draggedPin = findClosestPin(getPosFromClient(t.clientX, t.clientY));
    }, { passive: false });
    this.pinCanvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.draggedPin === null) return;
      const t = e.touches[0];
      const pos = getPosFromClient(t.clientX, t.clientY);
      this.cornerPins[this.draggedPin].x = clamp(pos.x);
      this.cornerPins[this.draggedPin].y = clamp(pos.y);
      this.drawPins();
    }, { passive: false });
    this.pinCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.draggedPin = null;
    }, { passive: false });
  }

  computeOtsuThreshold() {
    const ctx = this.rectifiedCanvas.getContext('2d', { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, this.rectifiedCanvas.width, this.rectifiedCanvas.height);
    const hist = new Array(256).fill(0);
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      hist[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
    }
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = 0, threshold = 125;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) ** 2;
      if (v > maxVar) { maxVar = v; threshold = t; }
    }
    return threshold;
  }

  drawPins() {
    const w = this.pinCanvas.width;
    const h = this.pinCanvas.height;
    const ctx = this.pinCanvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const points = this.cornerPins.map(p => ({ x: p.x * w, y: p.y * h }));

    // Puntos medios de la línea central
    const midLeftX = (points[0].x + points[3].x) / 2;
    const midLeftY = (points[0].y + points[3].y) / 2;
    const midRightX = (points[1].x + points[2].x) / 2;
    const midRightY = (points[1].y + points[2].y) / 2;

    const isFlippedV = this.cameraManager ? this.cameraManager.isFlippedV : false;

    // 1. ZONA SUPERIOR (Tintado translúcido)
    ctx.fillStyle = isFlippedV ? 'rgba(236, 72, 153, 0.09)' : 'rgba(0, 240, 255, 0.09)';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(midRightX, midRightY);
    ctx.lineTo(midLeftX, midLeftY);
    ctx.closePath();
    ctx.fill();

    // 2. ZONA INFERIOR (Tintado translúcido)
    ctx.fillStyle = isFlippedV ? 'rgba(0, 240, 255, 0.09)' : 'rgba(236, 72, 153, 0.09)';
    ctx.beginPath();
    ctx.moveTo(midLeftX, midLeftY);
    ctx.lineTo(midRightX, midRightY);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.closePath();
    ctx.fill();

    // 3. Polígono de delimitación de la zona de dibujo
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Línea guía central (división melódica / rítmica de 3cm)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(midLeftX, midLeftY);
    ctx.lineTo(midRightX, midRightY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Etiquetas HUD de Orientación de Bandas (ARRIBA vs ABAJO)
    const topCenterX = (points[0].x + points[1].x + midRightX + midLeftX) / 4;
    const topCenterY = (points[0].y + points[1].y + midRightY + midLeftY) / 4;
    const btmCenterX = (midLeftX + midRightX + points[2].x + points[3].x) / 4;
    const btmCenterY = (midLeftY + midRightY + points[2].y + points[3].y) / 4;

    const topLabel = isFlippedV ? '▼ RITMO (Perc · Hat · Caja · Bombo)' : '▲ MELODÍA (C5 · A4 · G4 · C4)';
    const topColor = isFlippedV ? '#ec4899' : '#00f0ff';
    const btmLabel = isFlippedV ? '▲ MELODÍA (C5 · A4 · G4 · C4)' : '▼ RITMO (Perc · Hat · Caja · Bombo)';
    const btmColor = isFlippedV ? '#00f0ff' : '#ec4899';

    this.drawHUDTag(ctx, topLabel, topCenterX, topCenterY, topColor);
    this.drawHUDTag(ctx, btmLabel, btmCenterX, btmCenterY, btmColor);

    // 6. Flecha indicadora de dirección de tiempo (Paso 0 -> Paso 15)
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('PASO 0 ▶', points[0].x + 4, points[0].y - 6);
    ctx.textAlign = 'right';
    ctx.fillText('◀ PASO 15', points[1].x - 4, points[1].y - 6);

    // 7. Pines interactivos con badges legibles
    const colors = ['#10b981', '#38bdf8', '#f59e0b', '#ec4899'];
    const pinLabels = isFlippedV
      ? ['P0 · Kick', 'P15 · Kick', 'P15 · Lead', 'P0 · Lead']
      : ['P0 · Lead', 'P15 · Lead', 'P15 · Kick', 'P0 · Kick'];

    points.forEach((p, i) => {
      // Círculo exterior
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();

      // Borde blanco de alto contraste
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cruz central
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y);
      ctx.lineTo(p.x + 4, p.y);
      ctx.moveTo(p.x, p.y - 4);
      ctx.lineTo(p.x, p.y + 4);
      ctx.stroke();

      // Badge con nombre del pin
      ctx.font = 'bold 8px monospace';
      const text = pinLabels[i];
      const tw = ctx.measureText(text).width + 6;
      const tx = (i === 0 || i === 3) ? p.x + 12 : p.x - tw - 12;
      const ty = p.y - 4;

      ctx.fillStyle = 'rgba(10, 14, 23, 0.88)';
      ctx.fillRect(tx, ty - 6, tw, 13);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty - 6, tw, 13);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, tx + 3, ty);
    });
  }

  drawHUDTag(ctx, text, cx, cy, color) {
    ctx.save();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width + 12;
    const th = 16;

    ctx.fillStyle = 'rgba(10, 14, 23, 0.82)';
    ctx.fillRect(cx - tw / 2, cy - th / 2, tw, th);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - tw / 2, cy - th / 2, tw, th);

    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  videoProcessingLoop() {
    this.frameCount++;

    if (this.cameraManager.stream && this.video.readyState >= 2) {
      const frameData = this.cameraManager.captureFrame(this.rawCanvas);
      if (frameData) {
        // Auto-seguimiento si está activado (evaluado cada 6 frames)
        if (this.autoTrackCheck.checked && this.frameCount % 6 === 0) {
          const detected = CornerDetector.detectCorners(frameData, this.cornerPins);
          if (detected) {
            // Suavizado / interpolación exponencial (LERP) para evitar saltos bruscos
            for (let i = 0; i < 4; i++) {
              this.cornerPins[i].x += (detected[i].x - this.cornerPins[i].x) * 0.25;
              this.cornerPins[i].y += (detected[i].y - this.cornerPins[i].y) * 0.25;
            }
            this.drawPins();
            this.cornerDetectStatus.textContent = "✓ Auto-siguiendo bloque";
            this.cornerDetectStatus.style.color = "#10b981";
          }
        }

        // 1. Homografía: Rectificación perspectiva hacia warpCanvas
        const srcPoints = this.cornerPins.map(p => ({
          x: p.x * frameData.width,
          y: p.y * frameData.height
        }));
        HomographyTransformer.warpPerspective(frameData, this.warpCanvas, srcPoints);

        // 2. Aplicar Brillo y Contraste hacia rectifiedCanvas
        const rCtx = this.rectifiedCanvas.getContext('2d');
        const brightness = this.brightnessSlider.value;
        const contrast = this.contrastSlider.value;
        rCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        rCtx.drawImage(this.warpCanvas, 0, 0);
        rCtx.filter = 'none';

        // 3. Postprocesado en tiempo real hacia processedCanvas
        this.processBinaryAndDetection();
      }
    }

    requestAnimationFrame(() => this.videoProcessingLoop());
  }

  processBinaryAndDetection() {
    const w = 480;
    const h = 240;
    const rCtx = this.rectifiedCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = rCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const pCtx = this.processedCanvas.getContext('2d');
    const procImgData = pCtx.createImageData(w, h);
    const pData = procImgData.data;

    const threshold = parseInt(this.thresholdSlider.value, 10);

    // Binarización en tiempo real
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < threshold) {
        // Tinta detectada: Blanco brillante
        pData[i] = 255;
        pData[i + 1] = 255;
        pData[i + 2] = 255;
        pData[i + 3] = 255;
      } else {
        // Fondo papel: Azul oscuro profundo
        pData[i] = 12;
        pData[i + 1] = 16;
        pData[i + 2] = 26;
        pData[i + 3] = 255;
      }
    }
    pCtx.putImageData(procImgData, 0, 0);

    // Muestreo celular en tiempo real (16x8)
    const result = this.gridDetector.detectPattern(threshold);
    this.liveDetectedPattern = result.pattern;

    // Actualizar indicador de confianza en vivo
    const pct = Math.round(result.confidence * 100);
    if (this.isLiveModeOn) {
      this.confidenceMeter.textContent = `⦿ LIVE — ${pct}% (${result.activeCellCount} notas)`;
      this.confidenceMeter.style.color = '#ec4899';
      // Acumular candidato si la confianza es aceptable
      if (result.isAcceptable) {
        this.liveModePending = result.pattern.clone();
      }
    } else {
      this.confidenceMeter.textContent = `Confianza: ${pct}% (${result.activeCellCount} notas)`;
      this.confidenceMeter.style.color = result.isAcceptable ? '#10b981' : '#f59e0b';
    }

    // Dibujar superposición de celdas, guard zones y notas detectadas
    this.drawDetectionOverlay(pCtx, result.pattern, w, h);
  }

  drawDetectionOverlay(ctx, pattern, w, h) {
    const cols = 16;
    const rows = 8;
    const cellW = w / cols;
    const cellH = h / rows;

    ctx.save();

    // Línea divisoria central en Y = 4 filas (Separación Melodía / Ritmo)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cellH * 4);
    ctx.lineTo(w, cellH * 4);
    ctx.stroke();

    // Dibujar celdas
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;

        // Borde tenue de celda
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);

        // Zona de guarda interior del 60%
        const padX = cellW * 0.20;
        const padY = cellH * 0.20;
        const innerW = cellW * 0.60;
        const innerH = cellH * 0.60;

        ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x + padX, y + padY, innerW, innerH);
        ctx.setLineDash([]);

        // Si la celda está activa: resaltar y dibujar símbolo morfológico
        const cell = pattern.cells[r][c];
        if (cell && cell.active) {
          // Relleno translúcido
          ctx.fillStyle = (r < 4) ? 'rgba(0, 240, 255, 0.35)' : 'rgba(236, 72, 153, 0.35)';
          ctx.fillRect(x + padX, y + padY, innerW, innerH);

          // Borde sólido
          ctx.strokeStyle = (r < 4) ? '#00f0ff' : '#ec4899';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + padX, y + padY, innerW, innerH);

          // Símbolo del gesto
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          let symbol = '●';
          if (cell.type === 'sustain') symbol = '━';
          else if (cell.type === 'accent') symbol = '┃';
          else if (cell.type === 'rich') symbol = '■';

          ctx.fillText(symbol, x + cellW / 2, y + cellH / 2);
        }
      }
    }

    // Etiquetas de pistas (Tracks) en el margen izquierdo
    const rowLabels = ['C5', 'A4', 'G4', 'C4', 'OH', 'CH', 'SD', 'BD'];
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = (r < 4) ? 'rgba(0, 240, 255, 0.85)' : 'rgba(236, 72, 153, 0.85)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(rowLabels[r], 2, r * cellH + cellH / 2);
    }

    // Marcas de sección en el margen derecho
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.fillText('▲ MELODÍA', w - 4, 3);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.45)';
    ctx.fillText('▼ RITMO', w - 4, cellH * 4 + 3);

    ctx.restore();
  }

  async populateCameraDevices() {
    try {
      const devices = await this.cameraManager.getDevices();
      this.cameraSelect.innerHTML = '<option value="">Predeterminada</option>';
      devices.forEach((d, idx) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Cámara ${idx + 1}`;
        this.cameraSelect.appendChild(opt);
      });
    } catch (e) {
      console.warn('No se pudieron enumerar dispositivos:', e);
    }
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
