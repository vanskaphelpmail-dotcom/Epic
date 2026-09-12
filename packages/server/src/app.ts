import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { bootstrapRouter } from "./routes/bootstrap";
import { productsRouter } from "./routes/products";
import { ordersRouter } from "./routes/orders";
import { cmsRouter } from "./routes/cms";
import { cartRouter } from "./routes/cart";
import { wishlistRouter } from "./routes/wishlist";
import { addressesRouter } from "./routes/addresses";
import { reviewsRouter } from "./routes/reviews";
import { couponsRouter } from "./routes/coupons";
import { catalogRouter } from "./routes/catalog";
import { usersRouter } from "./routes/users";
import { sellersRouter } from "./routes/sellers";
import { adminRouter } from "./routes/admin";
import { uploadsRouter } from "./routes/uploads";
import { prisma } from "@jab/db";

function collectAllowedOrigins(): Set<string> {
  const set = new Set<string>();

  const add = (raw?: string | null) => {
    if (!raw) return;
    for (const part of raw.split(",")) {
      let origin = part.trim().replace(/\/$/, "");
      if (!origin) continue;
      if (!/^https?:\/\//i.test(origin)) origin = `https://${origin}`;
      set.add(origin);
    }
  };

  add(process.env.CORS_ORIGIN);
  add(process.env.APP_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  add(process.env.AUTH_URL);
  // Injected by Vercel on every deployment
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  add("http://localhost:3000");
  add("http://127.0.0.1:3000");
  // Production custom domain (same project as classic-football-jerseys-web)
  add("https://www.jerseyaddictbd.com");
  add("https://jerseyaddictbd.com");

  return set;
}

export function createApp() {
  const app = express();

  const allowedOrigins = collectAllowedOrigins();

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.has("*") || allowedOrigins.has(origin)) {
          return cb(null, true);
        }
        // Vercel preview / production aliases (same-origin /api still sends Origin)
        try {
          const host = new URL(origin).hostname;
          if (host.endsWith(".vercel.app")) return cb(null, true);
          if (host === "jerseyaddictbd.com" || host.endsWith(".jerseyaddictbd.com")) {
            return cb(null, true);
          }
        } catch {
          /* ignore */
        }
        // Reject without throwing — throwing left the Next adapter hanging → 504
        console.warn(`[api] CORS rejected origin: ${origin}`);
        return cb(null, false);
      },
      credentials: true,
    }),
  );

  // Skip stream JSON parsing when body was pre-parsed (Next.js App Router adapter)
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null && !Buffer.isBuffer(req.body)) {
      return next();
    }
    return express.json({ limit: "10mb" })(req, res, next);
  });
  app.use(cookieParser());

  app.get("/api/health", async (_req, res) => {
    try {
      // Fail fast if Neon is unreachable (avoid Vercel 300s hang)
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("db_timeout")), 8_000),
        ),
      ]);
      const authConfigured = Boolean(
        (process.env.AUTH_SECRET || process.env.JWT_SECRET || "").trim(),
      );
      res.json({
        ok: true,
        db: "up",
        service: "jersey-addicts-api",
        authConfigured,
        cloudinary: Boolean(
          process.env.CLOUDINARY_URL?.trim() ||
            (process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
              process.env.CLOUDINARY_API_KEY?.trim() &&
              process.env.CLOUDINARY_API_SECRET?.trim()),
        ),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[api/health]", message);
      res.status(503).json({
        ok: false,
        db: "down",
        reason: /timeout/i.test(message)
          ? "timeout"
          : /DATABASE_URL|not set/i.test(message)
            ? "missing_database_url"
            : "unreachable",
        authConfigured: Boolean(
          (process.env.AUTH_SECRET || process.env.JWT_SECRET || "").trim(),
        ),
        hint:
          "Set Vercel DATABASE_URL to the Neon pooler host (…-pooler…) without channel_binding=require. Match the local .env Neon project.",
      });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/auth", bootstrapRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/addresses", addressesRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/catalog", catalogRouter);
  app.use("/api/cms", cmsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/sellers", sellersRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/uploads", uploadsRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api]", err);
    res.status(500).json({ success: false, error: { message: err.message || "Server error" } });
  });

  return app;
}
