/** Compress / resize any phone/desktop photo to a Cloudinary-safe JPEG Blob/data URL.
 *  Accepts JPG, PNG, WEBP, GIF, BMP, HEIC/HEIF (when the browser can decode), AVIF, etc.
 */

export type CompressOptions = {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
};

/** Gallery files under this size can upload as-is (JPG/PNG/WEBP/GIF) without canvas re-encode. */
const PASSTHROUGH_MAX_BYTES = 3_500_000;

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

function isJpegBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPngBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isWebpBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length > 11 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function isGifBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const h = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
  return h === 'GIF87a' || h === 'GIF89a';
}

function isBmpBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

/**
 * Phones often append trailing bytes after JPEG EOI — do not require EOI at exact EOF.
 */
function hasJpegEoi(bytes: Uint8Array): boolean {
  if (!isJpegBytes(bytes)) return false;
  const start = Math.max(0, bytes.length - 4096);
  for (let i = bytes.length - 2; i >= start; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return true;
  }
  // Still accept SOI-only for large camera JPEGs (EOI search miss on odd trailers)
  return bytes.length > 1024;
}

function baseName(fileName: string): string {
  return (fileName || 'photo').replace(/\.[^.]+$/, '') || 'photo';
}

/**
 * Pass through real gallery images Cloudinary already accepts (no canvas — avoids mobile corruption).
 */
async function tryPassthroughImage(
  file: File,
  maxBytes: number = PASSTHROUGH_MAX_BYTES,
): Promise<{ blob: Blob; fileName: string } | null> {
  if (isHeicLike(file)) return null; // always convert HEIC → JPEG when browser can
  if (!file.size || file.size > maxBytes) return null;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }

  if (isJpegBytes(bytes) && hasJpegEoi(bytes)) {
    return {
      blob: new Blob([bytes], { type: 'image/jpeg' }),
      fileName: `${baseName(file.name)}.jpg`,
    };
  }
  if (isPngBytes(bytes)) {
    return {
      blob: new Blob([bytes], { type: 'image/png' }),
      fileName: `${baseName(file.name)}.png`,
    };
  }
  if (isWebpBytes(bytes)) {
    return {
      blob: new Blob([bytes], { type: 'image/webp' }),
      fileName: `${baseName(file.name)}.webp`,
    };
  }
  if (isGifBytes(bytes)) {
    return {
      blob: new Blob([bytes], { type: 'image/gif' }),
      fileName: `${baseName(file.name)}.gif`,
    };
  }
  if (isBmpBytes(bytes) && file.size <= 1_500_000) {
    return {
      blob: new Blob([bytes], { type: 'image/bmp' }),
      fileName: `${baseName(file.name)}.bmp`,
    };
  }
  return null;
}

async function bitmapFromFile(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  // Allow HEIC through bitmap when Safari can decode it
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

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('Could not read this photo on this device.'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Could not read this photo on this device.'));
    img.src = src;
  });
}

function dataUrlToJpegBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match?.[2]) throw new Error('Compression produced invalid image data.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (!isJpegBytes(bytes)) {
    throw new Error('Compression produced a non-JPEG image. Try another photo from Gallery.');
  }
  return new Blob([bytes], { type: 'image/jpeg' });
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
  let w = Math.max(1, Math.round(srcW * scale));
  let h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
  if (!ctx) throw new Error('Canvas unsupported on this browser');

  const encode = (width: number, height: number, q: number) => {
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', q);
  };

  let q = quality;
  let dataUrl = encode(w, h, q);

  if (!dataUrl.startsWith('data:image/jpeg')) {
    dataUrl = encode(Math.min(w, 960), Math.max(1, Math.round((Math.min(w, 960) * h) / w)), 0.65);
  }
  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Device could not encode this image. Try another photo from Gallery.');
  }

  while (approxBytesFromDataUrl(dataUrl) > maxBytes && q > 0.4) {
    q -= 0.08;
    dataUrl = encode(w, h, q);
  }

  let edge = maxEdge;
  while (approxBytesFromDataUrl(dataUrl) > maxBytes && edge > 480) {
    edge = Math.round(edge * 0.72);
    const s2 = Math.min(1, edge / Math.max(srcW, srcH));
    w = Math.max(1, Math.round(srcW * s2));
    h = Math.max(1, Math.round(srcH * s2));
    q = Math.min(q, 0.68);
    dataUrl = encode(w, h, q);
  }

  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Device could not encode this image. Try another photo from Gallery.');
  }
  if (approxBytesFromDataUrl(dataUrl) < 256) {
    throw new Error('Photo came out empty after compression. Try another image.');
  }
  if (approxBytesFromDataUrl(dataUrl) > maxBytes * 1.25) {
    throw new Error('Photo is still too large after compression. Pick a smaller image and try again.');
  }

  const probe = dataUrlToJpegBlob(dataUrl);
  if (!probe.size) {
    throw new Error('Compression produced an empty JPEG. Try another photo.');
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
    throw new Error('Could not read this photo.');
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
  const maxEdge = options?.maxEdge ?? (mobile ? 1280 : 1600);
  const quality = options?.quality ?? (mobile ? 0.72 : 0.78);
  const maxBytes = options?.maxBytes ?? (mobile ? 900_000 : 1_200_000);

  if (mobile || isHeicLike(file)) {
    try {
      return await compressViaObjectUrl(file, maxEdge, quality, maxBytes);
    } catch {
      try {
        return await compressViaFileReader(file, maxEdge, quality, maxBytes);
      } catch {
        // fall through
      }
    }
  }

  const bitmap = await bitmapFromFile(file);
  if (bitmap) {
    try {
      if (bitmap.width > 0 && bitmap.height > 0) {
        return await drawToJpegDataUrl(bitmap, bitmap.width, bitmap.height, maxEdge, quality, maxBytes);
      }
    } finally {
      bitmap.close();
    }
  }

  try {
    return await compressViaObjectUrl(file, maxEdge, quality, maxBytes);
  } catch (objectUrlErr) {
    try {
      return await compressViaFileReader(file, maxEdge, quality, maxBytes);
    } catch {
      throw objectUrlErr instanceof Error
        ? objectUrlErr
        : new Error('This device could not process the photo. Try another image from Gallery.');
    }
  }
}

/** Any gallery image → Cloudinary-safe Blob (passthrough or JPEG). */
export async function compressImageToBlob(
  file: File,
  options?: CompressOptions,
): Promise<{ blob: Blob; fileName: string }> {
  const passthrough = await tryPassthroughImage(file, PASSTHROUGH_MAX_BYTES);
  if (passthrough) return passthrough;

  const dataUrl = await compressImageToDataUrl(file, options);
  const blob = dataUrlToJpegBlob(dataUrl);
  return { blob, fileName: `${baseName(file.name)}.jpg` };
}
