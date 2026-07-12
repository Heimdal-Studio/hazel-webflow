// Pure, framework-agnostic WebGL2 hero renderer. Shared by the Toolcraft tool
// (preview + export) and the Webflow runtime in ../dev. Fed a flat HeroParams
// object + a timing/size options object, so it has no Toolcraft or React deps.
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./hero-shader";

export type HeroParams = {
  angle: number;
  easing: string;
  softness: number;
  blur: number;
  revealDuration: number; // seconds for the reveal (act 1 bloom) to sweep in
  zoomFrom: number; // background scale at the start of the reveal (top-left anchored)
  zoomTo: number; // settled background scale after zoomDuration
  zoomDuration: number; // seconds the reveal zoom takes (independent of the sweep)
  motion: boolean;
  waveAmp: number;
  noiseScale: number;
  waveSpeed: number;
  flowAmp: number; // flow-field fold-warp strength (cusps)
  flowScale: number; // flow-field spatial scale (lower = bigger folds)
  flowSpeed: number; // flow cycles per loop (0 = frozen)
  flowDrift: number; // advection travel (uv units) per flow cycle
  grainAmount: number;
  grainScale: number;
  grainAnimate: boolean;
  vignette: number;
  background: string; // hex
  includeBg: boolean; // false = transparent background
  loopDurationSeconds: number;
};

export const DEFAULT_HERO_PARAMS: HeroParams = {
  angle: 135,
  easing: "easeOutCubic",
  softness: 0.17,
  blur: 16,
  revealDuration: 2.5,
  zoomFrom: 0.5,
  zoomTo: 1,
  zoomDuration: 3,
  motion: true,
  waveAmp: 0.02,
  noiseScale: 2.4,
  waveSpeed: 0.2,
  flowAmp: 0.12,
  flowScale: 0.5,
  flowSpeed: 0.2,
  flowDrift: 0.4,
  grainAmount: 0.03,
  grainScale: 0.5,
  grainAnimate: false,
  vignette: 0,
  background: "#FFFDFA",
  includeBg: true,
  loopDurationSeconds: 9,
};

export type HeroRenderOptions = {
  width: number;
  height: number;
  loopProgress: number; // 0..1 position in the loop
  loopTime: number; // seconds into the loop (for grain animation)
  includeBg: boolean;
};

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
function ease(t: number, kind: string): number {
  if (kind === "linear") return t;
  if (kind === "easeIn") return t * t * t;
  if (kind === "easeOutCubic") return easeOutCubic(t);
  return easeInOutCubic(t);
}
export function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.929, 0.906, 0.863]; // cream fallback
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
    throw new Error(`Hero shader compile failed: ${log}`);
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
    throw new Error(`Hero program link failed: ${log}`);
  }
  return program;
}

// A texture slot bound to a fixed unit, with async/sync image loading.
type TextureSlot = {
  size: [number, number];
  sync: (url: string) => void;
  setAsync: (url: string) => Promise<void>;
  dispose: () => void;
};
function makeSlot(
  gl: WebGL2RenderingContext,
  unit: number,
  samplerLoc: WebGLUniformLocation | null,
): TextureSlot {
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
    img.crossOrigin = "anonymous"; // required for cross-origin textures (Vercel/Blob CORS)
    img.onload = () => {
      if (loadedSrc === url) upload(img);
      done?.();
    };
    img.onerror = () => done?.();
    img.src = url;
  };
  const sync = (url: string) => {
    if (url === loadedSrc) return;
    load(url);
  };
  const setAsync = (url: string) => new Promise<void>((resolve) => load(url, resolve));
  return { size, sync, setAsync, dispose: () => gl.deleteTexture(tex) };
}

/** Normalized texture-space rect (0..1, origin bottom-left) that the canvas viewport
 *  samples from the source, mirroring getCoverUv + the top-left reveal zoom in
 *  hero-shader.ts. Everything outside this rect is cropped off-canvas. Drives the
 *  tool's live "crop bounds" overlay. */
export type HeroCropWindow = { x0: number; x1: number; yBot: number; yTop: number };

export function heroCropWindow(
  imgW: number,
  imgH: number,
  resW: number,
  resH: number,
  zoom: number,
): HeroCropWindow {
  const z = zoom > 0 ? zoom : 1;
  const ratioX = Math.min(resW / resH / (imgW / imgH), 1);
  const ratioY = Math.min(resH / resW / (imgH / imgW), 1);
  const offX = (1 - ratioX) / 2;
  const offY = (1 - ratioY) / 2;
  return {
    x0: offX, // canvas uv.x = 0
    x1: ratioX / z + offX, // canvas uv.x = 1
    yBot: (1 - 1 / z) * ratioY + offY, // canvas uv.y = 0
    yTop: ratioY + offY, // canvas uv.y = 1
  };
}

export type HeroGL = {
  canvas: HTMLCanvasElement;
  setImage: (url: string) => void;
  setImageAsync: (url: string) => Promise<void>;
  render: (params: HeroParams, options: HeroRenderOptions) => void;
  /** Current crop rect for the given render resolution, or null if no image loaded. */
  cropWindow: (resW: number, resH: number) => HeroCropWindow | null;
  dispose: () => void;
};

