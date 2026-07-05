// Pure, framework-agnostic WebGL2 Career Hero renderer. No textures, no
// Toolcraft or React deps, so a future Webflow runtime can reuse it as-is.
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./career-shader";

export type CareerParams = {
  fieldScale: number; // blob spatial frequency (higher = smaller blobs)
  fieldWarp: number; // domain-warp strength (fold/morph amount)
  fieldDrift: number; // noise-space orbit radius per loop (travel)
  fieldMorph: number; // fold-evolution amount per loop (fluidity)
  fieldSpeed: number; // multiplier on drift+morph; grain/lines unaffected
  contrast: number; // 0..1 slider; mapped to the smoothstep ramp width
  balance: number; // shifts the field toward ink (-) or paper (+)
  ink: string; // hex, dark end of the ramp
  paper: string; // hex, light end == background color
  lineStrength: number; // 0..1 overlay mix of the line screen
  lineSpacing: number; // line period in canvas px (resolution-independent)
  lineAngle: number; // degrees
  lineRoughness: number; // 0..1 phase jitter + local strength variation
  lineBlend: number; // 0 overlay, 1 soft light, 2 multiply, 3 screen
  grainAmount: number;
  grainScale: number;
  grainAnimate: boolean;
  includeBg: boolean; // false = paper transparent (ink-only export)
  photoRipple: number; // subtle loop-safe liquid warp on the hero photo
  photoRippleScale: number; // ripple spatial frequency
  blobWash: number; // 0..1 how much the blob field tints/animates the photo
  maskStrength: number; // 0..1 bottom dissolve into the background via the mask
  loopDurationSeconds: number;
};

export const DEFAULT_CAREER_PARAMS: CareerParams = {
  fieldScale: 0.8,
  fieldWarp: 0.3,
  fieldDrift: 0.1,
  fieldMorph: 0.35,
  fieldSpeed: 1.0,
  contrast: 0.35,
  balance: 0.09,
  ink: "#513B1A",
  paper: "#425671",
  lineStrength: 0.5,
  lineSpacing: 5,
  lineAngle: 90,
  lineRoughness: 0.09,
  lineBlend: 0,
  grainAmount: 0.06,
  grainScale: 1.0,
  grainAnimate: true,
  includeBg: true,
  photoRipple: 0.006,
  photoRippleScale: 2.5,
  blobWash: 0.25,
  maskStrength: 1.0,
  loopDurationSeconds: 30,
};

export type CareerRenderOptions = {
  width: number; // backing pixels
  height: number;
  canvasWidth: number; // state.canvas.size.width, keeps line density stable
  loopProgress: number; // 0..1 position in the loop
  loopTime: number; // seconds into the loop (grain stepping)
  includeBg: boolean;
};

export function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Career shader compile failed: ${log}`);
  }
  return shader;
}

function buildProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Career program link failed: ${log}`);
  }
  return program;
}

export type CareerGL = {
  canvas: HTMLCanvasElement;
  render: (params: CareerParams, options: CareerRenderOptions) => void;
  setImage: (url: string) => void; // sync-load a hero photo (data URL or URL)
  setImageAsync: (url: string) => Promise<void>; // await load (used by export)
  setMask: (url: string) => void; // sync-load the bottom-dissolve mask
  setMaskAsync: (url: string) => Promise<void>;
  dispose: () => void;
};

type PhotoSlot = {
  size: [number, number]; // [0,0] when no photo is loaded
  sync: (url: string) => void;
  setAsync: (url: string) => Promise<void>;
  dispose: () => void;
};

/** A texture on the given unit that lazily loads an image from a URL. */
function createPhotoSlot(
  gl: WebGL2RenderingContext,
  unit: number,
  samplerLoc: WebGLUniformLocation | null,
): PhotoSlot {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (samplerLoc) gl.uniform1i(samplerLoc, unit);

  const size: [number, number] = [0, 0];
  let loadedSrc = "";
  const upload = (img: HTMLImageElement) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    size[0] = img.naturalWidth;
    size[1] = img.naturalHeight;
  };
  const load = (url: string, done?: () => void) => {
    loadedSrc = url;
    if (!url) {
      size[0] = 0;
      size[1] = 0;
      done?.();
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (loadedSrc === url) upload(img);
      done?.();
    };
    img.onerror = () => done?.();
    img.src = url;
  };
  return {
    size,
    sync: (url) => {
      if (url !== loadedSrc) load(url);
    },
    setAsync: (url) => new Promise<void>((resolve) => load(url, resolve)),
    dispose: () => gl.deleteTexture(tex),
  };
}

