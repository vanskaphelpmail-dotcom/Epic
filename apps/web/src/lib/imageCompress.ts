/** Compress / resize an image File to a JPEG data URL under a target byte budget. */

export type CompressOptions = {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
};

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
