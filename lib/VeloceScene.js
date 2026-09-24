import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { buildCar } from './buildCar';

const { clamp, lerp, degToRad, smoothstep } = THREE.MathUtils;

/* Radial gradient on a canvas → used for the floor fade and contact shadow. */
function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/* Interpolate a keyframe list [{at, ...numbers}] with eased segments. */
function sampleKeys(keys, t, prop) {
  if (t <= keys[0].at) return keys[0][prop];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.at) {
      const k = smoothstep(t, a.at, b.at);
      return lerp(a[prop], b[prop], k);
    }
  }
  return keys[keys.length - 1][prop];
}

export class VeloceScene {
  constructor(canvas, config) {
    this.cfg = config;
    this.scfg = config.scene;
    this.canvas = canvas;
    this.isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.progress = 0;
    this.targetProgress = 0;
    this.mouse = new THREE.Vector2();
    this.mouseTarget = new THREE.Vector2();
    this.needsRender = true;

    const perf = config.performance;
    this.maxDpr = this.isMobile ? perf.maxPixelRatioMobile : perf.maxPixelRatio;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.frameTimes = [];

    this._initRenderer();
    this._initScene();
    this.resize(true);
  }

  _initRenderer() {
    const r = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.cfg.performance.antialias && !this.isMobile,
      powerPreference: 'high-performance',
      alpha: false,
    });
    r.setPixelRatio(this.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = this.scfg.exposure ?? 1;
    r.setClearColor(this.scfg.background, 1);
    this.renderer = r;
  }

  /* A tiny studio used only to bake reflections: black box, one hot strip. */
  _buildEnvironment() {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#000000');
    const sl = this.scfg.stripLight;
    const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color(sl.color).multiplyScalar(5) });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(sl.length, 0.05, sl.width * 2.5), hot);
    strip.position.y = sl.height;
    env.add(strip);

    // Very faint side panels so the flanks read against the black
    const soft = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(0.4), side: THREE.DoubleSide });
    [-1, 1].forEach((s) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), soft);
      p.position.set(0, 2.2, s * 6);
      env.add(p);
    });
    // A low, warm-ish kicker in front to give the nose a highlight
    const kick = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 0.6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(0.25), side: THREE.DoubleSide })
    );
    kick.position.set(7, 0.8, 0);
    kick.rotation.y = Math.PI / 2;
    env.add(kick);

    // Faint bounce from the floor so the lower flanks don't vanish
    const bounce = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(0.04) })
    );
    bounce.rotation.x = -Math.PI / 2;
    bounce.position.y = -0.2;
    env.add(bounce);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(env, 0.02);
    pmrem.dispose();
    env.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.envRT = rt;
    return rt.texture;
  }

  _initScene() {
    const s = this.scfg;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(s.background);
    scene.fog = new THREE.Fog(s.fog.color, s.fog.near, s.fog.far);
    scene.environment = this._buildEnvironment();
    scene.environmentIntensity = 1;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(s.camera.fov, 1, 0.1, 60);
    this.lookAt = new THREE.Vector3(0, 0.5, 0);
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._topUp = new THREE.Vector3(0, 0, -1); // screen-up in the final top view

    // ---- Lights: one overhead strip + a whisper of ambient
    RectAreaLightUniformsLib.init();
    const sl = s.stripLight;
    const rect = new THREE.RectAreaLight(sl.color, sl.intensity, sl.length, sl.width * 3);
    rect.position.set(0, sl.height, 0);
    rect.rotation.x = -Math.PI / 2;
    scene.add(rect);
    scene.add(new THREE.HemisphereLight('#9aa0aa', '#2a2a2e', s.ambient));

    // Visible strip (core + soft halo)
    this.stripMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(sl.color).multiplyScalar(6),
      transparent: true,
      fog: false,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(sl.length, 0.03, sl.width), this.stripMat);
    strip.position.y = sl.height;
    scene.add(strip);
    this.haloMat = new THREE.MeshBasicMaterial({
      color: sl.color,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const halo = new THREE.Mesh(new THREE.BoxGeometry(sl.length + 0.3, 0.25, sl.width * 6), this.haloMat);
    halo.position.y = sl.height;
    scene.add(halo);

    // ---- Car
    const { car, paint } = buildCar(s);
    this.car = car;
    this.paint = paint;
    scene.add(car);
    this._paintA = new THREE.Color();
    this._paintB = new THREE.Color();
    this._paintKeys = s.paint.map((k) => ({ ...k, c: new THREE.Color(k.color) }));

    // ---- Contact shadow
    const shadowTex = radialTexture([
      [0, 'rgba(0,0,0,0.95)'],
      [0.55, 'rgba(0,0,0,0.6)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 2.9),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.003;
    scene.add(shadow);

    // ---- Mirror-black floor
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = this.isMobile ? this.cfg.performance.reflectionScaleMobile : this.cfg.performance.reflectionScale;
    this.reflectionScale = scale;
    this.mirror = new Reflector(new THREE.PlaneGeometry(60, 60), {
      clipBias: 0.003,
      textureWidth: Math.round(w * this.dpr * scale),
      textureHeight: Math.round(h * this.dpr * scale),
      color: s.floor.reflectionTint,
      multisample: this.isMobile ? 0 : 4,
    });
    this.mirror.rotation.x = -Math.PI / 2;
    scene.add(this.mirror);

    // Fade the mirror to pure black toward the edges of the studio
    const fadeTex = radialTexture([
      [0, 'rgb(40,40,40)'],
      [0.35, 'rgb(150,150,150)'],
      [1, 'rgb(255,255,255)'],
    ]);
    const fade = new THREE.Mesh(
      new THREE.PlaneGeometry(s.floor.fadeRadius * 2, s.floor.fadeRadius * 2),
      new THREE.MeshBasicMaterial({ color: s.background, alphaMap: fadeTex, transparent: true, depthWrite: false })
    );
    fade.rotation.x = -Math.PI / 2;
    fade.position.y = 0.001;
    scene.add(fade);
    // Beyond the fade disc, everything is black
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(s.floor.fadeRadius - 0.01, 60, 64),
      new THREE.MeshBasicMaterial({ color: s.background })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0.001;
    scene.add(outer);
  }

  /* ---------- Public API ------------------------------------------------- */

  setProgress(p) {
    this.targetProgress = clamp(p, 0, 1);
    this.needsRender = true;
  }

  setPointer(nx, ny) {
    if (this.reducedMotion) return;
    this.mouseTarget.set(nx, ny);
    this.needsRender = true;
  }

  resize(force = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Ignore the mobile URL-bar show/hide jitter
    if (!force && this.size && this.size.w === w && Math.abs(this.size.h - h) < 120) return;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait screens: pull back so the whole car stays in frame
    this.distanceScale = this.camera.aspect < 1 ? lerp(1.3, 2.35, clamp((1 - this.camera.aspect) / 0.55, 0, 1)) : 1;
    this.camera.updateProjectionMatrix();
    // Fog travels with the camera distance so the car never disappears into it
    this.scene.fog.near = this.scfg.fog.near * this.distanceScale;
    this.scene.fog.far = this.scfg.fog.far * this.distanceScale;
    this._resizeMirror();
    this.needsRender = true;
  }

  _resizeMirror() {
    const { w, h } = this.size;
    this.mirror
      .getRenderTarget()
      .setSize(Math.round(w * this.dpr * this.reflectionScale), Math.round(h * this.dpr * this.reflectionScale));
  }

  /* Drop resolution if the device can't hold ~60fps. */
  _adapt(dt) {
    if (dt > 100) return; // tab switch / first frame
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 21 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.size.w, this.size.h, false);
      this._resizeMirror();
    }
  }

  _updateCamera() {
    const cam = this.scfg.camera;
    const p = this.progress;
    const keys = cam.keys;
    const polarDeg = sampleKeys(keys, p, 'polar');
    const polar = degToRad(polarDeg);
    const radius = sampleKeys(keys, p, 'radius') * this.distanceScale;
    const lookY = sampleKeys(keys, p, 'lookY');
    // Full 360° orbit, slightly eased so chapters hold a beat
    const azimuth = degToRad(cam.startAzimuth) + (p - Math.sin(p * Math.PI * 4) * 0.02) * Math.PI * 2;

    const pos = this.camera.position;
    pos.set(
      radius * Math.sin(polar) * Math.cos(azimuth),
      radius * Math.cos(polar),
      radius * Math.sin(polar) * Math.sin(azimuth)
    );
    this.lookAt.set(0, lookY, 0);

    // Near top-down, roll so the car lies across the screen
    const roll = 1 - smoothstep(polarDeg, 4, 40);
    this.camera.up.set(0, 1, 0).lerp(this._topUp, roll).normalize();
    this.camera.lookAt(this.lookAt);

    // Frame the car (clear of the copy) and lean toward the cursor
    const portrait = this.camera.aspect < 1;
    const fx = portrait ? 0 : sampleKeys(keys, p, 'frameX');
    const fy = portrait ? cam.mobileFrameY * this.distanceScale : sampleKeys(keys, p, 'frameY');
    const lean = cam.mouseLean;
    this._right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this._up.setFromMatrixColumn(this.camera.matrixWorld, 1);
    // X trucks the camera sideways; Y tilts the aim so the camera never dips
    this._offset.copy(this._right).multiplyScalar(-fx);
    pos.add(this._offset);
    this.lookAt.add(this._offset).addScaledVector(this._up, -fy);
    pos.addScaledVector(this._right, this.mouse.x * lean.x).addScaledVector(this._up, this.mouse.y * lean.y);
    if (pos.y < 0.18) pos.y = 0.18; // never dip below the mirror
    this.camera.lookAt(this.lookAt);

    // Hide the physical strip once the camera rises through it
    const sl = this.scfg.stripLight;
    const fade = 1 - smoothstep(pos.y, sl.height - 0.8, sl.height + 0.6);
    this.stripMat.opacity = fade;
    this.haloMat.opacity = 0.06 * fade;
  }

  _updatePaint() {
    const keys = this._paintKeys;
    const p = this.progress;
    let a = keys[0];
    let b = keys[keys.length - 1];
    for (let i = 1; i < keys.length; i++) {
      if (p <= keys[i].at) {
        a = keys[i - 1];
        b = keys[i];
        break;
      }
    }
    const k = b.at === a.at ? 1 : smoothstep(p, a.at, b.at);
    // Lerp in linear space for a clean metallic transition
    this.paint.color.copy(a.c).lerp(b.c, k);
    this.paint.metalness = lerp(a.metalness, b.metalness, k);
    this.paint.roughness = lerp(a.roughness, b.roughness, k);
  }

  /* Called every frame by the GSAP ticker. dt in ms. */
  tick(dt) {
    const damp = 1 - Math.pow(1 - 0.12, dt / 16.67);
    const mdamp = 1 - Math.pow(1 - this.scfg.camera.mouseLean.damping, dt / 16.67);

    const dp = this.targetProgress - this.progress;
    const dm = this.mouseTarget.distanceTo(this.mouse);
    if (Math.abs(dp) > 1e-5) this.progress += dp * damp;
    else this.progress = this.targetProgress;
    if (dm > 1e-4) this.mouse.lerp(this.mouseTarget, mdamp);

    // Skip rendering entirely when nothing moves — saves battery on idle.
    if (!this.needsRender && Math.abs(dp) <= 1e-5 && dm <= 1e-4) return;
    this.needsRender = false;

    this._updateCamera();
    this._updatePaint();
    this.renderer.render(this.scene, this.camera);
    this._adapt(dt);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
          m.dispose();
        });
      }
    });
    this.mirror.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
