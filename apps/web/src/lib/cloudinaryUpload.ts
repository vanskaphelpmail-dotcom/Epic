import { compressImageToBlob, compressImageToDataUrl, type CompressOptions } from './imageCompress';
import { api, getToken, isApiEnabled, setToken } from './apiClient';

export type UploadFolder = 'products' | 'banners' | 'media' | 'avatars' | 'categories' | 'patches';

/**
 * Broad accept so iOS/Android Photo Library shows every photo (JPG/PNG/HEIC/WEBP/GIF…).
 * Do NOT set `capture` — that forces camera-only on many phones.
 */
export const IMAGE_FILE_ACCEPT = 'image/*';

/** Mobile-safe defaults — keep payload under typical Vercel / phone memory limits. */
export const MOBILE_UPLOAD_COMPRESS: CompressOptions = {
  maxEdge: 1280,
  quality: 0.72,
  maxBytes: 900_000,
};

const DEFAULT_COMPRESS: CompressOptions = MOBILE_UPLOAD_COMPRESS;

function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
}

/**
 * Accept any image the phone can pick. Only reject obvious non-images (video/audio/pdf…).
 * Empty MIME / octet-stream is common on iOS & Android galleries — allow those.
 */
export function isLikelyImageFile(file: File): boolean {
  if (!file) return false;
  const t = (file.type || '').toLowerCase().trim();

  if (t.startsWith('video/') || t.startsWith('audio/') || t.startsWith('text/')) return false;
  if (
    t === 'application/pdf' ||
    t === 'application/zip' ||
    t === 'application/x-zip-compressed' ||
    t.includes('msword') ||
    t.includes('officedocument')
  ) {
    return false;
  }

  // image/*, image/jpg (Android), image/pjpeg, heic, etc.
  if (t.startsWith('image/')) return true;
  if (t === 'image/jpg' || t === 'image/pjpeg') return true;

  // Empty / generic — gallery often omits type; allow and let decode/Cloudinary decide
  if (!t || t === 'application/octet-stream' || t === 'binary/octet-stream') {
    if (!file.name || !file.name.includes('.')) return true;
    // Block only clear non-image extensions
    if (/\.(mp4|mov|avi|mkv|webm|mp3|wav|pdf|doc|docx|xls|xlsx|zip|rar|txt|csv)$/i.test(file.name)) {
      return false;
    }
    return true;
  }

  // Unknown MIME with image-like extension
  return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?|jfif|svg)$/i.test(file.name || '');
}

export function formatUploadError(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== '[object Object]') {
    return err.message;
  }
  if (typeof err === 'string' && err.trim() && err.trim() !== '[object Object]') {
    return err.trim();
  }
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message && o.message !== '[object Object]') {
      return o.message;
    }
  }
  return 'Upload failed. On iPhone use Most Compatible / JPG. On Android pick Gallery JPG.';
}

function friendlyUploadError(err: unknown): Error {
  const msg = formatUploadError(err);
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return new Error('Upload failed — check mobile data/Wi‑Fi and try again.');
  }
  if (/413|too large|Entity Too Large|Request Entity/i.test(msg)) {
    return new Error('Image too large for the server. Try a smaller photo.');
  }
  if (/timeout|504|ETIMEDOUT/i.test(msg)) {
    return new Error('Upload timed out. Use a smaller photo or stronger connection.');
  }
  if (/401|Unauthorized|Invalid or expired token/i.test(msg)) {
    return new Error('Session expired. Sign out of admin, sign in again, then retry upload.');
  }
  if (/403|permission|Staff/i.test(msg)) {
    return new Error('Staff permission required to upload. Sign in with an admin account.');
  }
  if (/Cloudinary is not configured/i.test(msg)) {
    return new Error('Cloudinary is not configured on the server. Add CLOUDINARY_* env on Vercel.');
  }
  if (/rejected this image format|Invalid image|File format|unsupported/i.test(msg)) {
    return new Error(
      'Could not upload this photo. Try again from Gallery — JPG, PNG, WEBP, HEIC, and GIF are supported.',
    );
  }
  if (/HEIC|could not process|Could not read|non-JPEG|empty after compression/i.test(msg)) {
    return new Error(msg);
  }
  if (/\[object Object\]/i.test(msg)) {
    return new Error(
      'Upload failed. On iPhone: Photos → export as JPG / Most Compatible. On Android: Gallery JPG. Then retry.',
    );
  }
  if (msg && msg !== 'Failed to upload image to Cloudinary') {
    return new Error(msg);
  }
  return new Error(
    'Upload failed. On iPhone: use “Most Compatible” / JPG. On Android: try Gallery JPG. Then retry.',
  );
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result.startsWith('data:image/')) {
        reject(new Error('Compressed photo was not a valid image. Try JPG or PNG.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Could not read compressed image on this device.'));
    reader.readAsDataURL(b);
  });
}

