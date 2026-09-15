/** Compress / resize an image File to a JPEG data URL under a target byte budget.
 *  Works across iOS Safari, Android Chrome, desktop — including HEIC → JPEG when the
 *  browser can decode the source (Safari). Falls back through multiple loaders.
 */

export type CompressOptions = {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
};

function approxBytesFromDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

async function bitmapFromFile(file: File, maxEdge: number): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    // Prefer resize at decode time — critical for phone camera photos (memory).
    return await createImageBitmap(file, {
      resizeWidth: maxEdge,
      resizeHeight: maxEdge,
      resizeQuality: 'high',
      imageOrientation: 'from-image',
    } as ImageBitmapOptions);
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this photo on this device. Try JPG or PNG.'));
    img.src = src;
  });
}

async function drawToJpegDataUrl(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxEdge: number,
  quality: number,
  maxBytes: number,
): Promise<string> {
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas unsupported on this browser');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);

  let q = quality;
  let dataUrl = canvas.toDataURL('image/jpeg', q);
  while (approxBytesFromDataUrl(dataUrl) > maxBytes && q > 0.42) {
    q -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }

  // Last resort: shrink canvas further if still too large (low-end mobile).
  let edge = maxEdge;
  while (approxBytesFromDataUrl(dataUrl) > maxBytes && edge > 640) {
    edge = Math.round(edge * 0.75);
    const s2 = Math.min(1, edge / Math.max(srcW, srcH));
    const w2 = Math.max(1, Math.round(srcW * s2));
    const h2 = Math.max(1, Math.round(srcH * s2));
    canvas.width = w2;
    canvas.height = h2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w2, h2);
    ctx.drawImage(source, 0, 0, w2, h2);
    q = Math.min(q, 0.72);
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }

  if (approxBytesFromDataUrl(dataUrl) > maxBytes * 1.15) {
    throw new Error('Photo is still too large after compression. Pick a smaller image and try again.');
  }
  return dataUrl;
}

/**
 * Compress any phone/desktop photo to a JPEG data URL safe for API → Cloudinary.
 */
export async function compressImageToDataUrl(
  file: File,
  options?: CompressOptions,
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1280;
  const quality = options?.quality ?? 0.74;
  const maxBytes = options?.maxBytes ?? 750_000;

  // Path 1: createImageBitmap (fast, memory-friendly with resize)
  const bitmap = await bitmapFromFile(file, maxEdge);
  if (bitmap) {
    try {
      return await drawToJpegDataUrl(bitmap, bitmap.width, bitmap.height, maxEdge, quality, maxBytes);
    } finally {
      bitmap.close();
    }
  }

  // Path 2: object URL + HTMLImageElement (iOS HEIC / awkward MIME types)
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(objectUrl);
    return await drawToJpegDataUrl(
      img,
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxEdge,
      quality,
      maxBytes,
    );
  } catch (objectUrlErr) {
    // Path 3: FileReader data URL (last resort)
    const dataUrlSrc = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
    if (!dataUrlSrc.startsWith('data:')) {
      throw objectUrlErr instanceof Error
        ? objectUrlErr
        : new Error('Could not read this photo. Try JPG or PNG.');
    }
    try {
      const img = await loadHtmlImage(dataUrlSrc);
      return await drawToJpegDataUrl(
        img,
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        maxEdge,
        quality,
        maxBytes,
      );
    } catch {
      throw new Error(
        'This device could not process the photo (HEIC/RAW may be unsupported). Export as JPG in Photos and retry.',
      );
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
