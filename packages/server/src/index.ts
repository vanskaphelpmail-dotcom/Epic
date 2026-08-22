import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createApp } from "./app";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, ".env.local"), override: true });

/** Optional standalone Express (@jab/server). Next uses createApp via App Router. */
const port = Number(process.env.API_PORT || 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`Epic Vanskap standalone API on http://localhost:${port}`);
});
