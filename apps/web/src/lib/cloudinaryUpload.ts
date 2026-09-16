import { compressImageToBlob, compressImageToDataUrl, type CompressOptions } from './imageCompress';
import { api, getToken, isApiEnabled, setToken } from './apiClient';

export type UploadFolder = 'products' | 'banners' | 'media' | 'avatars' | 'categories' | 'patches';

/**
 * Use on every admin `<input type="file">` so iOS/Android show Photo Library + Camera
 * and accept HEIC (converted client-side to JPEG before Cloudinary).
 * Do NOT set `capture` — that forces camera-only on many phones.
 */
export const IMAGE_FILE_ACCEPT =
  'image/*,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.heic,.heif';

/** Mobile-safe defaults — keep payload under typical Vercel / phone memory limits. */
export const MOBILE_UPLOAD_COMPRESS: CompressOptions = {
  maxEdge: 1080,
  quality: 0.7,
  maxBytes: 520_000,
};

const DEFAULT_COMPRESS: CompressOptions = MOBILE_UPLOAD_COMPRESS;

/** Mobile cameras / gallery often omit MIME type — still allow common image extensions. */
export function isLikelyImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  // Empty / octet-stream is common on iOS & Android gallery picks
  if (!file.type || file.type === 'application/octet-stream') {
    if (!file.name || !file.name.includes('.')) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i.test(file.name);
  }
  return false;
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
  if (/HEIC|could not process|Could not read|non-JPEG|empty after compression/i.test(msg)) {
    return new Error(msg);
  }
  if (/\[object Object\]/i.test(msg)) {
    return new Error(
      'Upload failed. On iPhone: Photos → export as JPG / Most Compatible. On Android: Gallery JPG. Then retry.',
    );
  }
  // Avoid opaque default — keep server detail when useful
  if (msg && msg !== 'Failed to upload image to Cloudinary') {
    return new Error(msg);
  }
  return new Error(
    'Upload failed. On iPhone: use “Most Compatible” / JPG. On Android: try Gallery JPG. Then retry.',
  );
}

/**
 * Compress a local image file, upload to Cloudinary via the API, and return the HTTPS URL.
 * Requires a staff session. Falls back to a compressed data URL only when API is disabled.
 *
 * Uses multipart FormData (JPEG Blob) first — far more reliable on iOS/Android than
 * multi‑hundred‑KB JSON base64 payloads.
 */
export async function uploadStoreImage(
  file: File,
  folder: UploadFolder = 'products',
  compress: CompressOptions = DEFAULT_COMPRESS,
): Promise<string> {
  if (!isLikelyImageFile(file)) {
    throw new Error('Please upload an image file (JPG, PNG, or WEBP).');
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

  const blobToDataUrl = (b: Blob) =>
    new Promise<string>((resolve, reject) => {
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

  const tryMultipart = async () => {
    const result = await api.uploadImageFile({
      file: blob,
      fileName,
      folder,
    });
    return result.url;
  };

  const tryJsonFallback = async () => {
    // Reuse the already-compressed JPEG — do not re-decode the original phone file.
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

  try {
    return await runWithSessionRetry(tryMultipart);
  } catch (multipartErr) {
    // Always try JSON data-URL path — multipart can fail on some phones/proxies
    // even when the compressed JPEG is fine.
    try {
      return await runWithSessionRetry(tryJsonFallback);
    } catch (jsonErr) {
      throw friendlyUploadError(jsonErr ?? multipartErr);
    }
  }
}
