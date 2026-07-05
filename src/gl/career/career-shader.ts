// WebGL2 (GLSL ES 3.00) Career Hero shader.
//
// Recreates the Career Hero reference loop (references/career-hero-reference.mp4):
// a monochrome field of huge, soft, morphing blobs (domain-warped simplex noise)
// under a static ~45° twill line screen (overlay blend, so lines pop in mid-greys
// and wash out near pure black/white) plus additive film grain. The field maps
// ink -> paper between two colors; paper doubles as the exportable background.
//
// Every animated input rides a circle of the loop phase (uLoopT), so the first
// and last frames stitch exactly — unlike the reference mp4, which jumps.
//
// snoise + mod289/permute are reused verbatim from the sibling hero-gl app
// (Ashima Arts simplex noise, MIT).

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
uniform float uFieldScale;    // blob spatial frequency (higher = smaller blobs)
uniform float uFieldWarp;     // domain-warp strength (fold/morph amount)
uniform float uFieldDrift;    // orbit radius in noise space per loop (travel)
uniform float uFieldMorph;    // fold-evolution amount (fluidity of the melt)
uniform float uToneRamp;      // smoothstep half-width (lower = harder contrast)
uniform float uToneBalance;   // shifts the field toward ink (-) or paper (+)
uniform vec3  uInk;           // dark end of the ramp
uniform vec3  uPaper;         // light end of the ramp == background color
uniform float uLineStrength;  // 0 = no line screen, 1 = full overlay
uniform float uLinePeriodPx;  // line period in backing pixels (pre-scaled in JS)
uniform float uLineAngle;     // degrees; 45 matches the reference twill
uniform float uLineRough;     // hand-printed irregularity: phase jitter + local strength variation
uniform float uLineBlend;     // blend mode: 0 overlay, 1 soft light, 2 multiply, 3 screen
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainPhase;
uniform float uIncludeBg;     // 0 = paper transparent (ink-only export)

uniform sampler2D uPhoto;     // hero photo, cover-fit (black 1x1 when absent)
uniform float uHasPhoto;      // 1 = a photo is loaded; blends under the line screen
uniform vec2  uPhotoSize;     // photo pixels, for cover fitting
uniform float uPhotoRipple;   // subtle loop-safe liquid warp amplitude on the photo
uniform float uPhotoRippleScale; // ripple spatial frequency
uniform float uBlobWash;      // 0..1 how much the blob field tints/animates the photo

uniform sampler2D uMask;      // grayscale dissolve mask (white = keep, black = background)
uniform float uHasMask;       // 1 = a mask is loaded
uniform vec2  uMaskSize;      // mask pixels, sized width-100% and anchored to the bottom
uniform float uMaskStrength;  // 0 = ignore the mask, 1 = full bottom dissolve

// ---- reused verbatim from the sibling hero app ----
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

// Cover-fit UV (background-size: cover) so the photo fills the frame without
// distortion. Reused from the sibling hero app.
vec2 getCoverUv(vec2 uv, vec2 textureSize, vec2 quadSize) {
  vec2 ratio = vec2(
    min((quadSize.x / quadSize.y) / (textureSize.x / textureSize.y), 1.0),
    min((quadSize.y / quadSize.x) / (textureSize.y / textureSize.x), 1.0));
  return vec2(
    uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    uv.y * ratio.y + (1.0 - ratio.y) * 0.5);
}

// Photoshop "overlay" blend, per channel: the base pops the line screen in
// mid-tones and washes it out toward pure black/white, so the twill reads as
// printed onto the photo rather than pasted over it.
float overlay1(float b, float s) {
  return b < 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
}

// Blend the line screen value s (0.5 = neutral) onto a base channel b. Every
// mode is neutral at s=0.5, so the Strength slider still means "0 = no lines".
//   overlay    : contrast-aware, lines pop in mid-tones (the reference look)
//   soft light : gentler overlay, lines feel embedded in the surface
//   multiply   : dark line troughs darken the base like printed ink
//   screen     : bright line crests lighten the base
float lineBlend(float b, float s, float mode) {
  if (mode < 0.5) return overlay1(b, s);
  if (mode < 1.5) return (1.0 - 2.0 * s) * b * b + 2.0 * s * b;
  if (mode < 2.5) return b * clamp(2.0 * s, 0.0, 1.0);
  return 1.0 - (1.0 - b) * clamp(2.0 * (1.0 - s), 0.0, 1.0);
}

const float TAU = 6.28318530717958647692;

