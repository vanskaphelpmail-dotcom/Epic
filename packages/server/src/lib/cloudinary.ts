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

/** Cloudinary SDK often rejects with a plain object, not Error — never String(err). */
export function cloudinaryErrorMessage(err: unknown): string {
  if (!err) return "Failed to upload image to Cloudinary";
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err instanceof Error && err.message && err.message !== "[object Object]") {
    return err.message;
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const nested = o.message ?? o.error ?? o.statusText;
    if (typeof nested === "string" && nested.trim() && nested !== "[object Object]") {
      return nested.trim();
    }
    if (nested && typeof nested === "object" && "message" in (nested as object)) {
      const m = (nested as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
    try {
      const json = JSON.stringify(o);
      if (json && json !== "{}" && json.length < 280) return json;
    } catch {
      /* ignore */
    }
  }
  return "Failed to upload image to Cloudinary";
}

function dataUrlToBuffer(source: string): Buffer | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(source);
  if (!match?.[2]) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

function assertLikelyImageBuffer(buffer: Buffer): void {
  if (buffer.length < 32) {
    throw new Error("Invalid image data from device. Try another photo (JPG/PNG).");
  }
  // JPEG SOI
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG signature
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  // WEBP: RIFF....WEBP
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length > 11 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (!isJpeg && !isPng && !isWebp) {
    throw new Error(
      "Cloudinary rejected this image format. On iPhone use Most Compatible / JPG; on Android pick Gallery JPG/PNG.",
    );
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
          reject(new Error(cloudinaryErrorMessage(err || new Error("Cloudinary returned empty result"))));
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
    assertLikelyImageBuffer(buffer);
    try {
      return await uploadBuffer(buffer, { folder, publicId: options?.publicId, tags });
    } catch (err) {
      const msg = cloudinaryErrorMessage(err);
      throw new Error(
        /Invalid|format|image|File format|unsupported/i.test(msg)
          ? "Cloudinary rejected this image format. Use JPG or PNG from the gallery."
          : msg || "Failed to upload image to Cloudinary",
      );
    }
  }

  try {
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
  } catch (err) {
    throw new Error(cloudinaryErrorMessage(err));
  }
}

export async function destroyCloudinaryImage(publicId: string): Promise<void> {
  if (!publicId) return;
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
