# Gramasynth — ROLLITO

> Interfaz musical físico-digital y ecosistema electroacústico.  
> Parte del proyecto **POSNETES**.

## 📜 Descripción

**ROLLITO** es una interfaz musical tangible donde el papel funciona como partitura manipulable. Una superficie de papel contiene patrones rítmicos y melódicos preimpresos o dibujados a mano alzada. Mediante visión por computadora, una cámara web interpreta los trazos sobre una grilla discreta de 16 pasos por 8 notas y los envía a un motor de audio Web Audio API que reproduce secuencias en bucle continuo.

El sistema permite capturar y previsualizar nuevos patrones candidatos sin interrumpir la música activa, realizando transiciones fluidas y cuantizadas en los límites del compás musical.

## 📖 Documentación

Para consultar la teoría, especificación técnica, auditoría del primer prototipo y visión arquitectónica, consulta:
- [Documentación Integral de Concepto, Teoría y Diseño](gramasynth_ROLLITO_documentacion_integral.md)

## 🏛️ Estado del Proyecto

- **Fase actual:** Prototipo exploratorio v0.1 / Especificación de arquitectura v0.2.
- **Núcleo tecnológico:** Web Audio API, Canvas 2D / WebGL, Computer Vision (Homografía & Binarización Adaptativa), TypeScript / ES Modules.
