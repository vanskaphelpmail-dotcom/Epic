import { createMocks } from "node-mocks-http";
import type { NextRequest } from "next/server";
import { createApp } from "@jab/server/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Fail before Vercel's 300s hard limit so clients get a real JSON error. */
export const maxDuration = 60;

const expressApp = createApp();

const UPLOAD_FOLDERS = new Set([
  "products",
  "banners",
  "media",
  "avatars",
  "categories",
  "patches",
]);

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length > 11 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  if (buf.length >= 6) {
    const h = buf.subarray(0, 6).toString("ascii");
    if (h === "GIF87a" || h === "GIF89a") return "image/gif";
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  // HEIC/HEIF: ....ftypheic / mif1 / heif
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heif)$/i.test(brand)) return "image/heic";
  }
  return null;
}

async function bodyFromMultipart(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return null;
    const blob = file as Blob;
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length < 32) {
      return { __uploadError: "Empty or invalid image file from device." };
    }
    // Prefer magic bytes; fall back to Blob.type; never hard-block unknown — Cloudinary may still accept.
    const sniffed =
      sniffImageMime(buf) ||
      (typeof blob.type === "string" && blob.type.startsWith("image/") ? blob.type : null) ||
      "application/octet-stream";
    const dataUrl = `data:${sniffed};base64,${buf.toString("base64")}`;
    const folderRaw = String(form.get("folder") || "products").trim();
    const folder = UPLOAD_FOLDERS.has(folderRaw) ? folderRaw : "products";
    const fileName =
      ("name" in file && typeof (file as { name?: unknown }).name === "string"
        ? (file as { name: string }).name
        : "") || String(form.get("fileName") || "photo.jpg");
    return { dataUrl, folder, fileName };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse upload form";
    return { __uploadError: message };
  }
}

async function handle(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") || "";
  const isUploadPath = url.pathname.includes("/uploads/");
  const isMultipart = contentType.includes("multipart/form-data");

  let body: unknown = undefined;

  if (isUploadPath && isMultipart && (request.method === "POST" || request.method === "PUT")) {
    const parsed = await bodyFromMultipart(request);
    if (parsed && typeof parsed.__uploadError === "string") {
      return Response.json(
        { success: false, error: { message: parsed.__uploadError } },
        { status: 400 },
      );
    }
    body = parsed || undefined;
  } else {
    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.length > 0) {
      const text = raw.toString("utf8");
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Multipart already consumed — Express should see JSON-shaped body
    if (isMultipart && key.toLowerCase() === "content-type") {
      headers[key] = "application/json";
      return;
    }
    headers[key] = value;
  });

  const { req, res } = createMocks({
    method: (request.method || "GET") as
      | "GET"
      | "POST"
      | "PUT"
      | "PATCH"
      | "DELETE"
      | "OPTIONS"
      | "HEAD",
    url: `${url.pathname}${url.search}`,
    headers,
    body,
  });

  return new Promise<Response>((resolve) => {
    let settled = false;

    const settle = (response: Response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response);
    };

    const timer = setTimeout(() => {
      console.error(`[app/api] timeout ${request.method} ${url.pathname}`);
      settle(
        Response.json(
          { success: false, error: { message: "API timeout" } },
          { status: 504 },
        ),
      );
    }, isUploadPath ? 55_000 : 45_000);

    const finish = () => {
      const status = res._getStatusCode();
      const data = res._getData();
      const outHeaders = new Headers();
      const mockHeaders = res._getHeaders();
      Object.entries(mockHeaders).forEach(([key, value]) => {
        if (value == null) return;
        if (Array.isArray(value)) value.forEach((v) => outHeaders.append(key, String(v)));
        else outHeaders.set(key, String(value));
      });

      const payload =
        typeof data === "string" || Buffer.isBuffer(data)
          ? data
          : data == null
            ? ""
            : JSON.stringify(data);

      settle(new Response(payload, { status, headers: outHeaders }));
    };

    // node-mocks-http does not always emit finish/end the way Express expects
    const originalEnd = res.end.bind(res);
    (res as { end: (...args: unknown[]) => unknown }).end = (...args: unknown[]) => {
      const result = originalEnd(...args);
      finish();
      return result;
    };

    res.on("finish", finish);
    res.on("end", finish);

    try {
      expressApp(req as never, res as never, ((err?: unknown) => {
        if (!err) return;
        const message = err instanceof Error ? err.message : "API error";
        console.error("[app/api]", err);
        if (!res.headersSent && !settled) {
          res.status(500).json({ success: false, error: { message } });
        } else if (!settled) {
          settle(
            Response.json({ success: false, error: { message } }, { status: 500 }),
          );
        }
      }) as never);
    } catch (error) {
      console.error("[app/api]", error);
      settle(
        Response.json(
          {
            success: false,
            error: {
              message: error instanceof Error ? error.message : "API error",
            },
          },
          { status: 500 },
        ),
      );
    }
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
