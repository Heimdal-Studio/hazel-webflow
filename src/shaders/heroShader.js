import * as THREE from 'three'
import gsap from 'gsap'

// =============================================
// HELPERS
// =============================================

const lerp = (start, end, t) => start * (1 - t) + end * t

const calcFov = (cameraZ, sectionHeight) =>
  2 * Math.atan(sectionHeight / 2 / cameraZ) * (180 / Math.PI)

const debounce = (fn, ms = 300) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// =============================================
// VERTEX SHADER
// =============================================

const vertexShader = /* glsl */ `
  float PI = 3.141592653589793;

  uniform float uTime;
  uniform vec2 uTextureSize;
  uniform vec2 uQuadSize;

  out vec2 vUv;
  out vec2 vUvCover;

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

  void main() {
    vUv = uv;
    vUvCover = getCoverUv(uv, uTextureSize, uQuadSize);

    // Two overlapping sine waves — slow organic ambient motion
    float wave = sin(uv.x * PI) * sin(uTime * 0.4) * 0.015
               + sin(uv.x * PI * 2.0 + 1.5) * sin(uTime * 0.25) * 0.006;

    vec3 deformedPos = position;
    deformedPos.y -= wave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(deformedPos, 1.0);
  }
`

// =============================================
// FRAGMENT SHADER
// =============================================

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform sampler2D uTexture;
  uniform vec2 uTextureSize;
  uniform vec2 uQuadSize;
  uniform float uMouseEnter;
  uniform vec2 uMouseOverPos;

  in vec2 vUv;
  in vec2 vUvCover;

  out vec4 outColor;

  // Simplex noise — Ashima Arts (MIT)
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

  void main() {
    vec2 texCoords = vUvCover;

    // Ambient UV drift — slow noise field moving over time
    texCoords.x += snoise(vec2(vUv.x * 3.0 + uTime * 0.15, vUv.y * 2.0)) * 0.003;
    texCoords.y += snoise(vec2(vUv.x * 2.0, vUv.y * 3.0 + uTime * 0.1)) * 0.003;

    // Mouse grain + distortion — circular falloff from cursor
    float aspectRatio = uQuadSize.y / uQuadSize.x;
    float circle = 1.0 - distance(
      vec2(uMouseOverPos.x, (1.0 - uMouseOverPos.y) * aspectRatio),
      vec2(vUv.x, vUv.y * aspectRatio)
    ) * 15.0;
    float noise = snoise(gl_FragCoord.xy);
    float mouseEffect = mix(0.0, circle * noise * 0.004, uMouseEnter);
    texCoords.x += mouseEffect;
    texCoords.y += mouseEffect;

    outColor = vec4(vec3(texture(uTexture, texCoords)), 1.0);
  }
`

// =============================================
// INIT
// =============================================

export function initHeroShader() {
  // data-webgl-media on the img is the single entry point — no separate hero attr needed
  const bgImg = document.querySelector('[data-webgl-media]')
  if (!bgImg) return

  const imageUrl = bgImg.currentSrc || bgImg.src
  if (!imageUrl) return

  // Canvas lives in the img's parent wrapper (home-h_bg-w) — inherits its exact size
  const container = bgImg.parentElement

  // Inject canvas into the bg wrapper, behind all siblings
  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;'
  container.prepend(canvas)

  // Dimensions from the container, not the full section
  const getBounds = () => container.getBoundingClientRect()
  const bounds = getBounds()
  const CAMERA_Z = 500

  // Scene + camera
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    calcFov(CAMERA_Z, bounds.height),
    bounds.width / bounds.height,
    10,
    1000
  )
  camera.position.z = CAMERA_Z

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setSize(bounds.width, bounds.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // Geometry + material
  const geometry = new THREE.PlaneGeometry(1, 1, 100, 100)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTexture: { value: null },
      uTextureSize: { value: new THREE.Vector2(100, 100) },
      uQuadSize: { value: new THREE.Vector2(bounds.width, bounds.height) },
      uMouseEnter: { value: 0 },
      uMouseOverPos: { value: new THREE.Vector2(0.5, 0.5) },
    },
    vertexShader,
    fragmentShader,
    glslVersion: THREE.GLSL3,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.scale.set(bounds.width, bounds.height, 1)
  scene.add(mesh)

  // =============================================
  // AUTONOMOUS DRIFT
  // =============================================
  // No mouse input — the distortion spot wanders on its own. Position is driven
  // by slow, incommensurate sine waves (a Lissajous-style path) so the motion
  // feels fluid and never obviously loops. The render loop lerps toward this
  // target for extra inertia.

  const state = {
    mouseEnter: 0,
    mouseOverPos: {
      current: { x: 0.5, y: 0.5 },
      target: { x: 0.5, y: 0.5 },
    },
  }

  // Ease the effect in once on load so it doesn't pop
  gsap.to(state, { mouseEnter: 1, duration: 1.2, ease: 'power2.out' })

  // Slow wandering target — amplitudes keep the spot comfortably in frame
  const driftTarget = (t) => {
    state.mouseOverPos.target.x =
      0.5 + Math.sin(t * 0.3) * 0.18 + Math.sin(t * 0.13 + 1.7) * 0.08
    state.mouseOverPos.target.y =
      0.5 + Math.cos(t * 0.21) * 0.16 + Math.sin(t * 0.07 + 0.5) * 0.07
  }

  // =============================================
  // RESIZE
  // =============================================

  window.addEventListener(
    'resize',
    debounce(() => {
      const b = getBounds()
      camera.aspect = b.width / b.height
      camera.fov = calcFov(CAMERA_Z, b.height)
      camera.updateProjectionMatrix()
      renderer.setSize(b.width, b.height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      mesh.scale.set(b.width, b.height, 1)
      material.uniforms.uQuadSize.value.set(b.width, b.height)
    })
  )

  // =============================================
  // TEXTURE + RENDER LOOP
  // =============================================

  const loader = new THREE.TextureLoader()
  loader.crossOrigin = 'anonymous'

  loader.load(imageUrl, (texture) => {
    material.uniforms.uTexture.value = texture
    material.uniforms.uTextureSize.value.set(
      texture.image.naturalWidth || texture.image.width,
      texture.image.naturalHeight || texture.image.height
    )

    // Hide the original <img> now that WebGL takes over
    bgImg.style.opacity = '0'
    bgImg.style.pointerEvents = 'none'

    let rafId
    const render = (time = 0) => {
      time /= 1000

      driftTarget(time)

      state.mouseOverPos.current.x = lerp(
        state.mouseOverPos.current.x,
        state.mouseOverPos.target.x,
        0.05
      )
      state.mouseOverPos.current.y = lerp(
        state.mouseOverPos.current.y,
        state.mouseOverPos.target.y,
        0.05
      )

      material.uniforms.uTime.value = time
      material.uniforms.uMouseEnter.value = state.mouseEnter
      material.uniforms.uMouseOverPos.value.set(
        state.mouseOverPos.current.x,
        state.mouseOverPos.current.y
      )

      renderer.render(scene, camera)
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)

    // Cleanup on page unload
    window.addEventListener('pagehide', () => {
      cancelAnimationFrame(rafId)
      renderer.dispose()
    }, { once: true })
  })
}
