// Procedural grayscale brush mask for the painterly reveal.
// White = keep the image, black = dissolve to the background. N rough paint
// strokes are stacked along the reveal's sweep axis, so the directional bloom
// paints them in roughly one-at-a-time. Dependency-free canvas 2D. Tooling only
// (NOT imported by src/, never bundled). Import from gen-brush-mask.html or the
// smoke test.
//
// Same angle convention as the shader: 135deg sweeps top-left -> bottom-right.

// Deterministic PRNG so a given seed reproduces the exact same mask.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_MASK_OPTS = {
  width: 2000,
  height: 1200,
  strokes: 7,
  angleDeg: 135,
  seed: 7,
  coverage: 1.4, // >1 = neighbouring strokes overlap toward full frame coverage
  grain: 0.7, // 0..1.5 dry-brush bristle grain layered over the stroke bodies
  roughness: 1, // 0..~1.5, edge jitter + ragged ends
};

export function drawBrushMask(canvas, options = {}) {
  const o = { ...DEFAULT_MASK_OPTS, ...options };
  const { width, height, strokes, angleDeg, seed, coverage, grain, roughness } = o;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const rnd = mulberry32(seed);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter"; // paint builds up toward white

  // Sweep direction in canvas coords (origin top-left, y down) — matches the
  // shader's `dir = (sin a, -cos a)`. Strokes stack along dir; each runs along
  // perp so it spans the frame.
  const a = (angleDeg * Math.PI) / 180;
  const dir = { x: Math.sin(a), y: -Math.cos(a) };
  const perp = { x: -dir.y, y: dir.x };
  const ang = Math.atan2(perp.y, perp.x); // stroke long-axis angle
  const cx = width / 2;
  const cy = height / 2;
  const spanDir = Math.abs(width * dir.x) + Math.abs(height * dir.y);
  const spanPerp = Math.abs(width * perp.x) + Math.abs(height * perp.y);
  const halfThick = (0.5 * spanDir * coverage) / strokes;

  // A soft elongated dab: white core fading to transparent, oriented along the
  // stroke and stretched (rl = length radius, rt = thickness radius).
  const stamp = (x, y, rl, rt, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(rl, rt);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.5})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  for (let s = 0; s < strokes; s++) {
    // Center of this stroke along the sweep axis (evenly spaced, slight jitter).
    const tAlong = ((s + 0.5) / strokes - 0.5) * spanDir + (rnd() - 0.5) * halfThick * 0.6;
    const scx = cx + dir.x * tAlong;
    const scy = cy + dir.y * tAlong;
    const len = spanPerp * (0.78 + 0.35 * rnd());
    const dabR = len * 0.06; // long radius per dab

    // 1) Stroke body: overlapping soft dabs along the centerline, ragged/tapered
    //    at the ends so it reads as a paint swipe rather than a bar.
    const nDabs = Math.max(8, Math.round(len / (dabR * 0.85)));
    for (let i = 0; i <= nDabs; i++) {
      const f = i / nDabs; // 0..1 along the stroke
      const taper = Math.sin(Math.PI * f); // 0 at ends -> 1 mid
      if (rnd() > 0.2 + 0.8 * taper) continue; // raggeder toward the ends
      const t = -len / 2 + len * f;
      const jit = (rnd() - 0.5) * halfThick * 0.6 * roughness;
      const px = scx + perp.x * t + dir.x * jit;
      const py = scy + perp.y * t + dir.y * jit;
      const rt = halfThick * (0.6 + 0.5 * rnd()) * (0.45 + 0.55 * taper);
      stamp(px, py, dabR * (0.85 + 0.5 * rnd()), rt, 0.32 + 0.34 * rnd());
    }

    // 2) Dry-brush grain: a few coarse bristle streaks with random breaks, for
    //    texture and ragged edges over the solid body.
    ctx.lineCap = "round";
    const nStreaks = Math.round(60 * grain);
    for (let b = 0; b < nStreaks; b++) {
      const u = rnd() * 2 - 1;
      const off = Math.sign(u) * u * u * halfThick; // denser mid-band
      const alpha = 0.05 + 0.13 * rnd();
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 2 + rnd() * 6;
      const sl = len * (0.3 + 0.5 * rnd());
      const st = -sl / 2 + (rnd() - 0.5) * len * 0.4;
      let down = false;
      ctx.beginPath();
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        const t = st + (sl * i) / segs;
        const jit = off + (rnd() - 0.5) * halfThick * 0.3 * roughness;
        const px = scx + perp.x * t + dir.x * jit;
        const py = scy + perp.y * t + dir.y * jit;
        if (rnd() < 0.1 * roughness) {
          down = false;
          continue;
        }
        if (!down) {
          ctx.moveTo(px, py);
          down = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
  }

  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

// Cheap sanity metrics for the self-check: mean luminance (coverage 0..1) and
// how many distinct ink bands appear along the sweep axis (~= stroke count).
export function analyzeMask(canvas, options = {}) {
  const o = { ...DEFAULT_MASK_OPTS, ...options };
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i]; // red == luminance (grayscale)
  const coverage = sum / (255 * (data.length / 4));

  // Project brightness onto the sweep axis into buckets, count peaks above mean.
  const a = (o.angleDeg * Math.PI) / 180;
  const dir = { x: Math.sin(a), y: -Math.cos(a) };
  const spanDir = Math.abs(width * dir.x) + Math.abs(height * dir.y);
  const B = 64;
  const buckets = new Float64Array(B);
  const step = 7; // sample every 7px for speed
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const proj = ((x - width / 2) * dir.x + (y - height / 2) * dir.y) / spanDir + 0.5;
      const bi = Math.min(B - 1, Math.max(0, Math.floor(proj * B)));
      buckets[bi] += data[(y * width + x) * 4];
    }
  }
  const mean = buckets.reduce((s, v) => s + v, 0) / B;
  let bands = 0;
  for (let i = 1; i < B - 1; i++) {
    if (buckets[i] > mean && buckets[i] >= buckets[i - 1] && buckets[i] > buckets[i + 1]) bands++;
  }
  return { coverage, bands };
}
