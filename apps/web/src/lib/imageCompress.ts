/** Compress / resize an image File to a JPEG Blob/data URL under a target byte budget.
 *  Works across iOS Safari, Android Chrome, desktop — including HEIC → JPEG when the
 *  browser can decode the source (Safari). Falls back through multiple loaders.
 */

export type CompressOptions = {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
};

<<<<<<< HEAD
function looksLikeImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  // Some mobile cameras/gallery pickers return an empty MIME type
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
}

async function loadDrawable(
  file: File,
): Promise<{ draw: CanvasImageSource; width: number; height: number; release: () => void }> {
  // Preferred path
  try {
    const bitmap = await createImageBitmap(file);
    return {
      draw: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch {
    /* fall through — common on some mobile WebViews */
  }

  // Fallback: <img> + object URL (works better on mobile Safari for many JPEGs)
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new Error(
            'Could not read this photo on your phone. Convert to JPG/PNG and try again.',
          ),
        );
      el.src = objectUrl;
    });
    return {
      draw: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

export async function compressImageToDataUrl(
  file: File,
  options?: CompressOptions,
): Promise<string> {
  if (!looksLikeImageFile(file)) {
    throw new Error('Please upload an image file (JPG, PNG, WEBP).');
  }

  const maxEdge = options?.maxEdge ?? 1400;
  const quality = options?.quality ?? 0.78;
  const maxBytes = options?.maxBytes ?? 900_000;

  const source = await loadDrawable(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(source.width, source.height, 1));
    const w = Math.max(1, Math.round(source.width * scale));
    const h = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported on this browser');
    ctx.drawImage(source.draw, 0, 0, w, h);

    let q = quality;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    while (dataUrl.length > maxBytes * 1.37 && q > 0.45) {
      q -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', q);
    }
    return dataUrl;
  } finally {
    source.release();
  }
}

export { looksLikeImageFile };
=======
function approxBytesFromDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function isHeicLike(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.includes('heic') || t.includes('heif')) return true;
  return /\.(heic|heif)$/i.test(file.name || '');
}

function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
}

async function bitmapFromFile(file: File, maxEdge: number): Promise<ImageBitmap | null> {
  // HEIC on iOS often "succeeds" via createImageBitmap with a blank/corrupt bitmap.
  // Prefer HTMLImageElement for those (Safari Photos decode path).
  if (isHeicLike(file)) return null;
  if (typeof createImageBitmap !== 'function') return null;

  try {
    // Only constrain the long edge — setting BOTH width+height forces a square and
    // can break phone camera photos on Safari/Chrome Android.
    return await createImageBitmap(file, {
      resizeWidth: maxEdge,
      resizeQuality: 'high',
      imageOrientation: 'from-image',
    } as ImageBitmapOptions);
  } catch {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        return null;
      }
    }
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('Could not read this photo on this device. Try JPG or PNG.'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Could not read this photo on this device. Try JPG or PNG.'));
    img.src = src;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match?.[2]) throw new Error('Compression produced invalid image data.');
  const mime = match[1] || 'image/jpeg';
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // JPEG SOI marker check
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error('Compression produced a non-JPEG image. Try another photo from Gallery.');
  }
  return new Blob([bytes], { type: mime });
}