/** Create a hero renderer on a canvas, or null if WebGL2 is unavailable. */
// preserveDrawingBuffer defaults true for the tool's export flow (toBlob /
// captureStream read the canvas); the Webflow runtime passes false — Safari
// pays a real compositing cost for a persistent back buffer.
export function createHeroGL(
  canvas: HTMLCanvasElement,
  { preserveDrawingBuffer = true }: { preserveDrawingBuffer?: boolean } = {},
): HeroGL | null {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    preserveDrawingBuffer,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const program = buildProgram(gl);
  gl.useProgram(program);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    resolution: u("uResolution"),
    imageSize: u("uImageSize"),
    hasImage: u("uHasImage"),
    progress: u("uProgress"),
    angle: u("uAngle"),
    softness: u("uSoftness"),
    dissolveBlur: u("uDissolveBlur"),
    zoomAmt: u("uZoomAmt"),
    flowAmp: u("uFlowAmp"),
    flowScale: u("uFlowScale"),
    flowT: u("uFlowT"),
    warpT: u("uWarpT"),
    flowDrift: u("uFlowDrift"),
    waveAmp: u("uWaveAmp"),
    waveScale: u("uWaveScale"),
    wavePhase: u("uWavePhase"),
    grainAmount: u("uGrainAmount"),
    grainScale: u("uGrainScale"),
    grainPhase: u("uGrainPhase"),
    vignette: u("uVignette"),
    bgColor: u("uBgColor"),
    includeBg: u("uIncludeBg"),
  };
  const source = makeSlot(gl, 0, u("uTexture"));
  let lastZoom = 1; // last zoomAmt pushed to the shader, for cropWindow()

  const render = (params: HeroParams, { width, height, loopProgress, loopTime, includeBg }: HeroRenderOptions) => {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const dur = Math.max(0.1, params.loopDurationSeconds || 9);
    const revealFrac = clamp(params.revealDuration / dur, 0.02, 1);
    const revealProg = ease(clamp(loopProgress / revealFrac, 0, 1), params.easing);
    const zoomFrac = clamp((params.zoomDuration || params.revealDuration) / dur, 0.02, 1);
    const zoomProg = ease(clamp(loopProgress / zoomFrac, 0, 1), params.easing);

    gl.uniform2f(loc.resolution, width, height);
    gl.uniform2f(loc.imageSize, source.size[0], source.size[1]);
    gl.uniform1f(loc.hasImage, source.size[0] > 0 ? 1 : 0);
    gl.uniform1f(loc.progress, revealProg);
    gl.uniform1f(loc.angle, params.angle);
    gl.uniform1f(loc.softness, params.softness);
    gl.uniform1f(loc.dissolveBlur, params.blur);
    // Reveal zoom runs on its own duration so the scale can settle after the sweep.
    const zoomFrom = params.zoomFrom > 0 ? params.zoomFrom : 1;
    const zoomTo = params.zoomTo > 0 ? params.zoomTo : 1;
    lastZoom = zoomFrom + (zoomTo - zoomFrom) * zoomProg;
    gl.uniform1f(loc.zoomAmt, lastZoom);
    gl.uniform1f(loc.flowAmp, params.flowAmp);
    gl.uniform1f(loc.flowScale, params.flowScale);
    // Perpetual, seamless flow: the sawtooth is computed here in float64 (a raw float32
    // time uniform would jitter after hours of monotonic runtime). Wraps on whole CYCLES
    // so any speed stays smooth in the continuous Webflow runtime; integer speeds also
    // loop cleanly in the tool. loopTime is monotonic in the runtime, cyclic in the tool.
    const flowCycles = (loopTime / dur) * Math.max(0, params.flowSpeed);
    gl.uniform1f(loc.flowT, flowCycles % 1);
    gl.uniform1f(loc.warpT, (flowCycles / 3) % 1);
    gl.uniform1f(loc.flowDrift, params.flowDrift);
    gl.uniform1f(loc.waveAmp, params.waveAmp);
    gl.uniform1f(loc.waveScale, params.noiseScale);
    gl.uniform1f(loc.wavePhase, params.motion ? loopProgress * Math.PI * 2 * params.waveSpeed : 0);
    gl.uniform1f(loc.grainAmount, params.grainAmount);
    gl.uniform1f(loc.grainScale, params.grainScale);
    gl.uniform1f(loc.grainPhase, params.grainAnimate ? loopTime * 60 : 0);
    gl.uniform1f(loc.vignette, params.vignette);
    const [r, g, b] = hexRgb(params.background);
    gl.uniform3f(loc.bgColor, r, g, b);
    gl.uniform1f(loc.includeBg, includeBg ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    canvas,
    setImage: source.sync,
    setImageAsync: source.setAsync,
    render,
    cropWindow: (resW: number, resH: number) =>
      source.size[0] > 0 ? heroCropWindow(source.size[0], source.size[1], resW, resH, lastZoom) : null,
    dispose: () => {
      source.dispose();
      gl.deleteProgram(program);
    },
  };
}
