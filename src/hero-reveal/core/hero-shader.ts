// WebGL2 (GLSL ES 3.00) hero reveal shader.
//
// A cover-fit warm gradient image dissolves into a cream background through an
// uploadable grayscale MASK (default references/home-h-mask.jpg: white = keep the
// image, black = dissolve to background; mapped down the frame so the dissolve
// "lives at the bottom"). The dissolve is SOFT: the mask is used as a smooth alpha
// (no hard threshold) and the dissolving zone is blurred, so the reveal reads as a
// blur that expands rather than a razor edge.
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
uniform sampler2D uMask;       // dissolve mask (grayscale; white = keep)
uniform float uHasMask;
uniform vec2  uMaskSize;       // mask pixels (for width-100% / height-auto fit)

uniform float uProgress;       // act 1: 0..1 soft bloom reveal (from timeline)
uniform float uMaskPhase;      // act 2: 0..1 mask reveal-in
uniform float uMaskEdge;       // act 2: razor front width (lower = sharper scanline edges)
uniform float uMaskMode;       // act 2 style: 0 = fade (gradient), 1 = wipe (razor front)
uniform float uAngle;          // reveal direction, degrees (135 = TL->BR)
uniform float uSoftness;       // width of the soft expanding reveal edge
uniform float uDissolveBlur;   // blur (px) applied where the image dissolves
uniform float uZoomAmt;        // final source zoom multiplier (>=1), anchored top-left

uniform float uFlowAmp;        // liquid domain-warp strength (perpetual background flow)
uniform float uFlowScale;      // flow spatial scale (lower = bigger, silkier folds)
uniform float uFlowPhase;      // 0..2PI looping flow phase (frozen when speed is 0)

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

  // Dissolve mask (white = keep image, black = background), sized width-100% /
  // height-auto and anchored to the bottom. Above the mask band the sampler clamps
  // to the mask's top edge (white = keep), so the top of the image is untouched.
  float maskBandH = (uMaskSize.x > 0.0)
    ? (uResolution.x * uMaskSize.y) / (uResolution.y * uMaskSize.x)
    : 1.0;
  vec2 maskUv = vec2(uv.x, uv.y / max(maskBandH, 1e-4));
  float maskKeep = uHasMask > 0.5
    ? dot(texture(uMask, maskUv).rgb, vec3(0.299, 0.587, 0.114))
    : 1.0;

  // Act 2 — the mask reveals IN, settling on the ORIGINAL mask dissolve (end state
  // == the uploaded mask). Act 1 shows the FULL image (no mask). Two styles:
  //   fade : crossfade the whole mask in (uMaskPhase 0->1).
  //   wipe : a razor-sharp front sweeps from the darkest mask region upward, leaving
  //          the original mask behind it.
  float maskApplied;
  if (uMaskMode > 1.5) {
    maskApplied = maskKeep; // static: mask applied, no reveal animation
  } else if (uMaskMode < 0.5) {
    maskApplied = mix(1.0, maskKeep, uMaskPhase); // fade
  } else {
    float sharp = max(uMaskEdge, 0.001);
    float sweepLevel = mix(-2.0 * sharp, 1.0 + 2.0 * sharp, uMaskPhase);
    float swept = 1.0 - smoothstep(sweepLevel - sharp, sweepLevel + sharp, maskKeep);
    maskApplied = mix(1.0, maskKeep, swept); // wipe
  }

  float keep = clamp(bloom * maskApplied, 0.0, 1.0);

  // Reveal zoom — scale the source up from the top-left (the first-revealed corner)
  // over the whole reveal, so the gradient colors bloom outward while it wipes in
  // (equivalent to CSS transform-origin: top-left). Holds at the settled zoom after.
  float zoomAmt = uZoomAmt;
  vec2 tl = vec2(0.0, 1.0); // top-left in this bottom-left-origin uv space
  vec2 uvZoom = tl + (uv - tl) / zoomAmt;
  vec2 coverUv = (uImageSize.x > 0.0 && uImageSize.y > 0.0)
    ? getCoverUv(uvZoom, uImageSize, uResolution)
    : uvZoom;

  // Flow field — perpetual liquid motion. Domain-warp the sample coords with looping
  // simplex noise (a circular phase => the warp returns to start each loop, so it's
  // seamless yet never stops). A warp-of-a-warp gives the silky folds of the reference.
  vec2 fp = vec2(cos(uFlowPhase), sin(uFlowPhase)) * 1.5;
  vec2 q = vec2(
    snoise(coverUv * uFlowScale + fp),
    snoise(coverUv * uFlowScale + fp + vec2(3.1, 1.7))
  );
  vec2 warp = vec2(
    snoise(coverUv * uFlowScale + q + fp + vec2(1.7, 9.2)),
    snoise(coverUv * uFlowScale + q + fp + vec2(8.3, 2.8))
  );
  vec2 flowUv = coverUv + warp * uFlowAmp;

  // Blur rides the soft act-1 edge and fades out as the razor act-2 settles.
  float blurPx = uDissolveBlur * (1.0 - bloom) * (1.0 - uMaskPhase);
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
