import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Monorepo: load env from repo root (not apps/web)
const root = path.resolve(__dirname, "../..");
const preserveNodeEnv = process.env.NODE_ENV;
loadEnv({ path: path.join(root, ".env"), quiet: true });
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });
// Never let local .env force NODE_ENV=development onto Vercel / production
if (process.env.VERCEL || preserveNodeEnv === "production") {
  (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
} else if (preserveNodeEnv) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = preserveNodeEnv;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel project Output Directory is locked to "dist" (legacy). Match it.
  distDir: process.env.VERCEL ? "dist" : ".next",
  transpilePackages: ["@jab/server", "@jab/db", "@jab/shared"],
  serverExternalPackages: ["cloudinary", "@prisma/client", "prisma", "pg", "@prisma/adapter-pg"],
  outputFileTracingRoot: root,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