void main() {
  // Loop-safe phases: all motion rides circles of the loop progress, so
  // frame(0) == frame(1). fp drives travel; fp2 (90 degrees out of phase)
  // drives fold evolution, so the field melts while it drifts instead of
  // orbiting rigidly.
  vec2 fp = vec2(cos(uLoopT * TAU), sin(uLoopT * TAU));
  vec2 fp2 = vec2(cos(uLoopT * TAU + 1.5707963), sin(uLoopT * TAU + 1.5707963));

  // 1. Blob field — domain-warped snoise, aspect-corrected so blobs stay round.
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * uFieldScale;
  vec2 drift = fp * uFieldDrift;
  vec2 morph = fp2 * uFieldMorph;
  vec2 q = vec2(
    snoise(p + drift + morph),
    snoise(p + drift + morph + vec2(5.2, 1.3)));
  float f = snoise(p + q * uFieldWarp + drift * 0.6);
  // Second octave, counter-drifting: shears against the base layer for a
  // liquid feel and gives the ink/paper edges varied, organic falloff.
  f += 0.35 * snoise(p * 2.3 - drift + q * uFieldWarp * 0.5 + vec2(9.7, 3.1));
  f /= 1.35;
  float ramp = max(uToneRamp, 0.02);
  float base = smoothstep(-ramp, ramp, f + uToneBalance);

  // 2. Line screen — static twill, overlay blend (max pop in mid-tones).
  // Roughness jitters the line phase (wobbly, hand-printed strokes) and varies
  // the local strength across the field so the screen stops reading as a
  // perfect mechanical sine.
  float a = radians(uLineAngle);
  float d = cos(a) * gl_FragCoord.x + sin(a) * gl_FragCoord.y;
  float period = max(uLinePeriodPx, 1.0);
  float jitter = snoise(gl_FragCoord.xy * (0.7 / period));
  // Low-freq undulation bends the lines into broad waves.
  float jitterLow = snoise(gl_FragCoord.xy * (0.12 / period));
  d += (jitter * 0.4 + jitterLow * 0.6) * uLineRough * period * 0.85;
  float variation = 0.5 + 0.5 * snoise(p * 3.0 + vec2(7.3, 2.6));
  float wave = sin(d * TAU / period);
  // At low roughness: smooth sine gradient (soft halftone).
  // At high roughness: threshold-based lines with noise-driven weight variation
  // (lines range from hairline to solid bar, can break entirely), like etching.
  float widthNoise = 0.5 + 0.5 * snoise(p * 1.8 + fp * 0.3 + vec2(3.3, 8.1));
  float lineWeight = mix(0.5, widthNoise, uLineRough); // 0.5 uniform → noise-driven
  float sineLine = 0.5 + 0.5 * wave;
  float etching = smoothstep(-lineWeight * 0.6, lineWeight * 0.6, wave);
  float line = mix(sineLine, etching, uLineRough * uLineRough);
  float strengthLocal = uLineStrength * (1.0 - uLineRough * 0.6 * (1.0 - variation));
  float l = mix(0.5, line, strengthLocal);
  float shaded = lineBlend(base, l, uLineBlend);

  // 3. Grain — additive snoise speckle (phase 0 = static).
  float grain = snoise(gl_FragCoord.xy * uGrainScale + uGrainPhase);

  if (uHasPhoto > 0.5) {
    // Photo path: the hero image is the base layer, gently rippling on a
    // loop-safe circle so it reads as alive; the blob field washes over it as
    // atmosphere; the twill line screen overlays the result in color.
    vec2 ripple = uPhotoRipple * vec2(
      snoise(vUv * uPhotoRippleScale + fp * 0.6),
      snoise(vUv * uPhotoRippleScale + fp2 * 0.6 + vec2(4.7, 1.9)));
    vec2 cuv = getCoverUv(vUv + ripple, uPhotoSize, uResolution);
    vec3 photo = texture(uPhoto, cuv).rgb;

    // Blob wash: tint the photo toward the blob field's ink/paper tone so the
    // slow blob motion breathes through the image.
    vec3 washTone = mix(uInk, uPaper, base);
    vec3 baseColor = mix(photo, washTone, uBlobWash);

    // Line screen blended per channel (color-preserving), then grain.
    vec3 shadedColor = vec3(
      lineBlend(baseColor.r, l, uLineBlend),
      lineBlend(baseColor.g, l, uLineBlend),
      lineBlend(baseColor.b, l, uLineBlend));
    vec3 rgb = clamp(shadedColor + grain * uGrainAmount, 0.0, 1.0);

    // Bottom dissolve: the mask (width-100%, anchored to the bottom) fades the
    // photo into the paper/background color. Above the mask band the sampler
    // clamps to the mask's top edge (white = keep), so the top stays untouched.
    float maskBandH = (uMaskSize.x > 0.0)
      ? (uResolution.x * uMaskSize.y) / (uResolution.y * uMaskSize.x)
      : 1.0;
    vec2 maskUv = vec2(vUv.x, vUv.y / max(maskBandH, 1e-4));
    float maskKeep = uHasMask > 0.5
      ? dot(texture(uMask, maskUv).rgb, vec3(0.299, 0.587, 0.114))
      : 1.0;
    maskKeep = mix(1.0, maskKeep, uMaskStrength);
    rgb = mix(uPaper, rgb, maskKeep);
    float photoAlpha = uIncludeBg > 0.5 ? 1.0 : maskKeep;
    outColor = vec4(rgb, photoAlpha);
    return;
  }

  // 4. Mono path (no photo): tint + background policy. Paper IS the background.
  // Include off keeps the ink field and turns paper into transparency.
  float lum = clamp(shaded + grain * uGrainAmount, 0.0, 1.0);
  vec3 color = mix(uInk, uPaper, lum);
  float alpha = uIncludeBg > 0.5 ? 1.0 : (1.0 - lum);
  vec3 rgb = uIncludeBg > 0.5 ? color : uInk;
  outColor = vec4(rgb, alpha);
}
`;
