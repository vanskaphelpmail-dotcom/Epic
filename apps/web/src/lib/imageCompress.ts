/** Compress / resize an image File to a JPEG data URL under a target byte budget. */

export type CompressOptions = {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
};

export async function compressImageToDataUrl(
  file: File,
  options?: CompressOptions,
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1400;
  const quality = options?.quality ?? 0.78;
  const maxBytes = options?.maxBytes ?? 900_000;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let q = quality;
  let dataUrl = canvas.toDataURL('image/jpeg', q);
  // Rough base64 length check — shrink quality until under budget
  while (dataUrl.length > maxBytes * 1.37 && q > 0.45) {
    q -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }
  return dataUrl;
}
