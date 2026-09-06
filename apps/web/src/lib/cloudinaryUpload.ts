import { compressImageToDataUrl, type CompressOptions } from './imageCompress';
import { api, getToken, isApiEnabled } from './apiClient';

export type UploadFolder = 'products' | 'banners' | 'media' | 'avatars' | 'categories' | 'patches';

const DEFAULT_COMPRESS: CompressOptions = {
  maxEdge: 1400,
  quality: 0.78,
  maxBytes: 850_000,
};

/**
 * Compress a local image file, upload to Cloudinary via the API, and return the HTTPS URL.
 * Requires a staff session. Falls back to a compressed data URL only when API is disabled.
 */
export async function uploadStoreImage(
  file: File,
  folder: UploadFolder = 'products',
  compress: CompressOptions = DEFAULT_COMPRESS,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (JPG, PNG, WEBP).');
  }

  const dataUrl = await compressImageToDataUrl(file, compress);

  if (!isApiEnabled()) {
    return dataUrl;
  }

  if (!getToken()) {
    throw new Error('Staff sign-in required to upload images to Cloudinary.');
  }

  const result = await api.uploadImage({ dataUrl, folder, fileName: file.name });
  return result.url;
}
