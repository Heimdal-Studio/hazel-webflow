// Syncs the shared hero render core from the sibling hero-gl tool into dev/, so the
// Vercel build is self-contained (Vercel builds dev/ in isolation and can't reach
// the sibling repo). Run after editing the shader/renderer in ../hero-gl:
//   node scripts/sync-hero-core.mjs
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "..", "hero-gl", "src", "app");
const destDir = join(here, "..", "src", "hero-reveal", "core");

mkdirSync(destDir, { recursive: true });
for (const file of ["hero-shader.ts", "hero-gl.ts"]) {
  copyFileSync(join(srcDir, file), join(destDir, file));
  console.log(`synced ${file}`);
}
