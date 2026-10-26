"use client";
import { BarcodeDetector } from "barcode-detector/ponyfill";

let detector: BarcodeDetector | null = null;

/** Escala a imagem para que o maior lado tenha `max` pixels. */
async function scaled(bitmap: ImageBitmap, max: number, crop = 1): Promise<HTMLCanvasElement> {
  const sw = bitmap.width * crop;
  const sh = bitmap.height * crop;
  const sx = (bitmap.width - sw) / 2;
  const sy = (bitmap.height - sh) / 2;
  const ratio = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * ratio);
  canvas.height = Math.round(sh * ratio);
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Lê o QR code de uma foto. Tenta em vários tamanhos e recortes, porque fotos
 * de celular são grandes e o QR da NFC-e é denso.
 */
export async function readQrFromImage(file: Blob): Promise<string | null> {
  detector ??= new BarcodeDetector({ formats: ["qr_code"] });
  const bitmap = await createImageBitmap(file);
  try {
    const attempts: [number, number][] = [
      [1600, 1], [2400, 1], [1000, 1], [1600, 0.6], [1200, 0.4],
    ];
    for (const [max, crop] of attempts) {
      const codes = await detector.detect(await scaled(bitmap, max, crop));
      if (codes[0]?.rawValue) return codes[0].rawValue;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
