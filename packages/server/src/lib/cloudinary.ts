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
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url) {
    // Must pass the URL string — `{ secure: true }` alone does not load credentials
    // and can leave uploads failing with "Invalid Signature" / opaque errors.
    cloudinary.config(url);
    cloudinary.config({ secure: true });
  } else if (
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
      secure: true,
    });
  } else {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in .env",
    );
  }
  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
    throw new Error(
      "Cloudinary credentials incomplete. Check CLOUDINARY_URL (cloudinary://API_KEY:API_SECRET@CLOUD_NAME).",
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
  // Accept data URLs even when phones put charset or odd mime params before base64.
  const match = /^data:([^,]*?),(.+)$/s.exec(source);
  if (!match?.[2]) return null;
  const meta = match[1] || "";
  const payload = match[2];
  try {
    if (/;base64/i.test(meta) || /^[A-Za-z0-9+/=\s]+$/.test(payload.slice(0, 80))) {
      return Buffer.from(payload.replace(/\s/g, ""), "base64");
    }
    return Buffer.from(decodeURIComponent(payload));
  } catch {
    return null;
  }
}

function sniffImageKind(
  buffer: Buffer,
): "jpeg" | "png" | "webp" | "gif" | "bmp" | "heic" | "unknown" {
  if (buffer.length < 12) return "unknown";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length > 11 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }
  const gif = buffer.subarray(0, 6).toString("ascii");
  if (gif === "GIF87a" || gif === "GIF89a") return "gif";
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return "bmp";
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heif)$/i.test(brand)) return "heic";
  }
  return "unknown";
}

function jpegHasEoiNearEnd(buffer: Buffer): boolean {
  const start = Math.max(0, buffer.length - 4096);
  for (let i = buffer.length - 2; i >= start; i--) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd9) return true;
  }
  return buffer.length > 1024;
}

function assertLikelyImageBuffer(buffer: Buffer): void {
  if (buffer.length < 32) {
    throw new Error("Invalid image data from device. Try another photo.");
  }
  const kind = sniffImageKind(buffer);
  // Allow all common formats through to Cloudinary — do not hard-block unknown.
  if (kind === "jpeg" && !jpegHasEoiNearEnd(buffer) && buffer.length < 2048) {
    throw new Error("JPEG from device looks truncated. Try another photo from Gallery.");
  }
  // unknown: still attempt upload — Cloudinary supports many formats
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
        // Normalize phone formats (HEIC/WEBP/GIF/PNG) to JPEG on Cloudinary when needed
        format: "jpg",
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
      // Do NOT match bare "image" / "Invalid" — that hid real errors (signature, auth, size)
      // behind a fake "format rejected" toast on mobile.
      if (/Invalid image file|invalid file|File format|unsupported media|unsupported file format/i.test(msg)) {
        throw new Error(
          "Cloudinary could not read this photo file. Try another Gallery photo.",
        );
      }
      throw new Error(msg || "Failed to upload to Cloudinary");
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
