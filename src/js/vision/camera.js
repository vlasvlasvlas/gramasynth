/**
 * Gramasynth ROLLITO — Camera Manager
 * Gestión de MediaStream, listado de dispositivos y captura de fotogramas
 */

export class CameraManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.isMirrored = true;
    this.activeDeviceId = null;
  }

  async getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  }

  async start(deviceId = null) {
    this.stop();

    const constraints = {
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    }

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;
    await this.video.play();
    this.activeDeviceId = deviceId;
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    this.video.style.transform = this.isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
  }

  /**
   * Captura el frame actual en un canvas auxiliar
   */
  captureFrame(targetCanvas) {
    if (!this.stream || this.video.videoWidth === 0) return null;

    targetCanvas.width = this.video.videoWidth;
    targetCanvas.height = this.video.videoHeight;
    const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });

    if (this.isMirrored) {
      ctx.save();
      ctx.translate(targetCanvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.video, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(this.video, 0, 0);
    }

    return ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  }
}
