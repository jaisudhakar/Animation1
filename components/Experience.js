'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import config from '@/veloce.config';
import { VeloceScene } from '@/lib/VeloceScene';
import ViewingDialog from './ViewingDialog';

const { story, brand } = config;
const chapters = [story.engine, story.body, story.edition];
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export default function Experience() {
  const root = useRef(null);
  const stage = useRef(null);
  const lenisRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- 3D
    // A fresh canvas per mount: a context lost on unmount can't be reused.
    const canvas = document.createElement('canvas');
    canvas.className = 'webgl';
    stage.current.appendChild(canvas);
    let scene;
    try {
      scene = new VeloceScene(canvas, config);
    } catch (err) {
      console.error('[veloce] WebGL unavailable', err);
      root.current.classList.add('no-webgl');
    }

    // ---- Smooth scroll, driven by GSAP's ticker so everything shares one rAF
    const lenis = new Lenis({ lerp: reduced ? 1 : config.scroll.lerp, smoothWheel: !reduced });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time, deltaTime) => {
      lenis.raf(time * 1000);
      scene?.tick(deltaTime);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // ---- Input
    const onPointer = (e) => {
      if (e.pointerType === 'touch') return;
      scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    const onLeave = () => scene?.setPointer(0, 0);
    const onResize = () => scene?.resize();
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);

    const ctx = gsap.context(() => {
      // Master progress → camera, paint, UI rail
      const rail = root.current.querySelector('.rail-fill');
      const counter = root.current.querySelector('.counter-current');
      const sections = gsap.utils.toArray('.panel');
      ScrollTrigger.create({
        trigger: '.story',
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          scene?.setProgress(self.progress);
          rail.style.transform = `scaleY(${self.progress})`;
          const idx = Math.min(sections.length, Math.floor(self.progress * sections.length) + 1);
          counter.textContent = String(idx).padStart(2, '0');
        },
      });

      // Letterbox bars retract as the film "opens"
      gsap.to('.letterbox', {
        scaleY: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '40% top', scrub: true },
      });

      // Hero: fade out on the way down
      gsap.to('.hero .inner', {
        autoAlpha: 0,
        y: -60,
        ease: 'power1.in',
        scrollTrigger: { trigger: '.hero', start: '15% top', end: '55% top', scrub: true },
      });
      gsap.to('.scroll-cue', {
        autoAlpha: 0,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '10% top', scrub: true },
      });

      // Chapters: in → hold (number counts up) → out
      gsap.utils.toArray('.chapter').forEach((el) => {
        const num = el.querySelector('.stat-value');
        const target = Number(num.dataset.value);
        const counterObj = { v: 0 };
        const tl = gsap.timeline({
          scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: true },
          defaults: { ease: 'none' },
        });
        tl.fromTo(el.querySelector('.inner'), { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' })
          .fromTo(el.querySelector('.stat-line'), { scaleX: 0 }, { scaleX: 1, duration: 0.25 }, '<')
          .to(counterObj, { v: target, duration: 0.3, ease: 'power2.out', onUpdate: () => (num.textContent = fmt(counterObj.v)) }, '<')
          .to({}, { duration: 0.3 })
          .to(el.querySelector('.inner'), { autoAlpha: 0, y: -50, duration: 0.2, ease: 'power2.in' });
      });

      // Final call to action
      gsap.fromTo(
        '.cta .inner',
        { autoAlpha: 0, y: 40 },
        {
          autoAlpha: 1,
          y: 0,
          ease: 'power2.out',
          scrollTrigger: { trigger: '.cta', start: 'top top', end: '60% bottom', scrub: true },
        }
      );

      // Opening title sequence (time-based, plays once)
      const intro = gsap.timeline({ delay: 0.2 });
      intro
        .to('.curtain', { autoAlpha: 0, duration: reduced ? 0.01 : 1.8, ease: 'power2.inOut' })
        .from('.hero .eyebrow', { autoAlpha: 0, y: 12, duration: 1, ease: 'power3.out' }, '-=0.9')
        .from('.hero .word', { yPercent: 110, duration: 1.2, stagger: 0.06, ease: 'power4.out' }, '-=0.8')
        .from(['.site-header', '.scroll-cue', '.rail'], { autoAlpha: 0, duration: 1 }, '-=0.6');
    }, root);

    setReady(true);
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
      gsap.ticker.remove(tick);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      lenis.destroy();
      lenisRef.current = null;
      scene?.dispose();
      canvas.remove();
    };
  }, []);

  // Freeze scrolling while the viewing dialog is open
  useEffect(() => {
    const l = lenisRef.current;
    if (!l) return;
    dialogOpen ? l.stop() : l.start();
  }, [dialogOpen]);

  const heroWords = story.hero.title.split(' ');

  return (
    <div ref={root} className={`veloce ${ready ? 'is-ready' : ''}`}>
      <div ref={stage} className="stage" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="letterbox top" aria-hidden="true" />
      <div className="letterbox bottom" aria-hidden="true" />

      <header className="site-header">
        <span className="wordmark">{brand.name}</span>
        <span className="header-meta">
          <span className="dot" /> Series 01
        </span>
      </header>

      <div className="rail" aria-hidden="true">
        <span className="counter">
          <span className="counter-current">01</span> / 05
        </span>
        <span className="rail-track">
          <span className="rail-fill" />
        </span>
      </div>

      <main className="story">
        <section className="panel hero">
          <div className="inner">
            <p className="eyebrow">{story.hero.eyebrow}</p>
            <h1 className="hero-title">
              {heroWords.map((w, i) => (
                <span key={i}>
                  <span className="word-mask">
                    <span className="word">{w}</span>
                  </span>{' '}
                </span>
              ))}
            </h1>
            <p className="hero-sub">{brand.tagline}</p>
          </div>
          <div className="scroll-cue">
            <span>Scroll</span>
            <i />
          </div>
        </section>

        {chapters.map((c, i) => (
          <section key={c.label} className={`panel chapter chapter-section ${i % 2 ? 'align-right' : 'align-left'}`}>
            <div className="inner">
              <p className="chapter-label">
                <span className="chapter-index">{c.index}</span>
                <span className="stat-line" />
                {c.label}
              </p>
              <p className="stat">
                <span className="stat-value" data-value={c.value}>
                  0
                </span>
                <span className="stat-unit">{c.unit}</span>
              </p>
              <p className="chapter-caption">{c.caption}</p>
            </div>
          </section>
        ))}

        <section className="panel cta chapter-section">
          <div className="inner">
            <p className="eyebrow">{brand.name} — By appointment</p>
            <h2 className="cta-title">{story.cta.title}</h2>
            <button type="button" className="cta-button" onClick={() => setDialogOpen(true)}>
              <span>{story.cta.button}</span>
              <i aria-hidden="true" />
            </button>
          </div>
          <footer className="site-footer">
            <span>© {new Date().getFullYear()} {brand.name}</span>
            <span>Images rendered in real time</span>
          </footer>
        </section>
      </main>

      <ViewingDialog open={dialogOpen} onClose={() => setDialogOpen(false)} copy={story.cta} />
      <div className="curtain" aria-hidden="true" />
    </div>
  );
}