async function drawToJpegDataUrl(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxEdge: number,
  quality: number,
  maxBytes: number,
): Promise<string> {
  if (!srcW || !srcH) {
    throw new Error('Could not read photo dimensions on this device.');
  }

  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
  if (!ctx) throw new Error('Canvas unsupported on this browser');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);

  let q = quality;
  let dataUrl = canvas.toDataURL('image/jpeg', q);
  while (approxBytesFromDataUrl(dataUrl) > maxBytes && q > 0.4) {
    q -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }

  // Last resort: shrink canvas further if still too large (low-end mobile).
  let edge = maxEdge;
  while (approxBytesFromDataUrl(dataUrl) > maxBytes && edge > 480) {
    edge = Math.round(edge * 0.72);
    const s2 = Math.min(1, edge / Math.max(srcW, srcH));
    const w2 = Math.max(1, Math.round(srcW * s2));
    const h2 = Math.max(1, Math.round(srcH * s2));
    canvas.width = w2;
    canvas.height = h2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w2, h2);
    ctx.drawImage(source, 0, 0, w2, h2);
    q = Math.min(q, 0.68);
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }

  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Device could not encode JPEG. Try a JPG from the gallery.');
  }
  if (approxBytesFromDataUrl(dataUrl) < 256) {
    throw new Error('Photo came out empty after compression. Try another image (JPG/PNG).');
  }
  if (approxBytesFromDataUrl(dataUrl) > maxBytes * 1.2) {
    throw new Error('Photo is still too large after compression. Pick a smaller image and try again.');
  }
  return dataUrl;
}

async function compressViaObjectUrl(
  file: File,
  maxEdge: number,
  quality: number,
  maxBytes: number,
): Promise<string> {
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
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressViaFileReader(
  file: File,
  maxEdge: number,
  quality: number,
  maxBytes: number,
): Promise<string> {
  const dataUrlSrc = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
  if (!dataUrlSrc.startsWith('data:')) {
    throw new Error('Could not read this photo. Try JPG or PNG.');
  }
  const img = await loadHtmlImage(dataUrlSrc);
  return await drawToJpegDataUrl(
    img,
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    maxEdge,
    quality,
    maxBytes,
  );
}

/**
 * Compress any phone/desktop photo to a JPEG data URL safe for API → Cloudinary.
 */
export async function compressImageToDataUrl(
  file: File,
  options?: CompressOptions,
): Promise<string> {
  const mobile = isMobileUa();
  const maxEdge = options?.maxEdge ?? (mobile ? 1080 : 1280);
  const quality = options?.quality ?? (mobile ? 0.7 : 0.74);
  const maxBytes = options?.maxBytes ?? (mobile ? 520_000 : 720_000);

  // On mobile / HEIC: prefer HTMLImageElement first (most reliable on iOS Photos).
  if (mobile || isHeicLike(file)) {
    try {
      return await compressViaObjectUrl(file, maxEdge, quality, maxBytes);
    } catch {
      try {
        return await compressViaFileReader(file, maxEdge, quality, maxBytes);
      } catch {
        // fall through to bitmap path below
      }
    }
  }

  // Path 1: createImageBitmap (fast, memory-friendly with resize)
  const bitmap = await bitmapFromFile(file, maxEdge);
  if (bitmap) {
    try {
      if (bitmap.width > 0 && bitmap.height > 0) {
        return await drawToJpegDataUrl(bitmap, bitmap.width, bitmap.height, maxEdge, quality, maxBytes);
      }
    } finally {
      bitmap.close();
    }
  }

  // Path 2: object URL + HTMLImageElement
  try {
    return await compressViaObjectUrl(file, maxEdge, quality, maxBytes);
  } catch (objectUrlErr) {
    // Path 3: FileReader data URL (last resort)
    try {
      return await compressViaFileReader(file, maxEdge, quality, maxBytes);
    } catch {
      throw objectUrlErr instanceof Error
        ? objectUrlErr
        : new Error(
            'This device could not process the photo (HEIC/RAW may be unsupported). Export as JPG in Photos and retry.',
          );
    }
  }
}

/** Compress to a JPEG Blob — preferred for multipart FormData uploads on mobile. */
export async function compressImageToBlob(
  file: File,
  options?: CompressOptions,
): Promise<{ blob: Blob; fileName: string }> {
  const dataUrl = await compressImageToDataUrl(file, options);
  const blob = dataUrlToBlob(dataUrl);
  const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return { blob, fileName: `${base}.jpg` };
}
>>>>>>> dd2065fb31ae5ebe7f606bbae05c11d0d61f9470
