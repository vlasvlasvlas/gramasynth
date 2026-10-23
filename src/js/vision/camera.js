/**
 * Gramasynth ROLLITO — Camera Manager
 * Gestión de MediaStream, listado de dispositivos, captura de fotogramas e inversión H/V
 */

export class CameraManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.isMirrored = true;  // Inversión Horizontal (Espejo)
    this.isFlippedV = false;  // Inversión Vertical
    this.activeDeviceId = null;
    this.updateTransform();
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
    this.updateTransform();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    this.updateTransform();
  }

  toggleFlipV() {
    this.isFlippedV = !this.isFlippedV;
    this.updateTransform();
  }

  updateTransform() {
    const sx = this.isMirrored ? -1 : 1;
    const sy = this.isFlippedV ? -1 : 1;
    this.video.style.transform = `scale(${sx}, ${sy})`;
  }

  /**
   * Captura el frame actual en un canvas auxiliar respetando las inversiones H y V
   */
  captureFrame(targetCanvas) {
    if (!this.stream || this.video.videoWidth === 0) return null;

    targetCanvas.width = this.video.videoWidth;
    targetCanvas.height = this.video.videoHeight;
    const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });

    const sx = this.isMirrored ? -1 : 1;
    const sy = this.isFlippedV ? -1 : 1;
    const tx = this.isMirrored ? targetCanvas.width : 0;
    const ty = this.isFlippedV ? targetCanvas.height : 0;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(sx, sy);
    ctx.drawImage(this.video, 0, 0);
    ctx.restore();

    return ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  }
}
