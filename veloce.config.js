/* ==========================================================================
   VELOCE — SITE CONFIG
   Everything you are likely to tweak lives here: brand, copy, colours,
   paint, lighting, camera path and performance budgets.
   ========================================================================== */

export const config = {
  brand: {
    name: 'Veloce',
    tagline: 'For collectors who buy cars as art.',
  },

  /* ---------- UI colours (also exposed to CSS as custom properties) ------ */
  colors: {
    black: '#050506',
    graphite: '#1a1b1e',
    graphiteLight: '#2a2c30',
    text: '#e9e7e2',
    textDim: '#8a8a8f',
    accent: '#c8102e', // the single red accent
  },

  /* ---------- Story (one entry per scroll chapter) ----------------------- */
  story: {
    hero: {
      eyebrow: 'Veloce — Series 01',
      title: "Built for the one road you'll never forget.",
    },
    engine: {
      index: '01',
      label: 'Engine',
      value: 1200,
      unit: 'hp',
      caption: 'Hand-assembled V12. One engineer, one engine, signed.',
    },
    body: {
      index: '02',
      label: 'Body',
      value: 1190,
      unit: 'kg',
      caption: 'Carbon fibre monocoque and body. Nothing added that does not earn its place.',
    },
    edition: {
      index: '03',
      label: 'Edition',
      value: 99,
      unit: 'made',
      caption: 'Only 99 will exist. Price on request.',
    },
    cta: {
      title: 'Seen once. Remembered always.',
      button: 'Request a private viewing',
      confirm: 'Thank you. A Veloce concierge will be in touch personally.',
    },
  },

  /* ---------- 3D scene ---------------------------------------------------- */
  scene: {
    background: '#030304',
    fog: { color: '#030304', near: 9, far: 22 },

    // Paint shifts along the scroll. `at` is scroll progress 0 → 1.
    paint: [
      { at: 0.0, color: '#7a0914', metalness: 0.35, roughness: 0.28 }, // deep red
      { at: 0.5, color: '#3b3e44', metalness: 0.6, roughness: 0.32 }, // graphite
      { at: 1.0, color: '#b8bbc1', metalness: 0.95, roughness: 0.22 }, // silver
    ],
    clearcoat: 1,
    clearcoatRoughness: 0.04,

    // The single overhead strip light.
    stripLight: {
      color: '#ffffff',
      intensity: 3.5,
      length: 6.5,
      width: 0.14,
      height: 3.6,
    },
    ambient: 0.35,
    exposure: 1.15,
    tailLightColor: '#ff1a2e',

    floor: {
      reflectionTint: '#3a3a3a', // darker = blacker mirror
      fadeRadius: 9,
    },

    /* Camera path, keyed on scroll progress (0 → 1).
       polar   degrees from straight up (90 = floor level, 0 = top-down)
       radius  distance from the car
       lookY   height of the point the camera aims at
       frameX / frameY  where the car sits on screen, in world units
                        (+x = right, +y = up) — keeps it clear of the copy
       Azimuth always sweeps a full 360° over the scroll. */
    camera: {
      fov: 32,
      startAzimuth: 32, // 0 = dead in front of the car, 32 = front three-quarter
      keys: [
        { at: 0.0, polar: 86, radius: 8.6, lookY: 0.5, frameX: 1.0, frameY: 0.7 }, // hero
        { at: 0.28, polar: 83, radius: 9.6, lookY: 0.45, frameX: 1.6, frameY: 0.25 }, // engine
        { at: 0.5, polar: 75, radius: 9.8, lookY: 0.4, frameX: -1.6, frameY: 0.25 }, // body
        { at: 0.72, polar: 64, radius: 9.8, lookY: 0.35, frameX: 1.6, frameY: 0.25 }, // edition
        { at: 1.0, polar: 2, radius: 11.5, lookY: 0.0, frameX: 0, frameY: 1.3 }, // top view
      ],
      mobileFrameY: 0.9, // phones: car sits high, copy sits low
      mouseLean: { x: 0.45, y: 0.25, damping: 0.06 },
    },
  },

  /* ---------- Performance ------------------------------------------------- */
  performance: {
    maxPixelRatio: 1.75,
    maxPixelRatioMobile: 1.5,
    reflectionScale: 0.5, // mirror floor resolution relative to screen
    reflectionScaleMobile: 0.35,
    antialias: true,
  },

  /* ---------- Scroll ------------------------------------------------------ */
  scroll: {
    lerp: 0.085, // Lenis smoothing (lower = smoother / slower)
  },
};

export default config;
