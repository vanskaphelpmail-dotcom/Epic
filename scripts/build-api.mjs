import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("api", { recursive: true });

// ESM output matches package.json "type": "module".
// Relative api/server/* imports are inlined into api/index.js for Vercel.
await esbuild.build({
  entryPoints: ["api/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "api/index.js",
  packages: "external",
  logLevel: "info",
  sourcemap: false,
  banner: {
    js: "// Bundled Express API for Vercel serverless\n",
  },
});

console.log("Bundled Express API → api/index.js");
