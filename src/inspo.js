var OdynCode = (() => {
  ;(CustomEase.create('ease-primary', '0.55, 0, 0.7, 0'),
    CustomEase.create('ease-secondary', '0.31,0.75,0.22,1'),
    CustomEase.create('ease-fade', '0.76, 0, 0.24, 1'),
    CustomEase.create('ease-preloader', '0.25, 1, 0.5, 1'),
    CustomEase.create('ease-transition', '0.22, 1, 0.36, 1'),
    CustomEase.create('ease-menu', '.7,0,.22,1'))
  var m = { offset: 375, fast: 0.3, normal: 0.65, slow: 1.075, slower: 1.25, stagger: 0.05 }
  function N() {
    return window.matchMedia('(max-width: 767px)').matches
  }
  function J() {
    return window.matchMedia('(max-width: 991px)').matches
  }
  var De = J(),
    Oe = N()
  function me() {
    ;((De = J()), (Oe = N()))
  }
  var pe = gsap.matchMedia()
  window.pageCleanupFunctions = new Set()
  function ne(e = 2e3) {
    return new Promise((t) => setTimeout(t, e))
  }
  var y, V
  function ae(e) {
    V = e
  }
  function R() {
    if (Webflow.env('editor')) return
    let e = J(),
      n = document.body.getAttribute('data-page-type') === 'horizontal' && !e
    ;(y && y.destroy(),
      (y = new Lenis({ duration: 0.5, orientation: n ? 'horizontal' : 'vertical' })))
    let i = setInterval(() => {
      window.scrollY !== 0 && (window.scrollTo(0, 0), y.scrollTo(0, { immediate: !0, force: !0 }))
    }, 16)
    ;(setTimeout(() => clearInterval(i), 1e3),
      y.scrollTo(0, { immediate: !0, force: !0 }),
      y.on('scroll', ScrollTrigger.update),
      gsap.ticker.add((a) => {
        ;(y?.raf(a * 1e3), V?.raf(a * 1500))
      }),
      gsap.ticker.lagSmoothing(0),
      document.querySelector('#to-top').addEventListener('click', () => {
        y.scrollTo(0, { duration: 1 })
      }),
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener(
          'click',
          (s) => {
            let d = a.getAttribute('href')
            if (d === '#') return
            let l = document.querySelector(d)
            l &&
              (s.preventDefault(),
              s.stopPropagation(),
              y.scrollTo(l, { duration: 1.2, offset: 20 }))
          },
          !0
        )
      }))
  }
  var We = {
    lines: { duration: m.slow, stagger: 0.03 },
    words: { duration: 0.6, stagger: 0.06 },
    chars: { duration: 0.4, stagger: 0.01 },
  }
  function re(e) {
    if (!e) return null
    if (e._splitInstance) return { instance: e._splitInstance, type: e._splitType }
    gsap.set(e, { autoAlpha: 1 })
    let t = e.dataset.splitReveal || 'lines',
      n =
        t === 'lines'
          ? ['lines']
          : t === 'words'
            ? ['lines', 'words']
            : ['lines', 'words', 'chars'],
      o = SplitText.create(e, {
        type: n.join(', '),
        autoSplit: !0,
        mask: 'lines',
        linesClass: 'line',
        wordsClass: 'word',
        charsClass: 'letter',
      })
    return ((e._splitInstance = o), (e._splitType = t), { instance: o, type: t })
  }
  function ie(e, t) {
    if (!e || !t) return
    let n = e[t]
    n && gsap.set(n, { yPercent: 150, opacity: 0 })
  }
  function $e(e, t, n) {
    let o = e[t],
      i = We[t],
      a = { yPercent: 150, opacity: 0 },
      s = {
        yPercent: 0,
        opacity: 1,
        duration: i.duration,
        stagger: i.stagger,
        ease: 'ease-transition',
        immediateRender: !1,
      },
      { scrollTrigger: d, ...l } = n || {},
      u = { ...s, ...l }
    return (d && (u.scrollTrigger = d), gsap.fromTo(o, a, u))
  }
  function fe() {
    document.querySelectorAll('[data-split="heading"]').forEach((e) => {
      let { instance: t, type: n } = re(e)
      ;(ie(t, n), $e(t, n, { scrollTrigger: { trigger: e, start: 'clamp(top 80%)', once: !0 } }))
    })
  }
  function ge() {
    let e = document.querySelectorAll('[data-split-text]')
    e.length &&
      e.forEach((t) => {
        SplitText.create(t, {
          type: 'lines',
          linesClass: 'lines-split',
          mask: 'lines',
          autoSplit: !0,
          deepSlice: !0,
          ignore: '.no-split',
          onSplit: (n) => (
            (t.textSplit = n),
            t.hasAttribute('data-animate-scroll') ? createScrollAnimation(n.lines, t) : null
          ),
        })
      })
  }
  var he = 'monolog_sound_enabled',
    I = 0.15,
    se = 0.095,
    L = 'https://byhuy.b-cdn.net/soundlib-main',
    x = { enabled: localStorage.getItem(he) !== 'false' }
  function ze(e) {
    ;((x.enabled = e), localStorage.setItem(he, String(e)))
  }
  var ve = {
      hover1: new Howl({ src: [`${L}/tap_01.mp3`], volume: I }),
      hover2: new Howl({ src: [`${L}/tap_02.mp3`], volume: I }),
      hover3: new Howl({ src: [`${L}/tap_03.mp3`], volume: I }),
      hover4: new Howl({ src: [`${L}/tap_04.mp3`], volume: I }),
      hover5: new Howl({ src: [`${L}/tap_05.mp3`], volume: I }),
      select: new Howl({ src: [`${L}/select.mp3`], volume: I }),
    },
    ye = ['hover1', 'hover2', 'hover3', 'hover4', 'hover5'],
    E = new Howl({ src: [`${L}/bgm.mp3`], volume: se, loop: !0, autoplay: !1, html5: !0 })
  function le(e = !1) {
    E.playing() && (e ? (E.fade(se, 0, 600), E.once('fade', () => E.pause())) : E.pause())
  }
  function ee() {
    x.enabled && (ce(), E.volume(se), E.playing() || E.play())
  }
  var Lt = { leave: () => le(!0), enter: () => ee() }
  function ce() {
    Howler.ctx && Howler.ctx.state === 'suspended' && Howler.ctx.resume()
  }
  function Ge() {
    if (!x.enabled) return
    ce()
    let e = ye[Math.floor(Math.random() * ye.length)]
    ve[e].play()
  }
  function Ue() {
    x.enabled && (ce(), ve.select.play())
  }
  function Ne() {
    let e = document.querySelector('.navbar_left_sound_btn'),
      t = document.querySelectorAll('.navbar_path_curve'),
      n = document.querySelectorAll('.navbar_path_cross')
    if (!e || !t.length || !n.length) return
    let o = [...t].map((r) => r.getTotalLength() + 1),
      i = [...n].map((r) => r.getTotalLength() + 1)
    function a(r, c, f) {
      r.forEach((v, S) => {
        gsap.set(v, {
          strokeDasharray: c[S],
          strokeDashoffset: f ? c[S] : 0,
          opacity: f ? 0 : 1,
          filter: f ? 'blur(1px)' : 'blur(0px)',
        })
      })
    }
    ;(a([...t], o, !x.enabled), a([...n], i, x.enabled))
    let s = 0.2,
      d = 0.2
    function l() {
      let r = gsap.timeline()
      ;(r.to([...t], {
        strokeDashoffset: (c) => o[c],
        opacity: 0,
        filter: 'blur(1px)',
        duration: s,
        ease: 'ease-secondary',
        stagger: { each: m.stagger, from: 'start' },
      }),
        r.to(
          [...n],
          {
            strokeDashoffset: 0,
            opacity: 1,
            filter: 'blur(0px)',
            duration: m.fast,
            ease: 'ease-secondary',
            stagger: { each: m.stagger, from: 'start' },
          },
          `-=${d}`
        ))
    }
    function u() {
      let r = gsap.timeline()
      ;(r.to([...n], {
        strokeDashoffset: (c) => i[c],
        opacity: 0,
        filter: 'blur(1px)',
        duration: s,
        ease: 'ease-secondary',
        stagger: { each: m.stagger, from: 'start' },
      }),
        r.to(
          [...t],
          {
            strokeDashoffset: 0,
            opacity: 1,
            filter: 'blur(0px)',
            duration: m.fast,
            ease: 'ease-secondary',
            stagger: { each: m.stagger, from: 'start' },
          },
          `-=${d}`
        ))
    }
    e.addEventListener('click', () => {
      ;(ze(!x.enabled),
        e.setAttribute('aria-pressed', String(x.enabled)),
        e.setAttribute('aria-label', x.enabled ? 'Mute sound effects' : 'Enable sound effects'),
        x.enabled ? (u(), ee()) : (l(), le(!0)))
    })
  }
  function Ve() {
    let e = () => {
      ;(ee(),
        document.removeEventListener('click', e, !0),
        document.removeEventListener('keydown', e, !0))
    }
    ;(document.addEventListener('click', e, !0), document.addEventListener('keydown', e, !0))
  }
  function Ye() {
    ;(document.addEventListener(
      'mouseenter',
      (e) => {
        let t = e.target
        t instanceof Element && t.matches('button, a') && Ge()
      },
      !0
    ),
      document.addEventListener(
        'click',
        (e) => {
          e.target.closest?.('button, a') && Ue()
        },
        !0
      ))
  }
  function je() {
    let e = document.title,
      t = null
    function n() {
      let i = ['', '.', '..', '...'],
        a = 0
      t = setInterval(() => {
        ;((document.title = `On hold${i[a]}`), (a = (a + 1) % i.length))
      }, 400)
    }
    function o() {
      ;(clearInterval(t), (t = null))
    }
    document.addEventListener('visibilitychange', () => {
      document.hidden ? (le(!0), n()) : (ee(), o(), (document.title = e))
    })
  }
  function Se() {
    ;(Ne(), Ye(), Ve(), je())
  }
  function Ke() {
    let e,
      t = N()
    window.addEventListener('resize', () => {
      ;(clearTimeout(e),
        (e = setTimeout(() => {
          me()
          let n = N()
          t !== n && ((t = n), R(), ScrollTrigger.refresh())
        }, 150)))
    })
  }
  function Ze() {
    let e = document.querySelectorAll('[data-count-group]')
    e.length &&
      e.forEach((t) => {
        let n = t.dataset.countGroup,
          o = t.querySelectorAll('[data-count-item]').length,
          i = document.querySelectorAll(`[data-count-display="${n}"]`)
        i.length && i.forEach((a) => (a.textContent = o))
      })
  }
  function Qe() {
    let e = new Date().getFullYear()
    document.querySelectorAll('[data-footer-year]').forEach((a) => {
      a.textContent = e
    })
    let t = 'Asia/Ho_Chi_Minh'
    function n() {
      return new Date(new Date().toLocaleString('en-US', { timeZone: t }))
    }
    function o() {
      let a = document.querySelectorAll('[data-footer-date]')
      if (!a.length) return
      let s = n(),
        d = s.toLocaleDateString('en-US', { weekday: 'long', timeZone: t }),
        l = s.toLocaleDateString('en-US', { month: 'short', timeZone: t }),
        u = s.getDate(),
        r = s.getFullYear(),
        c = `${d}, ${l} ${u}, ${r} (GMT +07)`
      a.forEach((f) => {
        f.textContent = c
      })
    }
    function i() {
      let a = document.querySelectorAll('[data-footer-time]')
      if (!a.length) return
      let d = new Date().toLocaleTimeString('en-US', {
          hour12: !0,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh',
        }),
        l = d.match(/AM|PM/)?.[0] ?? '',
        u = d.replace(/[\s\u202f]*(AM|PM)/, '').trim(),
        [r, c, f] = u.split(':')
      a.forEach((v) => {
        v.innerHTML = `${r}<span class="blinking-colon">:</span>${c}<span class="blinking-colon">:</span>${f}<span class="footer_time_period">${l}</span>`
      })
    }
    ;(o(),
      i(),
      setInterval(() => {
        ;(o(), i())
      }, 1e3))
  }
  function Je() {
    let e = document.querySelector('.navbar_wrap'),
      t = document.querySelector('.footer_wrap_main')
    !e ||
      !t ||
      ScrollTrigger.create({
        trigger: t,
        start: 'top bottom',
        onEnter: () => {
          gsap.to(e, { opacity: 0, pointerEvents: 'none', duration: 0.4, ease: 'power2.out' })
        },
        onLeaveBack: () => {
          gsap.to(e, { opacity: 1, pointerEvents: 'auto', duration: 0.4, ease: 'power2.out' })
        },
      })
  }
  function be() {
    ;(Se(), Ke(), Ze(), Qe(), Je())
  }
  function we() {
    function e() {
      let i = document.querySelector('[data-nav-bar-height]'),
        a = i ? i.offsetHeight / 2 : 0
      function s() {
        document.querySelectorAll('[data-theme-section]').forEach(function (u) {
          let r = u.getBoundingClientRect(),
            c = r.top,
            f = r.bottom
          if (c <= a && f >= a) {
            let v = u.getAttribute('data-theme-section')
            document.querySelectorAll('[data-theme-nav]').forEach(function (g) {
              g.getAttribute('data-theme-nav') !== v && g.setAttribute('data-theme-nav', v)
            })
            let S = u.getAttribute('data-bg-section')
            document.querySelectorAll('[data-bg-nav]').forEach(function (g) {
              g.getAttribute('data-bg-nav') !== S && g.setAttribute('data-bg-nav', S)
            })
          }
        })
      }
      function d() {
        document.addEventListener('scroll', s)
      }
      ;(s(), d())
    }
    e()
    function t() {
      document.querySelectorAll('[data-footer-parallax]').forEach((i) => {
        let a = i.querySelector('[data-footer-parallax-inner]'),
          s = i.querySelector('[data-footer-parallax-dark]'),
          d = i.querySelector('[data-canvas-container]'),
          l = i.querySelectorAll('[data-canvas-content]')
        if (a || s) {
          let u = gsap.timeline({
            scrollTrigger: {
              trigger: i,
              start: 'clamp(top bottom)',
              end: 'clamp(top top)',
              scrub: !0,
            },
          })
          ;(a && u.from(a, { yPercent: -15, ease: 'linear' }),
            s && u.from(s, { opacity: 0.5, ease: 'linear' }, '<'))
        }
        if (d) {
          let u = i.querySelector('.footer_canvas_bottom'),
            r = gsap.utils.toArray(l),
            c = gsap.timeline({
              scrollTrigger: {
                trigger: u,
                start: 'clamp(top bottom)',
                end: 'clamp(top top)',
                scrub: !0,
              },
            })
          ;(c.from(d, { yPercent: -80, ease: 'linear' }),
            r.forEach((f) => {
              let v = f.dataset.canvasContent === 'left' ? 100 : -100
              c.fromTo(
                f,
                { xPercent: v, opacity: 0 },
                { xPercent: 0, opacity: 1, ease: 'linear' },
                '<'
              )
            }))
        }
      })
    }
    t()
    let n = document.querySelectorAll('[data-scroll-container]')
    if (!n.length) return
    let o = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    pe.add('(min-width: 992px)', () => {
      if (o) return
      let i = document.querySelector('[data-overlay-container]')
      if (i) {
        let a = parseFloat(i.dataset.targetOpacity) || 0.6
        gsap.to('[data-overlay-scroll]', {
          opacity: a,
          scrollTrigger: { trigger: i, start: 'top top', end: 'bottom top', scrub: !0 },
        })
      }
      n.forEach((a) => {
        let s = a.querySelectorAll('[data-translate-hero="true"]')
        if (!s.length) return
        let d = parseFloat(a.dataset.targetTranslate) || 800,
          l = a.dataset.inverseTranslate ? parseFloat(a.dataset.inverseTranslate) : -d,
          r = (a.dataset.direction || 'vertical') === 'horizontal',
          c = a.dataset.start || (r ? 'left right' : 'top top'),
          f = a.dataset.end || (r ? 'right left' : 'bottom top'),
          v = r ? 'x' : 'y'
        s.forEach((S) => {
          let g = {
            trigger: a,
            start: c,
            end: f,
            scrub: !0,
            invalidateOnRefresh: !0,
            immediateRender: !1,
          }
          ;(r && (g.horizontal = !0),
            gsap.fromTo(S, { [v]: l }, { [v]: d, ease: 'none', scrollTrigger: g }))
        })
      })
    })
  }
  var Te = () => {
    document.querySelectorAll('[data-accordion-css-init]').forEach((e) => {
      let t = e.getAttribute('data-accordion-close-siblings') === 'true'
      e.addEventListener('click', (n) => {
        let o = n.target.closest('[data-accordion-toggle]')
        if (!o) return
        let i = o.closest('[data-accordion-status]')
        if (!i) return
        let a = i.getAttribute('data-accordion-status') === 'active'
        ;(i.setAttribute('data-accordion-status', a ? 'not-active' : 'active'),
          t &&
            !a &&
            e.querySelectorAll('[data-accordion-status="active"]').forEach((s) => {
              s !== i && s.setAttribute('data-accordion-status', 'not-active')
            }))
      })
    })
  }
  var A, M, H, Y, xe
  function te() {
    ;(A && A.kill(),
      document.body.removeAttribute('data-lenis-prevent'),
      document.body.classList.remove('overflow-hidden'),
      (A = gsap.timeline({
        defaults: { ease: 'ease-transition' },
        onComplete: () => {
          M.style.pointerEvents = 'none'
        },
      })),
      A.to(H, { yPercent: -100, duration: m.fast })
        .to(Y, { yPercent: -100, scale: 0.95, autoAlpha: 0, duration: m.fast }, '<0.05')
        .to(M, { autoAlpha: 0, duration: m.fast }, '<'))
  }
  function et() {
    ;(A && A.kill(),
      document.body.setAttribute('data-lenis-prevent', 'true'),
      document.body.classList.add('overflow-hidden'),
      (A = gsap.timeline({
        defaults: { ease: 'ease-transition' },
        onStart: () => {
          M.style.pointerEvents = 'auto'
        },
      })),
      A.to(H, { yPercent: 0, duration: m.slow })
        .to(M, { autoAlpha: 1, duration: m.normal }, '<')
        .from(
          xe,
          {
            yPercent: 20,
            autoAlpha: 0,
            duration: m.normal,
            stagger: { each: 0.05, from: 'start' },
          },
          '<0.15'
        )
        .to(Y, { yPercent: 0, scale: 1, autoAlpha: 1, duration: m.normal }, '<0.15'))
  }
  function Ee() {
    let e = document.body,
      t = document.querySelectorAll('[data-menu-btn]')
    if (!t.length) return
    if (
      ((M = document.querySelector('.menu_overlay_close')),
      (H = document.querySelector('.menu_contain')),
      (Y = document.querySelector('.menu_popup_collection')),
      (xe = H?.querySelectorAll('.footer_nav_li')),
      !M || !H || !Y)
    ) {
      console.warn('[menu] Required elements not found \u2014 check your selectors.')
      return
    }
    ;(gsap.set(H, { yPercent: -100, autoAlpha: 1 }),
      gsap.set(Y, { yPercent: -100, scale: 0.95, autoAlpha: 0 }),
      gsap.set(M, { autoAlpha: 0, pointerEvents: 'none' }))
    let n = () => {
        let i = e.dataset.navigationStatus === 'is-open'
        ;((e.dataset.navigationStatus = i ? 'is-closed' : 'is-open'), i ? te() : et())
      },
      o = () => {
        e.dataset.navigationStatus === 'is-open' &&
          ((e.dataset.navigationStatus = 'is-closed'), te())
      }
    ;(t.forEach((i) => i.addEventListener('click', n)),
      document.addEventListener('keydown', (i) => {
        i.key === 'Escape' && o()
      }),
      M.addEventListener('click', o))
  }
  var Ae = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,
    tt = `
  precision highp float;

  uniform float uTime;
  uniform float uAmplitude;
  uniform float uReveal;

  varying vec2 vUv;

  void main() {
    vec2 c = 2.0 * vUv - 1.0;
    float ds = uAmplitude * uReveal;

    c += ds * 0.4 * sin(c.yx + vec2(1.2, 3.4) + uTime);
    c += ds * 0.2 * sin(5.2 * c.yx + vec2(3.5, 0.4) + uTime);
    c += ds * 0.3 * sin(3.5 * c.yx + vec2(1.2, 3.1) + uTime);
    c += ds * 1.6 * sin(0.4 * c.yx + vec2(0.8, 2.4) + uTime);

    float L = length(c);
    float v = 0.0;
    for (int i = 0; i < 4; i++) {
      v = mix(v, float(i) / 3.0, cos(float(i) * L));
    }

    gl_FragColor = vec4(clamp(v, 0.0, 1.0), 0.0, 0.0, 1.0);
  }
`,
    ot = `
  precision highp float;

  uniform sampler2D uFieldTex;
  uniform vec2 uFieldRes;
  uniform vec2 uResolution;
  uniform float uReveal;

  uniform float uPixelSize;
  uniform float uGooeyness;
  uniform float uContrast;
  uniform float uBias;
  uniform int uInvert;
  uniform vec3 uBg;
  uniform vec3 uFg;
  uniform int uTransparentBg;

  // Vertical wave modulation \u2014 adds a scrolling sine wave to the dot bias.
  // Set uWaveAmplitude = 0 to disable.
  uniform float uWaveTime;
  uniform float uWaveFrequency;
  uniform float uWaveAmplitude;

  varying vec2 vUv;

  float lumaToRadius(float luma, float pixelSize, float biasOffset) {
    float v = clamp((luma - 0.5 + uBias + biasOffset) * uContrast + 0.5, 0.0, 1.0);
    if (uInvert == 1) v = 1.0 - v;
    return v * pixelSize * 0.6 + pixelSize * 0.05;
  }

  float smin(float a, float b, float k) {
    if (k <= 0.001) return min(a, b);
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  void main() {
    vec2 pixelCoord = vUv * uResolution;
    vec2 baseCellIndex = floor(pixelCoord / uPixelSize);
    float minDist = 1.0e5;
    float smoothK = uGooeyness * 1.5;

    // R=1 \u2192 3\xD73 neighborhood, checkerboard skip \u2192 5 active cells/fragment.
    const int R = 1;
    for (int dx = -R; dx <= R; dx++) {
      for (int dy = -R; dy <= R; dy++) {
        vec2 cellIndex = baseCellIndex + vec2(float(dx), float(dy));
        if (mod(cellIndex.x + cellIndex.y, 2.0) > 0.5) continue;

        vec2 cellCenter = (cellIndex + 0.5) * uPixelSize;
        vec2 fieldUv    = (cellIndex + 0.5) / uFieldRes;
        float luma      = texture2D(uFieldTex, fieldUv).r;

        float cellY     = cellCenter.y / uResolution.y;
        float wavePhase = cellY * uWaveFrequency * 6.2831853 - uWaveTime;
        float waveBias  = sin(wavePhase) * uWaveAmplitude;

        float dist   = length(pixelCoord - cellCenter);
        float radius = lumaToRadius(luma, uPixelSize, waveBias);
        minDist = smin(minDist, dist - radius, smoothK * uPixelSize);
      }
    }

    float aa    = max(fwidth(minDist), 0.0001);
    float shape = 1.0 - smoothstep(-aa, aa, minDist);

    if (uTransparentBg == 1) {
      gl_FragColor = vec4(uFg * uReveal, shape * uReveal);
    } else {
      vec3 color = mix(uBg, uFg, shape);
      gl_FragColor = vec4(color * uReveal, 1.0);
    }
  }
`
  function Me(e) {
    let t = new THREE.Color(e)
    return new THREE.Vector3(t.r, t.g, t.b)
  }
  var nt = {
    amplitude: 0.8,
    timeSpeed: 0.0045,
    holdAmplitudeMultiplier: 2,
    holdTimeSpeedMultiplier: 1.5,
    lerpSpeed: 0.03,
    autoReveal: !0,
    revealDuration: 2,
    revealDelay: 0.3,
    revealEase: 'ease-secondary',
    pixelSize: 4,
    gooeyness: 0.58,
    contrast: 1.5,
    bias: 0,
    invert: 1,
    bg: '#E8E8E3',
    fg: '#080807',
    transparentBg: 0,
    waveFrequency: 1,
    waveAmplitude: 0,
    waveTimeSpeed: 0,
    maxDpr: 1,
    targetFrameMs: 1e3 / 60,
    interactive: !0,
  }
  function _e(e, t, n = {}) {
    let o = { ...nt, ...n },
      i = new THREE.Scene(),
      a = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      s = new THREE.WebGLRenderer({ canvas: t, alpha: !0 })
    s.setClearColor(0, o.transparentBg ? 0 : 1)
    let d = new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RedFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: !1,
        stencilBuffer: !1,
      }),
      l = new THREE.PlaneGeometry(2, 2),
      u = new THREE.ShaderMaterial({
        vertexShader: Ae,
        fragmentShader: tt,
        uniforms: {
          uTime: { value: 0 },
          uAmplitude: { value: o.amplitude },
          uReveal: { value: 0 },
        },
      }),
      r = new THREE.ShaderMaterial({
        vertexShader: Ae,
        fragmentShader: ot,
        transparent: o.transparentBg === 1,
        uniforms: {
          uFieldTex: { value: d.texture },
          uFieldRes: { value: new THREE.Vector2(1, 1) },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uReveal: { value: 0 },
          uPixelSize: { value: o.pixelSize },
          uGooeyness: { value: o.gooeyness },
          uContrast: { value: o.contrast },
          uBias: { value: o.bias },
          uInvert: { value: o.invert },
          uBg: { value: Me(o.bg) },
          uFg: { value: Me(o.fg) },
          uTransparentBg: { value: o.transparentBg },
          uWaveTime: { value: 0 },
          uWaveFrequency: { value: o.waveFrequency },
          uWaveAmplitude: { value: o.waveAmplitude },
        },
      }),
      c = new THREE.Scene(),
      f = new THREE.Scene(),
      v = new THREE.Mesh(l, u),
      S = new THREE.Mesh(l, r)
    ;(c.add(v), f.add(S))
    let g = { isHolding: !1, currentAmplitude: o.amplitude, currentTimeSpeed: o.timeSpeed },
      _ = { reveal: 0 }
    function j() {
      ;((u.uniforms.uReveal.value = _.reveal), (r.uniforms.uReveal.value = _.reveal))
    }
    function oe() {
      gsap.to(_, {
        reveal: 1,
        duration: o.revealDuration,
        delay: o.revealDelay,
        ease: o.revealEase,
        onUpdate: j,
      })
    }
    function F() {
      g.isHolding = !0
    }
    function q() {
      g.isHolding = !1
    }
    function B() {
      g.isHolding = !0
    }
    function D() {
      g.isHolding = !1
    }
    o.interactive &&
      (t.addEventListener('mousedown', F),
      window.addEventListener('mouseup', q),
      t.addEventListener('touchstart', B, { passive: !0 }),
      window.addEventListener('touchend', D))
    function O() {
      let P = e.clientWidth,
        G = e.clientHeight
      if (P === 0 || G === 0) return
      let X = Math.min(window.devicePixelRatio, o.maxDpr)
      ;(s.setSize(P, G), s.setPixelRatio(X))
      let Z = P * X,
        Q = G * X
      r.uniforms.uResolution.value.set(Z, Q)
      let U = Math.ceil(Z / o.pixelSize) + 1,
        de = Math.ceil(Q / o.pixelSize) + 1
      ;(d.setSize(U, de), r.uniforms.uFieldRes.value.set(U, de))
    }
    let K = new ResizeObserver(O)
    K.observe(e)
    let C = !0,
      k = !1
    function W(P, G) {
      let X = Math.min(G / o.targetFrameMs, 3),
        Z = g.isHolding ? o.amplitude * o.holdAmplitudeMultiplier : o.amplitude,
        Q = g.isHolding ? o.timeSpeed * o.holdTimeSpeedMultiplier : o.timeSpeed,
        U = 1 - Math.pow(1 - o.lerpSpeed, X)
      ;((g.currentAmplitude += (Z - g.currentAmplitude) * U),
        (g.currentTimeSpeed += (Q - g.currentTimeSpeed) * U),
        (u.uniforms.uAmplitude.value = g.currentAmplitude),
        (u.uniforms.uTime.value += g.currentTimeSpeed * X),
        o.waveAmplitude > 0 &&
          o.waveTimeSpeed > 0 &&
          (r.uniforms.uWaveTime.value += o.waveTimeSpeed * X),
        s.setRenderTarget(d),
        s.render(c, a),
        s.setRenderTarget(null),
        s.render(f, a))
    }
    function p() {
      k || (gsap.ticker.add(W), (k = !0))
    }
    function h() {
      k && (gsap.ticker.remove(W), (k = !1))
    }
    let b = new IntersectionObserver(
      ([P]) => {
        ;((C = P.isIntersecting), C ? p() : h())
      },
      { threshold: 0 }
    )
    b.observe(t)
    function T() {
      document.hidden ? h() : C && p()
    }
    document.addEventListener('visibilitychange', T)
    function z() {
      ;(h(),
        K.disconnect(),
        b.disconnect(),
        document.removeEventListener('visibilitychange', T),
        o.interactive &&
          (window.removeEventListener('mouseup', q),
          window.removeEventListener('touchend', D),
          t.removeEventListener('mousedown', F),
          t.removeEventListener('touchstart', B)),
        gsap.killTweensOf(_),
        c.remove(v),
        f.remove(S),
        l.dispose(),
        u.dispose(),
        r.dispose(),
        d.dispose(),
        s.dispose(),
        s.forceContextLoss())
    }
    return (
      O(),
      s.setRenderTarget(d),
      s.render(c, a),
      s.setRenderTarget(null),
      s.render(f, a),
      (t.style.opacity = '1'),
      p(),
      o.autoReveal && oe(),
      window.pageCleanupFunctions && window.pageCleanupFunctions.add(z),
      {
        destroy: z,
        params: o,
        fieldMaterial: u,
        halftoneMaterial: r,
        resize: O,
        revealState: _,
        syncReveal: j,
      }
    )
  }
  var ke = null
  function Xe() {
    return ke
  }
  function Le() {
    let e = document.querySelector('[data-canvas-container]'),
      t = document.querySelector('[data-canvas]')
    e && t
      ? _e(e, t)
      : console.warn('[initShader] Footer elements not found \u2014 skipping footer shader.')
    let n = document.querySelector('[data-hero-canvas-container]'),
      o = document.querySelector('[data-hero-canvas]')
    n &&
      o &&
      (ke = _e(n, o, {
        amplitude: 1.53,
        timeSpeed: 0.0065,
        pixelSize: 3,
        gooeyness: 0,
        contrast: 0.9,
        bias: -0.25,
        invert: 0,
        fg: '#524d47',
        transparentBg: 1,
        waveAmplitude: 0.29,
        waveFrequency: 3.9,
        waveTimeSpeed: 0,
        autoReveal: !1,
        interactive: !1,
      }))
  }
  function qe() {
    let e = document.querySelector('.hero_home_content_p'),
      t
    ;(e && (t = new SplitText(e, { type: 'lines', linesClass: 'split-line', mask: 'lines' })),
      gsap.set('.hero_home_content_svg path', {
        autoAlpha: 0,
        scale: 0.7,
        transformOrigin: 'center center',
      }),
      gsap.set('.hero_home_svg path', { yPercent: 120 }),
      t && gsap.set(t.lines, { yPercent: 110 }))
    let n = Xe(),
      o = gsap.timeline({ defaults: { ease: 'expo.out' } })
    return (
      o
        .set('[data-animate]', { autoAlpha: 1 })
        .to(
          '.hero_home_svg path',
          { scale: 1, autoAlpha: 1, yPercent: 0, duration: m.slow, stagger: 0.065 },
          '<'
        )
        .to(
          '.hero_home_content_svg path',
          { autoAlpha: 1, scale: 1, duration: m.slower, stagger: 0.08 },
          '-=1.2'
        )
        .to(t?.lines || [], { yPercent: 0, duration: m.slow, stagger: 0.05 }, '<')
        .to('.navbar_wrap', { autoAlpha: 1, duration: m.slow }, '<0.3')
        .to('.hero_home_fade', { opacity: 0, duration: m.slow, ease: 'ease-transition' }, '-=0.9')
        .fromTo(
          '.hero_home_img',
          { scale: 1.25 },
          { scale: 1, duration: m.slow, ease: 'ease-transition' },
          '<'
        ),
      n &&
        o.to(
          n.revealState,
          { reveal: 1, duration: 3, ease: 'ease-secondary', onUpdate: n.syncReveal },
          '<'
        ),
      o
    )
  }
  var Ce = 6
  function at(e) {
    let t = e.querySelectorAll('[data-slider-item]')
    return Array.from(t, (n) => ({
      root: n,
      headshot: n.querySelector('[data-slider-headshot]'),
      message: n.querySelector('[data-slider-message]'),
      details: Array.from(n.querySelectorAll('[data-slider-details]')),
      get split() {
        return this.message?.textSplit ?? null
      },
    }))
  }
  function rt(e) {
    let t = at(e),
      n = t.length
    if (!n) return
    let o = e.querySelector('[data-slider-next]'),
      i = e.querySelector('[data-slider-prev]'),
      a = e.querySelector('[data-counter-value]'),
      s = e.querySelector('[data-dynamic-value]'),
      d = e.querySelector('[data-progress-bar-start]'),
      l = e.querySelector('[data-progress-bar-end]'),
      u = 0,
      r = null,
      c = null,
      f = d,
      v = l
    a && (a.textContent = n)
    let S = () => {
        s && (s.textContent = u + 1)
      },
      g = (p) => {
        ;(gsap.set(p.root, { opacity: 0, yPercent: 150 }),
          p.headshot && gsap.set(p.headshot, { opacity: 0, yPercent: 100 }),
          p.details.length && gsap.set(p.details, { opacity: 0 }))
      },
      _ = (p) => {
        ;(gsap.killTweensOf(p.root),
          gsap.killTweensOf(p.headshot),
          p.details.length && gsap.killTweensOf(p.details))
      },
      j = () => t.forEach(g),
      oe = () => {
        ;(gsap.set(d, { xPercent: -100 }), gsap.set(l, { xPercent: -100 }), (f = d), (v = l))
      },
      F = ({ enteringDelay: p, onSwapStart: h }) => {
        let b = f,
          T = v
        ;((f = T),
          (v = b),
          gsap.set(T, { xPercent: -100 }),
          (r = gsap.timeline({ onComplete: () => B() })),
          h && r.add(h, 0),
          r.to(b, { xPercent: 100, duration: 0.5, ease: 'power2.inOut' }, 0),
          r.to(T, { xPercent: 0, duration: Ce, ease: 'none' }, p))
      },
      q = () => {
        ;(r && r.kill(),
          (r = gsap.timeline({ onComplete: () => B() })),
          r.to(f, { xPercent: 0, duration: Ce, ease: 'none' }))
      },
      B = () => {
        r && r.kill()
        let p = (u + 1) % n
        F({ enteringDelay: 0.4, onSwapStart: () => k(p) })
      },
      D = () => {
        r && r.pause()
      },
      O = () => {
        ;(r && (r.kill(), (r = null)), c && (c.kill(), (c = null)))
      },
      K = (p) => {
        if (!p.split)
          return (console.warn('Missing SplitText instance for testimonial:', p.root), null)
        let h = m.fast,
          b = gsap.timeline()
        return (
          b.to(p.split.lines, {
            yPercent: -150,
            opacity: 0,
            stagger: 0.03,
            ease: 'ease-primary',
            duration: h,
          }),
          b.to(
            p.headshot,
            { yPercent: -50, opacity: 0, ease: 'ease-primary', duration: h },
            `-=${h * 1.2}`
          ),
          p.details.length &&
            b.to(
              p.details,
              { yPercent: -150, opacity: 0, ease: 'ease-primary', duration: h, stagger: 0.03 },
              '<'
            ),
          b
        )
      },
      C = (p) => {
        if (!p.split)
          return (console.warn('Missing SplitText instance for testimonial:', p.root), null)
        let h = gsap.timeline()
        return (
          h
            .set(p.root, { opacity: 1, yPercent: 0 })
            .fromTo(
              p.split.lines,
              { yPercent: 150, opacity: 0 },
              { yPercent: 0, opacity: 1, stagger: 0.03, ease: 'ease-transition', duration: m.slow }
            ),
          h.fromTo(
            p.headshot,
            { yPercent: 50, opacity: 0 },
            { yPercent: 0, opacity: 1, ease: 'ease-transition', duration: m.slow },
            '-=1'
          ),
          p.details.length &&
            h.fromTo(
              p.details,
              { yPercent: 150, opacity: 0 },
              { yPercent: 0, opacity: 1, ease: 'ease-transition', duration: m.slow, stagger: 0.03 },
              '<'
            ),
          h
        )
      },
      k = (p) => {
        c && (c.kill(), (c = null))
        let h = t[u],
          b = t[p]
        ;((u = p), S())
        let T = K(h)
        if (!T) return
        let z = T.duration() * 0.6
        ;((c = gsap.timeline({
          onComplete: () => {
            c = null
          },
        })),
          c
            .add(T, 0)
            .call(
              () => {
                ;(_(h), g(h))
              },
              null,
              z
            )
            .add(C(b), z))
      },
      W = (p) => {
        O()
        let h = p === 'next' ? (u + 1) % n : (u - 1 + n) % n
        F({ enteringDelay: 0.2, onSwapStart: () => k(h) })
      }
    ;(o?.addEventListener('click', () => W('next')),
      i?.addEventListener('click', () => W('prev')),
      j(),
      oe(),
      C(t[u]),
      S(),
      q(),
      ScrollTrigger.create({
        trigger: e,
        start: 'top bottom',
        end: 'bottom top',
        onEnter: () => {
          r ? r.resume() : q()
        },
        onEnterBack: () => {
          r ? r.resume() : q()
        },
        onLeave: D,
        onLeaveBack: D,
      }))
  }
  function Pe() {
    document.querySelectorAll('[data-slider]').forEach((e) => rt(e))
  }
  function it() {
    document.querySelectorAll('[data-highlight-text]').forEach((t) => {
      let n = t.getAttribute('data-highlight-scroll-start') || 'top 100%',
        o = t.getAttribute('data-highlight-scroll-end') || 'center 40%',
        i = parseFloat(t.getAttribute('data-highlight-fade')) || 0.2,
        a = parseFloat(t.getAttribute('data-highlight-stagger')) || 0.1,
        s = parseFloat(t.getAttribute('data-highlight-line-stagger')) || 0.3
      new SplitText(t, {
        type: 'lines, words, chars',
        autoSplit: !0,
        onSplit(d) {
          return gsap.context(() => {
            let u = d.lines.map((c) => d.chars.filter((f) => c.contains(f))),
              r = gsap.timeline({ scrollTrigger: { scrub: !0, trigger: t, start: n, end: o } })
            u.forEach((c, f) => {
              r.from(c, { autoAlpha: i, stagger: a, ease: 'linear' }, f * s)
            })
          })
        },
      })
    })
  }
  function st() {
    let e = document.querySelectorAll('.gap_home_image')
    if (!e.length) return
    let t = 0,
      n = !1,
      o
    e.forEach((c, f) => {
      gsap.set(c, { opacity: f === 0 ? 1 : 0 })
    })
    function i() {
      !n ||
        e.length <= 1 ||
        (gsap.set(e[t], { opacity: 0 }), (t = (t + 1) % e.length), gsap.set(e[t], { opacity: 1 }))
    }
    function a() {
      o || ((n = !0), (o = setInterval(i, 800)))
    }
    function s() {
      ;(o && (clearInterval(o), (o = null)), (n = !1))
    }
    e.length > 0 &&
      (ScrollTrigger.create({
        trigger: '.gap_home_wrap',
        start: 'top bottom',
        end: 'bottom top',
        onEnter: a,
        onLeave: s,
        onEnterBack: a,
        onLeaveBack: s,
      }),
      window.pageCleanupFunctions.add(() => s()))
    let d = document.querySelectorAll('.gap_home_inner_heading-contain'),
      l = document.querySelectorAll('.gap_home_inner_heading'),
      u = document.querySelector('.gap_home_cover')
    ;(gsap
      .timeline({
        scrollTrigger: {
          trigger: '.gap_home_wrap',
          start: 'top 50%',
          end: 'bottom top',
          scrub: !0,
        },
      })
      .to(d, { x: '0vw', duration: m.slow, ease: 'ease-transition' })
      .fromTo(
        u,
        { clipPath: 'inset(50% 50% 50% 50% round 0.25rem)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0.25rem)', duration: m.slow, ease: 'ease-transition' },
        '<'
      ),
      l.forEach((c) => {
        let f = c.classList.contains('is-left')
        new SplitText(c, {
          type: 'chars',
          autoSplit: !0,
          onSplit(v) {
            ;(gsap.set(v.chars, {
              display: 'inline-block',
              x: f ? -80 : 80,
              scaleY: 0.95,
              opacity: 0,
            }),
              gsap.to(v.chars, {
                keyframes: { '40%': { opacity: 1 }, '90%': { x: 0, scaleY: 1 }, '100%': {} },
                duration: 1,
                ease: 'expo.out',
                stagger: { each: 0.022, from: f ? 'end' : 'start' },
                scrollTrigger: {
                  trigger: '.gap_home_contain',
                  start: 'top 50%',
                  end: 'bottom top',
                  scrub: 0.5,
                  invalidateOnRefresh: !0,
                },
              }))
          },
        })
      }))
  }
  function lt() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    document.querySelectorAll('[data-hover-highlight]').forEach((n) => {
      ;(n.addEventListener('mouseenter', () => {
        gsap.to(n, {
          backgroundColor: '#fafaf9',
          duration: m.fast,
          ease: 'ease-transition',
          overwrite: !0,
        })
      }),
        n.addEventListener('mouseleave', () => {
          let i =
            n.dataset.hoverHighlight === 'accordion' &&
            n.getAttribute('data-accordion-status') === 'active'
          gsap.to(n, {
            backgroundColor: i ? '#fafaf9' : 'transparent',
            duration: m.normal,
            ease: 'ease-transition',
            overwrite: !0,
          })
        }))
    })
  }
  function ct() {
    let e = document.querySelectorAll('[data-stacking-cards-item]')
    e.length < 2 ||
      gsap.matchMedia().add('(min-width: 992px)', () => {
        e.forEach((t, n) => {
          if (n === 0) return
          let o = e[n - 1]
          o &&
            gsap
              .timeline({
                defaults: { ease: 'none', duration: 1 },
                scrollTrigger: {
                  trigger: t,
                  start: 'top bottom',
                  end: 'top top',
                  scrub: !0,
                  invalidateOnRefresh: !0,
                },
              })
              .fromTo(o, { yPercent: 0, opacity: 1 }, { yPercent: 50, opacity: 0 })
        })
      })
  }
  function ut() {
    let e = document.querySelector('.services_home_wrap'),
      t = document.querySelectorAll('[data-content-trigger]'),
      n = document.querySelectorAll('.services_home_heading'),
      o = document.querySelector('.services_home_img-wrap'),
      i = o.parentElement,
      a = !0
    gsap.fromTo(
      o,
      { yPercent: -50, opacity: 0, filter: 'blur(4px)' },
      {
        yPercent: 0,
        opacity: 1,
        filter: 'blur(0px)',
        ease: 'none',
        scrollTrigger: { trigger: e, start: 'top bottom', end: 'center bottom', scrub: !0 },
      }
    )
    function s(u) {
      let r = i.getBoundingClientRect(),
        c = u.getBoundingClientRect()
      return c.top - r.top + c.height / 2
    }
    function d(u) {
      let r = s(u)
      a
        ? ((a = !1), gsap.set(o, { y: r }))
        : gsap.to(o, { y: r, duration: m.slow, ease: 'ease-transition' })
    }
    function l(u) {
      ;(document.querySelectorAll('[data-content-image]').forEach((r, c) => {
        ;(r.classList.toggle('active', c === u),
          gsap.to(r, { opacity: c === u ? 1 : 0, duration: 0.2, ease: 'ease-fade' }))
      }),
        t.forEach((r, c) => {
          gsap.to(r, { opacity: c === u ? 1 : 0.3, duration: 0.2, ease: 'ease-fade' })
        }))
    }
    ;(l(0),
      d(t[0]),
      t.forEach((u, r) => {
        u.addEventListener('mouseenter', () => {
          ;(l(r), d(u))
        })
      }))
  }
  function dt() {
    let e = document.querySelector('.cta_home_wrap')
    if (!e) return
    ;(gsap
      .timeline({
        scrollTrigger: { trigger: e, start: 'bottom center', end: '90% top', scrub: !0 },
      })
      .to(e, { clipPath: 'inset(0% 1.25% 1.25% 1.25% round 0.35rem)', ease: 'none' }),
      gsap
        .timeline({
          scrollTrigger: { trigger: e, start: 'top bottom', end: 'bottom top', scrub: !0 },
        })
        .to('.cta_heading_inner', { xPercent: 50, ease: 'none' }))
  }
  function mt() {
    gsap.matchMedia().add('(hover: none), (pointer: coarse)', () => {
      let n = gsap.utils
        .toArray('.works_home_item')
        .map((o) =>
          ScrollTrigger.create({
            trigger: o,
            start: 'top 65%',
            end: 'bottom 35%',
            onEnter: () => o.classList.add('is-active'),
            onLeave: () => o.classList.remove('is-active'),
            onEnterBack: () => o.classList.add('is-active'),
            onLeaveBack: () => o.classList.remove('is-active'),
          })
        )
      return () => n.forEach((o) => o.kill())
    })
  }
  function Re() {
    ;(mt(), st(), lt(), ct(), ut(), Pe(), dt(), it())
  }
  function Ie() {
    let e = document.querySelector('[data-cursor]'),
      t = document.querySelector('[data-cursor-text-target]')
    if (!e || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let n = 0,
      o = 0,
      i = !1,
      a = gsap.quickTo(e, 'x', { duration: 0.4, ease: 'power3.out' }),
      s = gsap.quickTo(e, 'y', { duration: 0.4, ease: 'power3.out' })
    function d() {
      let l = document.elementFromPoint(n, o)?.closest('[data-cursor-hover]'),
        u = e.getBoundingClientRect(),
        r = !!l,
        c = u.right >= window.innerWidth
      if ((e.setAttribute('data-cursor', r ? (c ? 'active-edge' : 'active') : ''), l && t)) {
        let f = l.getAttribute('data-cursor-text')
        f && (t.textContent = f)
      }
    }
    ;(window.addEventListener('mousemove', (l) => {
      ;((n = l.clientX), (o = l.clientY), (i = !0), a(n), s(o), requestAnimationFrame(d))
    }),
      window.addEventListener(
        'scroll',
        () => {
          i && requestAnimationFrame(d)
        },
        { passive: !0 }
      ),
      window.addEventListener('mousedown', (l) => {
        l.button === 0 && gsap.to(e, { scale: 0.9, duration: 0.4, ease: 'power2.out' })
      }),
      window.addEventListener('mouseup', (l) => {
        l.button === 0 && gsap.to(e, { scale: 1, duration: 0.3, ease: 'power2.out' })
      }))
  }
  var w
  function ue() {
    ;(w && w.kill(),
      document.body.removeAttribute('data-lenis-prevent'),
      document.body.classList.remove('overflow-hidden'))
    let e = document.querySelector('.about_overlay_close'),
      t = document.querySelector('.about_modal_wrap'),
      n = document.querySelector('.about_modal_overlay'),
      o = document.querySelector('.about_modal_video')
    e.style.pointerEvents = 'none'
    let i = document.querySelector('.page_wrap'),
      a = Array.from(i.children)
    ;((w = gsap.timeline({
      onComplete: () => {
        V && V.scrollTo(0, { immediate: !0, lock: !0, force: !0 })
      },
    })),
      w
        .to(t, { xPercent: 100, duration: m.normal, ease: 'ease-transition' })
        .to(e, { autoAlpha: 0, duration: m.normal, ease: 'ease-transition' }, '<')
        .to(a, { xPercent: 0, duration: m.normal, ease: 'ease-transition' }, '<')
        .set(n, { opacity: 1 })
        .set(o, { scale: 1.05 }, '<'))
  }
  function pt() {
    ;(w && w.kill(),
      document.body.setAttribute('data-lenis-prevent', 'true'),
      document.body.classList.add('overflow-hidden'))
    let e = document.querySelector('.about_overlay_close')
    e.style.pointerEvents = 'auto'
    let t = document.querySelector('.about_modal_wrap'),
      n = t?.querySelector('[data-split="heading"]'),
      o = n ? re(n) : null
    o && ie(o.instance, o.type)
    let i = document.querySelector('.about_modal_overlay'),
      a = document.querySelector('.about_modal_video'),
      s = document.querySelector('.page_wrap'),
      d = Array.from(s.children)
    ;((w = gsap.timeline()),
      w
        .to(t, { xPercent: 0, duration: m.slower, ease: 'ease-transition' })
        .to(e, { autoAlpha: 1, duration: m.slower, ease: 'ease-transition' }, '<')
        .to(d, { xPercent: -5, duration: m.slower, ease: 'ease-transition' }, '<')
        .add(
          o
            ? gsap.to(o.instance[o.type], {
                yPercent: 0,
                opacity: 1,
                duration: m.slower,
                stagger: 0.03,
                ease: 'ease-transition',
                immediateRender: !1,
              })
            : null,
          '-=1.2'
        )
        .to(i, { opacity: 0, duration: m.slow, ease: 'ease-transition' }, '-=1.05')
        .to(a, { scale: 1, duration: m.slow, ease: 'ease-transition' }, '<'))
  }
  function He() {
    let e = document.querySelector('.about_modal_overlay'),
      t = document.querySelector('.about_modal_video'),
      n = document.querySelector('.about_modal_wrap'),
      o = document.querySelector('.about_modal_contain')
    if (!n || !o) return
    let i = new Lenis({ content: o, wrapper: n })
    ;(ae(i),
      gsap.set(e, { opacity: 1 }),
      gsap.set(t, { scale: 1.05 }),
      gsap.set(n, { xPercent: 100, autoAlpha: 1 }))
    let a = document.body
    n.addEventListener('click', (l) => {
      l.target.closest('[data-close-modal]') && ue()
    })
    let s = () => {
        let l = a.dataset.aboutStatus === 'is-open'
        ;((a.dataset.aboutStatus = l ? 'is-closed' : 'is-open'), l ? ue() : pt())
      },
      d = () => {
        a.dataset.aboutStatus === 'is-open' &&
          ((a.dataset.aboutStatus = 'is-closed'),
          ue(),
          document.body.removeAttribute('data-lenis-prevent'),
          document.body.classList.remove('overflow-hidden'))
      }
    ;(document
      .querySelectorAll('[data-close-modal]')
      .forEach((l) => l.addEventListener('click', d)),
      document.querySelectorAll('[data-open-modal]').forEach((l) => l.addEventListener('click', s)),
      document.addEventListener('keydown', (l) => {
        l.key === 'Escape' && d()
      }),
      window.pageCleanupFunctions.add(() => {
        ;(w && (w.kill(), (w = null)),
          i && (i.destroy(), ae(null)),
          (a.dataset.aboutStatus = 'is-closed'))
      }))
  }
  function ft() {
    let e = gsap.timeline()
    return (
      e.set('.transition_screen', { willChange: 'transform' }, 0),
      e.to('.transition_screen', { ease: 'ease-transition', autoAlpha: 1, duration: 0.35 }),
      e.set('.transition_screen', { willChange: 'auto' }),
      e.then()
    )
  }
  function gt() {
    ;(document.body.removeAttribute('data-lenis-prevent'),
      document.body.classList.remove('overflow-hidden'),
      gsap.set('[data-hero-wrap]', { autoAlpha: 1 }))
  }
  function ht(e) {
    let n = new DOMParser().parseFromString(e.next.html, 'text/html'),
      o = $(n).find('html').attr('data-wf-page')
    ;($(n).find('body').is('[data-page-type]')
      ? $('body').attr('data-page-type', $(n).find('body').attr('data-page-type'))
      : $('body').removeAttr('data-page-type'),
      $('html').attr('data-wf-page', o),
      window.Webflow && window.Webflow.destroy(),
      window.Webflow && window.Webflow.ready())
    let a = window.Webflow?.require('ix2')
    ;(typeof a < 'u' && a.init(),
      $('.w--current').removeClass('w--current'),
      $('a').each(function () {
        $(this).attr('href') === window.location.pathname && $(this).addClass('w--current')
      }))
  }
  function vt() {
    typeof ScrollTrigger < 'u' && ScrollTrigger.killAll()
  }
  function Fe() {
    ;(R(), ge(), fe(), be(), we(), Te(), Ie(), Ee(), He(), Le())
  }
  async function yt(e) {
    let t = document.body
    ;(t.dataset.navigationStatus === 'is-open' &&
      ((t.dataset.navigationStatus = 'is-closed'), te()),
      window.pageCleanupFunctions.forEach((n) => {
        try {
          n()
        } catch (o) {
          console.warn('Cleanup error:', o)
        }
      }),
      window.pageCleanupFunctions.clear(),
      document
        .querySelectorAll('[data-navigation-status]')
        .forEach((n) => n.setAttribute('data-navigation-status', 'is-closed')),
      ft(e.current))
  }
  async function St(e) {
    ;(y && y.destroy(), vt(), await ne(350), e.current.container.remove())
  }
  async function bt(e) {
    ;(ScrollTrigger.getAll().forEach((t) => t.kill()), ht(e), R(), ScrollTrigger.refresh(), Fe())
  }
  async function wt() {
    gt()
  }
  async function Tt() {
    ;(window.scrollTo(0, 0),
      y && y.scrollTo(0, { immediate: !0, force: !0, lock: !0, duration: 0.0166 }),
      ScrollTrigger.refresh())
  }
  function Be() {
    ;(barba.init({
      sync: !0,
      preventRunning: !0,
      timeout: 7e3,
      transitions: [
        {
          name: 'default',
          async leave(e) {
            ;(await yt(e), await ne(m.offset), await St(e))
          },
          async beforeEnter(e) {
            await bt(e)
          },
          async enter() {
            await wt()
          },
          async afterEnter() {
            await Tt()
          },
          once(e) {
            ;(R(), ScrollTrigger.refresh(), Fe(), qe())
          },
        },
      ],
      views: [
        {
          namespace: 'home',
          afterEnter() {
            Re()
          },
        },
        {
          namespace: 'works',
          afterEnter() {
            initWorkPage()
          },
        },
        { namespace: 'about', afterEnter() {} },
        { namespace: 'case-study', afterEnter() {} },
        { namespace: 'careers', afterEnter() {} },
        { namespace: 'contact', afterEnter() {} },
        { namespace: 'systems', afterEnter() {} },
      ],
    }),
      (history.scrollRestoration = 'manual'))
  }
  ;('scrollRestoration' in history && (history.scrollRestoration = 'manual'),
    window.scrollTo(0, 0),
    Be())
})()
