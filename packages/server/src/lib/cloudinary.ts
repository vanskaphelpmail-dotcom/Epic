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

function dataUrlToBuffer(source: string): Buffer | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(source);
  if (!match?.[2]) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

function uploadBuffer(
  buffer: Buffer,
  options: { folder: string; publicId?: string; tags?: string[] },
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        tags: options.tags || ["jersey-addicts"],
        resource_type: "image",
        overwrite: false,
        unique_filename: true,
        timeout: 60_000,
      },
      (err, result) => {
        if (err || !result) {
          reject(err || new Error("Cloudinary returned empty result"));
          return;
        }
        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
}

/**
 * Upload an image (https URL, data URI, or raw base64) to Cloudinary.
 * folder examples: jersey-addicts/products | jersey-addicts/banners | jersey-addicts/media
 *
 * Prefers buffer/stream upload for data URIs — more reliable on mobile/Vercel than
 * posting multi‑MB data URI strings through the Cloudinary HTTP API.
 */
export async function uploadImageToCloudinary(
  source: string,
  options?: { folder?: string; publicId?: string; tags?: string[] },
): Promise<CloudinaryUploadResult> {
  ensureConfigured();

  const folder = options?.folder || "jersey-addicts/products";
  const tags = options?.tags || ["jersey-addicts"];

  if (source.startsWith("data:")) {
    const buffer = dataUrlToBuffer(source);
    if (!buffer || buffer.length < 32) {
      throw new Error("Invalid image data from device. Try another photo (JPG/PNG).");
    }
    if (buffer.length > 8_000_000) {
      throw new Error("Image too large after receive. Compress on device and retry.");
    }
    try {
      return await uploadBuffer(buffer, { folder, publicId: options?.publicId, tags });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        /Invalid|format|image/i.test(msg)
          ? "Cloudinary rejected this image format. Use JPG or PNG from the gallery."
          : msg || "Failed to upload image to Cloudinary",
      );
    }
  }

  const result = await cloudinary.uploader.upload(source, {
    folder,
    public_id: options?.publicId,
    tags,
    resource_type: "image",
    overwrite: false,
    unique_filename: true,
    timeout: 60_000,
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
