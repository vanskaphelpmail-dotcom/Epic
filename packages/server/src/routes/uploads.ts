import { Router } from "express";
import { z } from "zod";
import { requireStaff, type AuthedRequest } from "../middleware/auth";
import {
  destroyCloudinaryImage,
  isCloudinaryConfigured,
  uploadImageToCloudinary,
} from "../lib/cloudinary";

export const uploadsRouter = Router();

uploadsRouter.get("/status", (_req, res) => {
  return res.json({
    success: true,
    data: { configured: isCloudinaryConfigured(), provider: "cloudinary" },
  });
});

const uploadSchema = z.object({
  /** data:image/...;base64,... OR https://... */
  dataUrl: z.string().min(32),
  folder: z
    .enum(["products", "banners", "media", "avatars", "categories", "patches"])
    .optional()
    .default("products"),
  fileName: z.string().optional(),
});

uploadsRouter.post(
  "/image",
  requireStaff,
  async (req: AuthedRequest, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        error: {
          message:
            "Cloudinary is not configured. Add CLOUDINARY_URL to your .env (Dashboard → API Keys).",
        },
      });
    }

    const body = uploadSchema.parse(req.body);
    const folder = `jersey-addicts/${body.folder}`;
    const uploaded = await uploadImageToCloudinary(body.dataUrl, {
      folder,
      tags: ["jersey-addicts", body.folder],
    });

    return res.status(201).json({
      success: true,
      data: {
        url: uploaded.url,
        publicId: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
        format: uploaded.format,
        bytes: uploaded.bytes,
        folder: body.folder,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid upload payload" },
      });
    }
    console.error("[POST /uploads/image]", error);
    return res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to upload image to Cloudinary",
      },
    });
  }
});

uploadsRouter.delete(
  "/image",
  requireStaff,
  async (req: AuthedRequest, res) => {
  try {
    const publicId = String(req.body?.publicId || req.query?.publicId || "").trim();
    if (!publicId) {
      return res.status(400).json({
        success: false,
        error: { message: "publicId is required" },
      });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        error: { message: "Cloudinary is not configured" },
      });
    }
    await destroyCloudinaryImage(publicId);
    return res.json({ success: true, data: { deleted: publicId } });
  } catch (error) {
    console.error("[DELETE /uploads/image]", error);
    return res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Failed to delete image" },
    });
  }
});
