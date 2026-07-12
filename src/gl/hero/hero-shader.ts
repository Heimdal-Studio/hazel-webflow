// WebGL2 (GLSL ES 3.00) hero reveal shader.
//
// A cover-fit warm gradient image soft-bloom reveals in over a cream background.
// The dissolve-to-background mask that used to live here now lives in CSS (a mask
// on the DOM element in the Webflow embed), so this shader only owns the bloom
// reveal, the liquid flow warp, edge wave, and grain.
//
// snoise + mod289/permute and getCoverUv are reused verbatim from
// references/existing-heroShader.js. Everything else is new.

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

in vec2 vUv;            // 0..1 across the canvas (origin bottom-left)
out vec4 outColor;

uniform vec2  uResolution;
uniform vec2  uImageSize;
uniform sampler2D uTexture;    // source (revealed) image
uniform float uHasImage;

uniform float uProgress;       // act 1: 0..1 soft bloom reveal (from timeline)
uniform float uAngle;          // reveal direction, degrees (135 = TL->BR)
uniform float uSoftness;       // width of the soft expanding reveal edge
uniform float uDissolveBlur;   // blur (px) applied where the image dissolves
uniform float uZoomAmt;        // final source zoom multiplier (>=1), anchored top-left

uniform float uFlowAmp;        // liquid domain-warp strength (fold cusps)
uniform float uFlowScale;      // flow spatial scale (lower = bigger, silkier folds)
uniform float uFlowT;          // 0..1 sawtooth flow-cycle phase (frozen when speed is 0)
uniform float uWarpT;          // 0..1 sawtooth fold-morph phase (1/3 the flow rate)
uniform float uFlowDrift;      // advection travel distance (uv units) per flow cycle

uniform float uWaveAmp;        // edge noise amplitude
uniform float uWaveScale;      // edge noise spatial scale
uniform float uWavePhase;      // 0..2PI loop phase (frozen when motion is off)

uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainPhase;

uniform float uVignette;
uniform vec3  uBgColor;
uniform float uIncludeBg;      // 1 = opaque cream backdrop, 0 = transparent (export)

// ---- reused verbatim from references/existing-heroShader.js ----
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

vec2 getCoverUv(vec2 uv, vec2 textureSize, vec2 quadSize) {
  vec2 ratio = vec2(
    min((quadSize.x / quadSize.y) / (textureSize.x / textureSize.y), 1.0),
    min((quadSize.y / quadSize.x) / (textureSize.y / textureSize.x), 1.0)
  );
  return vec2(
    uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    uv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );
}
// ---------------------------------------------------------------

// Curl of snoise (finite differences): a divergence-free velocity field, so the
// background advects like incompressible fluid instead of wobbling in place.
vec2 curlNoise(vec2 p) {
  float e = 0.1;
  float dx = snoise(p + vec2(e, 0.0)) - snoise(p - vec2(e, 0.0));
  float dy = snoise(p + vec2(0.0, e)) - snoise(p - vec2(0.0, e));
  return vec2(dy, -dx) / (2.0 * e);
}

// 3x3 box blur of the source, radius in pixels. Used in the dissolve zone so the
// reveal reads as an expanding blur rather than a hard edge.
vec3 sampleSource(vec2 uvc, float radiusPx) {
  if (radiusPx < 0.5) return texture(uTexture, uvc).rgb;
  vec2 px = (radiusPx / uResolution);
  vec3 sum = vec3(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      sum += texture(uTexture, uvc + vec2(float(x), float(y)) * px).rgb;
    }
  }
  return sum / 9.0;
}

