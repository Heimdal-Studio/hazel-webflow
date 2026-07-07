// Pure, framework-agnostic WebGL2 Fluid BGs renderer. No textures, no Toolcraft
// or React deps, so a future Webflow runtime can reuse it as-is.
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./fluid-shader";

/** One colored glow: position and radius in vUv units (0..1, y up). */
export type FluidGlow = {
  x: number;
  y: number;
  color: string; // hex
  radius: number; // falloff distance in uv units
  strength: number; // intensity multiplier, 0..2
};

export const MAX_FLUID_GLOWS = 5;

export type FluidParams = {
  fieldScale: number; // flow-field granularity (lower = broader, softer sweeps)
  fieldWarp: number; // how much the flow warps the glow positions
  fieldDrift: number; // noise-space orbit radius per loop (travel)
  fieldMorph: number; // fold-evolution amount per loop (fluidity)
  fieldSpeed: number; // multiplier on drift+morph; grain unaffected
  contrast: number; // 0..1 slider; mapped to the smoothstep ramp width
  balance: number; // shifts glow intensity dark (-) / bright (+)
  glows: readonly FluidGlow[]; // 1..5 user-editable glows
  paper: string; // hex, dark base == background color
  grainAmount: number;
  grainScale: number;
  grainAnimate: boolean;
  includeBg: boolean; // false = base transparent (glows-only export)
  loopDurationSeconds: number;
};

export const DEFAULT_FLUID_PARAMS: FluidParams = {
  fieldScale: 0.5,
  fieldWarp: 0.35,
  fieldDrift: 0.1,
  fieldMorph: 0.35,
  fieldSpeed: 1.0,
  contrast: 0.38,
  balance: -0.28,
  glows: [
    // The classic Hazel staging: warm gold top-left, cool sage right (x kept
    // on-canvas so its handle is grabbable), warm orange bottom-left.
    { x: 0.12, y: 0.82, color: "#7E5F28", radius: 0.85, strength: 1 },
    { x: 0.97, y: 0.52, color: "#767A5E", radius: 0.95, strength: 1 },
    { x: 0.08, y: 0.12, color: "#6E3D10", radius: 0.7, strength: 1 },
  ],
  paper: "#191307", // dark base behind the glows == export background
  grainAmount: 0.01,
  grainScale: 1.0,
  grainAnimate: true,
  includeBg: true,
  loopDurationSeconds: 30,
};

export type FluidRenderOptions = {
  width: number; // backing pixels
  height: number;
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
    throw new Error(`Fluid shader compile failed: ${log}`);
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
    throw new Error(`Fluid program link failed: ${log}`);
  }
  return program;
}

export type FluidGL = {
  canvas: HTMLCanvasElement;
  render: (params: FluidParams, options: FluidRenderOptions) => void;
  dispose: () => void;
};

/** Create a Fluid BGs renderer on a canvas, or null if WebGL2 is unavailable. */
export function createFluidGL(canvas: HTMLCanvasElement): FluidGL | null {
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
    glowPos: u("uGlowPos"),
    glowColor: u("uGlowColor"),
    glowRadius: u("uGlowRadius"),
    glowStrength: u("uGlowStrength"),
    glowCount: u("uGlowCount"),
    paper: u("uPaper"),
    grainAmount: u("uGrainAmount"),
    grainScale: u("uGrainScale"),
    grainPhase: u("uGrainPhase"),
    includeBg: u("uIncludeBg"),
  };

  const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

  // Scratch arrays reused every frame for the glow uniform upload.
  const glowPos = new Float32Array(MAX_FLUID_GLOWS * 2);
  const glowColor = new Float32Array(MAX_FLUID_GLOWS * 3);
  const glowRadius = new Float32Array(MAX_FLUID_GLOWS);
  const glowStrength = new Float32Array(MAX_FLUID_GLOWS);

  const render = (
    params: FluidParams,
    { width, height, loopProgress, loopTime, includeBg }: FluidRenderOptions,
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
    // Higher Contrast slider = narrower smoothstep ramp = harder light/dark.
    gl.uniform1f(loc.toneRamp, 1.3 + (0.1 - 1.3) * clamp01(params.contrast));
    gl.uniform1f(loc.toneBalance, params.balance);
    const glows = params.glows.length >= 1 ? params.glows : DEFAULT_FLUID_PARAMS.glows;
    const glowCount = Math.min(glows.length, MAX_FLUID_GLOWS);
    for (let i = 0; i < glowCount; i++) {
      const glow = glows[i];
      const [r, g, b] = hexRgb(glow.color);
      glowPos[i * 2] = glow.x;
      glowPos[i * 2 + 1] = glow.y;
      glowColor[i * 3] = r;
      glowColor[i * 3 + 1] = g;
      glowColor[i * 3 + 2] = b;
      glowRadius[i] = glow.radius;
      glowStrength[i] = glow.strength;
    }
    gl.uniform2fv(loc.glowPos, glowPos);
    gl.uniform3fv(loc.glowColor, glowColor);
    gl.uniform1fv(loc.glowRadius, glowRadius);
    gl.uniform1fv(loc.glowStrength, glowStrength);
    gl.uniform1i(loc.glowCount, glowCount);
    const paper = hexRgb(params.paper);
    gl.uniform3f(loc.paper, paper[0], paper[1], paper[2]);
    gl.uniform1f(loc.grainAmount, params.grainAmount);
    gl.uniform1f(loc.grainScale, params.grainScale);
    // Grain steps at 12fps; each step is uncorrelated noise, so the loop wrap
    // (last step -> step 0) is indistinguishable from any other step.
    gl.uniform1f(loc.grainPhase, params.grainAnimate ? Math.floor(loopTime * 12) * 7.31 : 0);
    gl.uniform1f(loc.includeBg, includeBg ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    canvas,
    render,
    dispose: () => gl.deleteProgram(program),
  };
}