/**
 * Compress a local image file, upload to Cloudinary via the API, and return the HTTPS URL.
 * Requires a staff session. Falls back to a compressed data URL only when API is disabled.
 *
 * On mobile: JSON data-URL first (most reliable through Next/Vercel).
 * Desktop: multipart first, then JSON fallback.
 */
export async function uploadStoreImage(
  file: File,
  folder: UploadFolder = 'products',
  compress: CompressOptions = DEFAULT_COMPRESS,
): Promise<string> {
  if (!isLikelyImageFile(file)) {
    throw new Error('Please choose an image from Gallery (any photo format).');
  }
  if (!file.size) {
    throw new Error('Selected file is empty. Pick the photo again from Gallery.');
  }

  if (!isApiEnabled()) {
    return compressImageToDataUrl(file, compress);
  }

  if (!getToken()) {
    throw new Error('Staff sign-in required to upload images. Sign out and sign in again.');
  }

  let blob: Blob;
  let fileName: string;
  try {
    ({ blob, fileName } = await compressImageToBlob(file, compress));
  } catch (err) {
    throw friendlyUploadError(err);
  }

  if (!blob.size) {
    throw new Error('Compression produced an empty image. Try another photo (JPG/PNG).');
  }

  // Normalize MIME — Android sometimes uses image/jpg which Cloudinary dislikes in headers.
  if (blob.type === 'image/jpg' || blob.type === 'image/pjpeg' || !blob.type) {
    blob = new Blob([blob], { type: 'image/jpeg' });
  }

  const tryMultipart = async () => {
    const result = await api.uploadImageFile({
      file: blob,
      fileName,
      folder,
    });
    return result.url;
  };

  const tryJson = async () => {
    const dataUrl = await blobToDataUrl(blob);
    const result = await api.uploadImage({
      dataUrl,
      folder,
      fileName,
    });
    return result.url;
  };

  const runWithSessionRetry = async (fn: () => Promise<string>) => {
    try {
      return await fn();
    } catch (err) {
      const msg = formatUploadError(err);
      if (/403|404|outdated|inactive|not found|Missing permission|Unauthorized|User not found/i.test(msg)) {
        try {
          const rebound = await api.rebindSession();
          if (rebound?.token) setToken(rebound.token);
          return await fn();
        } catch {
          throw new Error(
            'Upload blocked — session outdated. Sign out of admin, sign in again, then retry.',
          );
        }
      }
      throw err;
    }
  };

  const mobile = isMobileUa();

  if (mobile) {
    // Mobile: JSON first — avoids multipart/form-data quirks on iOS Safari / Android WebViews.
    try {
      return await runWithSessionRetry(tryJson);
    } catch (jsonErr) {
      try {
        return await runWithSessionRetry(tryMultipart);
      } catch {
        throw friendlyUploadError(jsonErr);
      }
    }
  }

  try {
    return await runWithSessionRetry(tryMultipart);
  } catch (multipartErr) {
    try {
      return await runWithSessionRetry(tryJson);
    } catch (jsonErr) {
      throw friendlyUploadError(jsonErr ?? multipartErr);
    }
  }
}