void main() {
  vec2 uv = vUv;

  // Reveal field: 0 on the first-revealed corner, 1 on the last (CSS 135deg = TL->BR).
  float a = radians(uAngle);
  vec2 dir = vec2(sin(a), -cos(a));
  vec2 sp = vec2(uv.x, 1.0 - uv.y);
  float directional = dot(sp - 0.5, dir) * 0.70711 + 0.5;
  // Organic bloom: blend the directional front with a radial bloom from the
  // first-revealed corner, so the reveal grows as an expanding cloud rather than a
  // straight band (mimics the reference loop's corner bloom).
  vec2 origin = vec2(0.5) - dir * 0.70711;
  float radial = length(sp - origin) / 1.41421;
  float field = mix(directional, radial, 0.6); // mostly radial = a smooth expanding front

  // Optional gentle organic undulation of the front (single low-frequency octave).
  // Kept subtle by default so the reveal reads as a smooth expansion, not a wavy edge.
  vec2 waveOffset = vec2(cos(uWavePhase), sin(uWavePhase)) * 4.0;
  field += snoise(sp * uWaveScale + waveOffset) * uWaveAmp;

  // Act 1 — soft expanding bloom: a wide smoothstep (no hard threshold) so the
  // leading edge blurs outward as uProgress grows. progress 0 = hidden (white),
  // progress 1 = fully bloomed; the first-revealed corner (field 0) appears first.
  float soft = max(uSoftness, 0.001);
  float front = uProgress * (1.0 + 2.0 * soft) - soft;
  float bloom = 1.0 - smoothstep(front - soft, front + soft, field);

  // The dissolve-to-background mask now lives in CSS (a mask on the DOM element),
  // not in this shader — the bloom reveal is the whole story here.
  float keep = clamp(bloom, 0.0, 1.0);

  // Reveal zoom — scale the source up from the top-left (the first-revealed corner)
  // over the whole reveal, so the gradient colors bloom outward while it wipes in
  // (equivalent to CSS transform-origin: top-left). Holds at the settled zoom after.
  float zoomAmt = uZoomAmt;
  vec2 tl = vec2(0.0, 1.0); // top-left in this bottom-left-origin uv space
  vec2 uvZoom = tl + (uv - tl) / zoomAmt;
  vec2 coverUv = (uImageSize.x > 0.0 && uImageSize.y > 0.0)
    ? getCoverUv(uvZoom, uImageSize, uResolution)
    : uvZoom;

  // Flow field — perpetual liquid flow over a STATIC image. Every pixel rides an
  // elliptical orbit aligned with a curl-noise flow frame (divergence-free => reads
  // as incompressible fluid), and the orbit phase travels along noise contours, so
  // compression/shear waves sweep continuously across the frame. Bounded displacement
  // (a static JPG can't be advected forever without stretching to mush), but the
  // traveling phase means motion never reads as back-and-forth wobble. Exactly
  // periodic per flow cycle and continuous for monotonic time. The warp-of-a-warp
  // (on its own 3x-slower phase, so the combined period is 3 cycles) folds the
  // drifting field into the silky cusps of the reference.
  const float TAU = 6.28318530717958647692;
  vec2 fp = vec2(cos(uWarpT * TAU), sin(uWarpT * TAU)) * 1.0;
  vec2 q = vec2(
    snoise(coverUv * uFlowScale + fp),
    snoise(coverUv * uFlowScale + fp + vec2(3.1, 1.7))
  );
  vec2 warp = vec2(
    snoise(coverUv * uFlowScale + q + fp + vec2(1.7, 9.2)),
    snoise(coverUv * uFlowScale + q + fp + vec2(8.3, 2.8))
  );
  // Local flow frame: bigger swirls than the folds, slowly evolving with the morph.
  // Soft-bounded (not normalized) so direction stays smooth through curl zeros —
  // normalize() there produces visible pinwheel pinches.
  vec2 vel = curlNoise(coverUv * uFlowScale * 0.6 + fp * 0.3);
  vec2 dirF = vel / (1.0 + length(vel));
  vec2 dirP = vec2(-dirF.y, dirF.x);

  // Orbit: phase travels along the q contours (waves advect through the silk);
  // radius varies spatially so the flow shears instead of translating rigidly.
  float ang = TAU * uFlowT + (q.x + q.y) * 2.5;
  vec2 drift = (cos(ang) * dirF + 0.6 * sin(ang) * dirP)
             * uFlowDrift * (0.7 + 0.3 * q.y);

  // Fade the total displacement out near the texture borders so large drift never
  // drags CLAMP_TO_EDGE smears into the frame.
  vec2 disp = warp * uFlowAmp - drift;
  disp /= 1.0 + 1.2 * length(disp); // soft-limit extreme excursions
  vec2 eb = min(coverUv, 1.0 - coverUv);
  disp *= smoothstep(0.0, 0.22, min(eb.x, eb.y));
  vec2 flowUv = coverUv + disp;

  // Blur rides the soft act-1 edge and settles to a floor so the liquid flow warp
  // itself reads soft, not crisp, once the reveal completes.
  float blurPx = max(uDissolveBlur * (1.0 - bloom), 12.0);
  vec3 image = mix(uBgColor, sampleSource(flowUv, blurPx), uHasImage);

  vec3 composite = mix(uBgColor, image, keep);
  vec3 color = uIncludeBg > 0.5 ? composite : image;
  float alpha = uIncludeBg > 0.5 ? 1.0 : keep;

  // Film grain over the whole frame (reuses snoise).
  float grain = snoise(gl_FragCoord.xy * uGrainScale + uGrainPhase);
  color += grain * uGrainAmount;

  // Vignette.
  float d = distance(uv, vec2(0.5));
  color *= 1.0 - smoothstep(0.4, 0.95, d) * uVignette;

  outColor = vec4(color, alpha);
}
`;
