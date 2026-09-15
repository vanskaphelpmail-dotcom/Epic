import { compressImageToDataUrl, type CompressOptions } from './imageCompress';
import { api, getToken, isApiEnabled, setToken } from './apiClient';

export type UploadFolder = 'products' | 'banners' | 'media' | 'avatars' | 'categories' | 'patches';

/** Mobile-safe defaults — keep payload under typical Vercel / phone memory limits. */
const DEFAULT_COMPRESS: CompressOptions = {
  maxEdge: 1280,
  quality: 0.74,
  maxBytes: 720_000,
};

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

function friendlyUploadError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err || '');
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
  if (/HEIC|could not process|Could not read/i.test(msg)) {
    return new Error(msg);
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
 */
export async function uploadStoreImage(
  file: File,
  folder: UploadFolder = 'products',
  compress: CompressOptions = DEFAULT_COMPRESS,
): Promise<string> {
  if (!isLikelyImageFile(file)) {
    throw new Error('Please upload an image file (JPG, PNG, or WEBP).');
  }

  let dataUrl: string;
  try {
    dataUrl = await compressImageToDataUrl(file, compress);
  } catch (err) {
    throw friendlyUploadError(err);
  }

  if (!isApiEnabled()) {
    return dataUrl;
  }

  if (!getToken()) {
    throw new Error('Staff sign-in required to upload images. Sign out and sign in again.');
  }

  const tryUpload = async () => {
    const result = await api.uploadImage({
      dataUrl,
      folder,
      fileName: (file.name || 'photo.jpg').replace(/\.[^.]+$/, '.jpg'),
    });
    return result.url;
  };

  try {
    return await tryUpload();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/403|404|outdated|inactive|not found|Missing permission|Unauthorized|User not found/i.test(msg)) {
      try {
        const rebound = await api.rebindSession();
        if (rebound?.token) setToken(rebound.token);
        return await tryUpload();
      } catch {
        throw new Error(
          'Upload blocked — session outdated. Sign out of admin, sign in again, then retry.',
        );
      }
    }
    throw friendlyUploadError(err);
  }
}
