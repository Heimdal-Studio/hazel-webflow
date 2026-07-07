// WebGL2 (GLSL ES 3.00) Fluid BGs shader.
//
// A fully procedural animated background: a dark base color lit by up to five
// soft, drifting colored glows at user-editable positions and radii, plus film
// grain. All motion rides a circle of the loop phase (uLoopT) so the first and
// last frames stitch exactly for seamless loop export.
//
// snoise + mod289/permute are the Ashima Arts simplex noise (MIT), reused
// verbatim from the sibling hero-gl app.

export const VERTEX_SHADER = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); // (0,0)(2,0)(0,2)
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;            // 0..1 across the canvas
out vec4 outColor;

uniform vec2  uResolution;    // backing pixels
uniform float uLoopT;         // 0..1 loop progress (timeline-driven)
uniform float uFieldScale;    // flow-field granularity
uniform float uFieldWarp;     // how much the flow warps the glow positions
uniform float uFieldDrift;    // orbit radius per loop (travel)
uniform float uFieldMorph;    // fold-evolution amount per loop (fluidity)
uniform float uToneRamp;      // smoothstep half-width (from Contrast)
uniform float uToneBalance;   // shifts glow intensity dark (-) / bright (+)
uniform vec2  uGlowPos[5];      // glow centers in vUv units (y up)
uniform vec3  uGlowColor[5];    // glow colors
uniform float uGlowRadius[5];   // falloff distance in uv units
uniform float uGlowStrength[5]; // per-glow intensity multiplier
uniform int   uGlowCount;       // 1..5
uniform vec3  uPaper;         // dark base color == background
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainPhase;
uniform float uIncludeBg;     // 0 = base transparent (glows-only export)

// ---- Ashima Arts simplex noise (MIT), reused verbatim from the hero app ----
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289v3(((x * 34.0) + 10.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
// ---------------------------------------------------

const float TAU = 6.28318530717958647692;

void main() {
  // Loop-safe phases: motion rides circles of the loop progress, so
  // frame(0) == frame(1). fp drives travel; fp2 (90 degrees out of phase)
  // drives fold evolution, so the field melts while it drifts.
  vec2 fp = vec2(cos(uLoopT * TAU), sin(uLoopT * TAU));
  vec2 fp2 = vec2(cos(uLoopT * TAU + 1.5707963), sin(uLoopT * TAU + 1.5707963));

  // 1. Flow field — domain-warped snoise, aspect-corrected.
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * uFieldScale;
  vec2 drift = fp * uFieldDrift;
  vec2 morph = fp2 * uFieldMorph;
  vec2 q = vec2(
    snoise(p + drift + morph),
    snoise(p + drift + morph + vec2(5.2, 1.3)));
  float f = snoise(p + q * uFieldWarp + drift * 0.6);
  // Second octave, counter-drifting: shears against the base layer for a
  // liquid feel and gives the glow edges varied, organic falloff.
  f += 0.35 * snoise(p * 2.3 - drift + q * uFieldWarp * 0.5 + vec2(9.7, 3.1));
  f /= 1.35;
  float ramp = max(uToneRamp, 0.02);
  float base = smoothstep(-ramp, ramp, f + uToneBalance);

  // 2. Grain — additive snoise speckle (phase 0 = static).
  float grain = snoise(gl_FragCoord.xy * uGrainScale + uGrainPhase);

  // 4. Glow field: a dark base (uPaper) lit by up to five soft colored glows at
  //    user-editable anchors. The flow warps the sample point and 'base'
  //    (Contrast + Balance) breathes the glow intensity, so the light pools
  //    drift and pulse organically instead of sitting as static radial blobs.
  //    distance() runs in plain vUv units (matching the DOM handle overlay's
  //    ellipse rings); later glows mix over earlier ones.
  vec2 gp = vUv + q * (uFieldWarp * 0.22) + drift * 0.8;
  float breathe = 0.5 + 0.5 * base;
  vec3 color = uPaper;
  float glowCover = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= uGlowCount) break;
    float g = smoothstep(uGlowRadius[i], 0.0, distance(gp, uGlowPos[i])) * breathe * uGlowStrength[i];
    color = mix(color, uGlowColor[i], clamp(g, 0.0, 1.0));
    glowCover += g;
  }
  color = clamp(color + grain * uGrainAmount, 0.0, 1.0);
  glowCover = clamp(glowCover, 0.0, 1.0);
  float alpha = uIncludeBg > 0.5 ? 1.0 : glowCover;
  outColor = vec4(color, alpha);
}
`;
