import { v2 as cloudinary } from "cloudinary";

let configured = false;

export function isCloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL?.trim()) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function ensureConfigured() {
  if (configured) return;
  if (process.env.CLOUDINARY_URL?.trim()) {
    // CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME — SDK reads it automatically
    cloudinary.config({ secure: true });
  } else if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  } else {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in .env",
    );
  }
  configured = true;
}

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

/**
 * Upload an image (https URL, data URI, or raw base64) to Cloudinary.
 * folder examples: jersey-addicts/products | jersey-addicts/banners | jersey-addicts/media
 */
export async function uploadImageToCloudinary(
  source: string,
  options?: { folder?: string; publicId?: string; tags?: string[] },
): Promise<CloudinaryUploadResult> {
  ensureConfigured();

  const folder = options?.folder || "jersey-addicts/products";
  const result = await cloudinary.uploader.upload(source, {
    folder,
    public_id: options?.publicId,
    tags: options?.tags || ["jersey-addicts"],
    resource_type: "image",
    overwrite: false,
    unique_filename: true,
  });

  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

export async function destroyCloudinaryImage(publicId: string): Promise<void> {
  if (!publicId) return;
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
