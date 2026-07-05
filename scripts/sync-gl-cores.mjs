// Syncs the GL render cores from the sibling hazel-gl tool into src/gl/, so the
// Vercel build is self-contained (Vercel builds dev-hazel in isolation and can't
// reach the sibling repo). The synced files are generated — do not edit locally.
// Run after editing a shader/renderer in ../hazel-gl:
//   node scripts/sync-gl-cores.mjs
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const toolAppDir = join(here, "..", "..", "hazel-gl", "src", "app");
const glDir = join(here, "..", "src", "gl");

const effects = {
  career: ["career-gl.ts", "career-shader.ts"],
  fluid: ["fluid-gl.ts", "fluid-shader.ts"],
  hero: ["hero-gl.ts", "hero-shader.ts"],
};

for (const [effect, files] of Object.entries(effects)) {
  const destDir = join(glDir, effect);
  mkdirSync(destDir, { recursive: true });
  for (const file of files) {
    copyFileSync(join(toolAppDir, effect, file), join(destDir, file));
    console.log(`synced ${effect}/${file}`);
  }
}

// Shared GL utils (added by the hazel-gl consolidation; optional until extracted).
const sharedSrc = join(toolAppDir, "shared");
if (existsSync(sharedSrc)) {
  const destDir = join(glDir, "shared");
  mkdirSync(destDir, { recursive: true });
  for (const file of readdirSync(sharedSrc).filter((f) => f.endsWith(".ts"))) {
    copyFileSync(join(sharedSrc, file), join(destDir, file));
    console.log(`synced shared/${file}`);
  }
}
