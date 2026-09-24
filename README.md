# Veloce — scroll-cinematic hypercar landing page

A one-page, real-time 3D launch film for **Veloce**, a hypercar for collectors who buy cars as art.
Scrolling drives the camera through a full 360° orbit of the car in a dark studio. The car sits on a mirror-black floor under a single overhead strip light. The camera finishes by rising to a top-down view, and the paint shifts from **deep red → graphite → silver** along the way.

No video files, no 3D model files. The car is built at runtime from extruded profiles and primitives.

```bash
npm install
npm run dev      # http://localhost:3000
```

Production: `npm run build && npm start`. Requires Node 20.9+.

## Stack

| Piece | Role |
| --- | --- |
| **Next.js 16** (App Router) | Page shell, fonts via `next/font` |
| **Three.js** | Scene, car, mirror floor (`Reflector`), strip light (`RectAreaLight`) |
| **GSAP + ScrollTrigger** | Maps scroll to camera, paint and all text reveals |
| **Lenis** | Smooth scrolling, driven by GSAP's ticker so everything shares one `requestAnimationFrame` |

Fonts: **Cormorant Garamond** (light and italic serif for headlines and numbers) and **Manrope** (wide-tracked sans for labels).

## The story (scroll chapters)

1. **Hero:** "Built for the one road you'll never forget." The camera sits low at the front three-quarter, and letterbox bars retract as you scroll.
2. **Engine:** 1,200 hp counts up. Hand-assembled V12.
3. **Body:** 1,190 kg. Carbon fibre.
4. **Edition:** Only 99 made. Price on request.
5. **CTA:** "Request a private viewing" opens a minimal native `<dialog>` form.

Moving the mouse makes the camera lean slightly toward the cursor (disabled on touch devices and for `prefers-reduced-motion`).

## Configure it: `veloce.config.js`

Everything you'd normally tweak is in one config block at the project root:

- `colors`: UI palette (black, graphite, one red `accent`), injected as CSS variables.
- `story`: all copy, including the stat values and units.
- `scene.paint`: paint keyframes (`at` = scroll progress, plus colour, metalness and roughness).
- `scene.stripLight`: the overhead light's size, height and intensity.
- `scene.floor`: mirror tint (darker = blacker) and fade radius.
- `scene.camera.keys`: the camera path. Each key sets `polar` angle, `radius`, `lookY` and `frameX/frameY`, which keeps the car clear of the copy. The azimuth always sweeps 360°.
- `performance`: pixel-ratio caps and mirror resolution for desktop and mobile.
- `scroll.lerp`: Lenis smoothing.

## Project layout

```
veloce.config.js        ← the config block
app/
  layout.js             fonts, metadata, CSS variables from config
  page.js
  globals.css           all styling (mobile rules at the bottom)
components/
  Experience.js         Lenis + ScrollTrigger + chapter UI, owns the render loop
  ViewingDialog.js      private-viewing request form (no backend, wire up onSubmit)
lib/
  VeloceScene.js        renderer, studio, lights, mirror floor, camera path, paint
  buildCar.js           the car, built from extrusions and primitives
```

## Performance notes (60fps target)

- One render loop (the GSAP ticker) for Lenis and Three.js. Frames are **skipped entirely** when nothing moves.
- Pixel ratio is capped (1.75 desktop / 1.5 mobile) and **drops automatically** if average frame time goes over ~21 ms.
- The mirror floor renders at 50% resolution (35% on mobile, with MSAA off).
- Reflections come from a tiny procedurally-baked environment map (PMREM). There are no shadow maps; a soft contact shadow texture is used instead.
- Portrait screens pull the camera back (and push the fog back with it) so the whole car stays in frame. The copy moves to the bottom over a soft shade.
- `prefers-reduced-motion` turns off smooth-scroll easing, cursor lean and the grain animation.

## Hooking up the viewing form

`components/ViewingDialog.js` currently shows a thank-you message on submit. Replace `onSubmit` with a `fetch` to your API route or CRM.