/** Create a Career Hero renderer on a canvas, or null if WebGL2 is unavailable. */
export function createCareerGL(canvas: HTMLCanvasElement): CareerGL | null {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const program = buildProgram(gl);
  gl.useProgram(program);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    resolution: u("uResolution"),
    loopT: u("uLoopT"),
    fieldScale: u("uFieldScale"),
    fieldWarp: u("uFieldWarp"),
    fieldDrift: u("uFieldDrift"),
    fieldMorph: u("uFieldMorph"),
    toneRamp: u("uToneRamp"),
    toneBalance: u("uToneBalance"),
    ink: u("uInk"),
    paper: u("uPaper"),
    lineStrength: u("uLineStrength"),
    linePeriodPx: u("uLinePeriodPx"),
    lineAngle: u("uLineAngle"),
    lineRough: u("uLineRough"),
    lineBlend: u("uLineBlend"),
    grainAmount: u("uGrainAmount"),
    grainScale: u("uGrainScale"),
    grainPhase: u("uGrainPhase"),
    includeBg: u("uIncludeBg"),
    photo: u("uPhoto"),
    hasPhoto: u("uHasPhoto"),
    photoSize: u("uPhotoSize"),
    photoRipple: u("uPhotoRipple"),
    photoRippleScale: u("uPhotoRippleScale"),
    blobWash: u("uBlobWash"),
    mask: u("uMask"),
    hasMask: u("uHasMask"),
    maskSize: u("uMaskSize"),
    maskStrength: u("uMaskStrength"),
  };

  const photo = createPhotoSlot(gl, 0, loc.photo);
  const mask = createPhotoSlot(gl, 1, loc.mask);

  const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

  const render = (
    params: CareerParams,
    { width, height, canvasWidth, loopProgress, loopTime, includeBg }: CareerRenderOptions,
  ) => {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(loc.resolution, width, height);
    gl.uniform1f(loc.loopT, loopProgress % 1);
    gl.uniform1f(loc.fieldScale, params.fieldScale);
    gl.uniform1f(loc.fieldWarp, params.fieldWarp);
    gl.uniform1f(loc.fieldDrift, params.fieldDrift * params.fieldSpeed);
    gl.uniform1f(loc.fieldMorph, params.fieldMorph * params.fieldSpeed);
    // Higher Contrast slider = narrower smoothstep ramp = harder blacks/whites.
    gl.uniform1f(loc.toneRamp, 1.3 + (0.1 - 1.3) * clamp01(params.contrast));
    gl.uniform1f(loc.toneBalance, params.balance);
    const ink = hexRgb(params.ink);
    const paper = hexRgb(params.paper);
    gl.uniform3f(loc.ink, ink[0], ink[1], ink[2]);
    gl.uniform3f(loc.paper, paper[0], paper[1], paper[2]);
    gl.uniform1f(loc.lineStrength, params.lineStrength);
    // Line spacing is authored in canvas px; scale to backing px so render scale
    // and 2K/4K/8K exports keep the same visual line density.
    gl.uniform1f(loc.linePeriodPx, Math.max(1, params.lineSpacing * (width / Math.max(canvasWidth, 1))));
    gl.uniform1f(loc.lineAngle, params.lineAngle);
    gl.uniform1f(loc.lineRough, params.lineRoughness);
    gl.uniform1f(loc.lineBlend, params.lineBlend);
    gl.uniform1f(loc.grainAmount, params.grainAmount);
    gl.uniform1f(loc.grainScale, params.grainScale);
    // Grain steps at 12fps; each step is uncorrelated noise, so the loop wrap
    // (last step -> step 0) is indistinguishable from any other step.
    gl.uniform1f(loc.grainPhase, params.grainAnimate ? Math.floor(loopTime * 12) * 7.31 : 0);
    gl.uniform1f(loc.includeBg, includeBg ? 1 : 0);

    // Hero photo layer: present only when a texture has actually loaded.
    const hasPhoto = photo.size[0] > 0 && photo.size[1] > 0;
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.photo, 0);
    gl.uniform1f(loc.hasPhoto, hasPhoto ? 1 : 0);
    gl.uniform2f(loc.photoSize, photo.size[0] || 1, photo.size[1] || 1);
    gl.uniform1f(loc.photoRipple, params.photoRipple);
    gl.uniform1f(loc.photoRippleScale, params.photoRippleScale);
    gl.uniform1f(loc.blobWash, clamp01(params.blobWash));

    // Bottom-dissolve mask on unit 1.
    const hasMask = mask.size[0] > 0 && mask.size[1] > 0;
    gl.activeTexture(gl.TEXTURE1);
    gl.uniform1i(loc.mask, 1);
    gl.uniform1f(loc.hasMask, hasMask ? 1 : 0);
    gl.uniform2f(loc.maskSize, mask.size[0] || 1, mask.size[1] || 1);
    gl.uniform1f(loc.maskStrength, clamp01(params.maskStrength));

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    canvas,
    render,
    setImage: (url: string) => photo.sync(url),
    setImageAsync: (url: string) => photo.setAsync(url),
    setMask: (url: string) => mask.sync(url),
    setMaskAsync: (url: string) => mask.setAsync(url),
    dispose: () => {
      photo.dispose();
      mask.dispose();
      gl.deleteProgram(program);
    },
  };
}
