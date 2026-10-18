/* Squishy FX: jelly background, cursor glow, magnetic + spring buttons, spotlight cards, ripples,
   confetti, toasts, sliding nav pill, 3D title flips, scroll skew. Everything respects reduced motion. */
const Fx = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAL = ['#ff7a1a', '#ffb066', '#9b6bff', '#c4a8ff', '#ffffff'];
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let mouse = { x: innerWidth / 2, y: innerHeight / 2 };

  // ------------------------------------------------------------ jelly background
  function background() {
    const cv = document.getElementById('bg');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, blobs = [], dots = [];
    const mk = (c, a) => ({
      c, a, x: Math.random(), y: Math.random(), r: 0.16 + Math.random() * 0.16,
      sx: 0.00006 + Math.random() * 0.00008, sy: 0.00005 + Math.random() * 0.00008,
      ph: Math.random() * 6.28, sq: 0.8 + Math.random() * 0.6,
    });
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blobs = [mk('255,122,26', 0.2), mk('155,107,255', 0.22), mk('255,122,26', 0.12), mk('155,107,255', 0.16), mk('255,176,102', 0.1)];
      dots = Array.from({ length: Math.round((W * H) / 26000) }, () => ({
        x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7,
        c: PAL[Math.floor(Math.random() * PAL.length)], ph: Math.random() * 6.28,
      }));
    }
    addEventListener('resize', resize);
    resize();
    let px = 0, py = 0;
    function frame(t) {
      px += ((mouse.x / W - 0.5) - px) * 0.04; py += ((mouse.y / H - 0.5) - py) * 0.04;
      ctx.clearRect(0, 0, W, H);
      for (const b of blobs) {
        const x = W * (b.x + 0.18 * Math.sin(t * b.sx + b.ph) + px * 0.05);
        const y = H * (b.y + 0.18 * Math.cos(t * b.sy + b.ph * 1.3) + py * 0.05);
        const breathe = 1 + 0.18 * Math.sin(t * 0.0009 * b.sq + b.ph);
        const r = Math.max(W, H) * b.r * breathe;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 + 0.12 * Math.sin(t * 0.0007 + b.ph), 1 - 0.1 * Math.sin(t * 0.0007 + b.ph)); // jelly squash
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(${b.c},${b.a})`);
        g.addColorStop(0.6, `rgba(${b.c},${b.a * 0.35})`);
        g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      for (const d of dots) {
        d.y -= 0.12 * d.z; d.x += Math.sin(t * 0.0005 + d.ph) * 0.1;
        if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; }
        const tw = 0.4 + 0.6 * Math.sin(t * 0.0012 + d.ph);
        ctx.globalAlpha = clamp(tw, 0, 1) * 0.55 * d.z;
        ctx.fillStyle = d.c;
        const r = 1 + d.z * 1.8;
        ctx.beginPath(); ctx.arc(d.x + px * 18 * d.z, d.y + py * 18 * d.z, r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ cursor glow
  function cursorGlow() {
    if (reduce) return;
    const g = document.createElement('div');
    g.id = 'glow';
    document.body.appendChild(g);
    const qx = gsap.quickTo(g, 'x', { duration: 0.6, ease: 'power3.out' });
    const qy = gsap.quickTo(g, 'y', { duration: 0.6, ease: 'power3.out' });
    addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; qx(e.clientX); qy(e.clientY); }, { passive: true });
  }

  // ------------------------------------------------------------ interactions (delegated)
  const MAG = '.btn, .big-btn, .chip, .wb, .bar-logo';
  const SPOT = '.card, .row, .lib-row, .mod-line';
  function interactions() {
    document.addEventListener('pointermove', e => {
      const sp = e.target.closest && e.target.closest(SPOT);
      if (sp) {
        const r = sp.getBoundingClientRect();
        sp.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        sp.style.setProperty('--my', (e.clientY - r.top) + 'px');
        if (sp.classList.contains('card') && !reduce) {
          // slow 3D tilt on the big cards
          const rx = ((e.clientY - r.top) / r.height - 0.5) * -5, ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
          gsap.to(sp, { rotationX: rx, rotationY: ry, transformPerspective: 900, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
        }
      }
      if (reduce) return;
      const m = e.target.closest && e.target.closest(MAG);
      if (m && !m.disabled) {
        const r = m.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const k = m.classList.contains('big-btn') ? 0.06 : 0.22;
        gsap.to(m, { x: dx * k, y: dy * k, scale: m.classList.contains('big-btn') ? 1.025 : 1.06, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
      }
    }, { passive: true });

    document.addEventListener('pointerout', e => {
      if (reduce) return;
      const m = e.target.closest && e.target.closest(MAG);
      if (m && (!e.relatedTarget || !m.contains(e.relatedTarget))) {
        gsap.to(m, { x: 0, y: 0, scale: 1, duration: 0.9, ease: 'elastic.out(1.1, 0.35)', overwrite: 'auto' });
      }
      const c = e.target.closest && e.target.closest('.card');
      if (c && (!e.relatedTarget || !c.contains(e.relatedTarget))) {
        gsap.to(c, { rotationX: 0, rotationY: 0, duration: 0.9, ease: 'elastic.out(1,0.5)', overwrite: 'auto' });
      }
    });

    document.addEventListener('pointerdown', e => {
      if (reduce) return;
      const m = e.target.closest && e.target.closest(MAG);
      if (m && !m.disabled) gsap.to(m, { scale: 0.92, scaleY: 0.88, duration: 0.12, ease: 'power2.out', overwrite: 'auto' });
    });
    document.addEventListener('pointerup', e => {
      if (reduce) return;
      const m = e.target.closest && e.target.closest(MAG);
      if (m) gsap.to(m, { scale: 1.06, scaleY: 1.06, duration: 0.7, ease: 'elastic.out(1.3,0.3)', overwrite: 'auto' });
    });

    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.btn, .big-btn');
      if (!b || b.disabled || reduce) return;
      const r = b.getBoundingClientRect();
      const s = document.createElement('span');
      s.className = 'ripple';
      const d = Math.max(r.width, r.height) * 2;
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(s);
      gsap.fromTo(s, { scale: 0, opacity: 0.55 }, { scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => s.remove() });
    });
  }

  // ------------------------------------------------------------ scroll skew
  function scrollSkew() {
    const page = $('#page');
    if (!page || reduce) return;
    let last = page.scrollTop, vel = 0, cur = 0;
    page.addEventListener('scroll', () => { vel += (page.scrollTop - last) * 0.05; last = page.scrollTop; }, { passive: true });
    // CSS: .page > * { transform: skewY(var(--sk)) }; only the variable changes here
    gsap.ticker.add(() => {
      vel *= 0.9;
      const target = clamp(-vel, -3, 3);
      cur += (target - cur) * 0.2;
      if (Math.abs(cur) < 0.01 && Math.abs(vel) < 0.01) { if (cur !== 0) { cur = 0; page.style.setProperty('--sk', '0deg'); } return; }
      page.style.setProperty('--sk', cur.toFixed(2) + 'deg');
    });
  }

  // ------------------------------------------------------------ nav pill
  let pill = null;
  function navPill(id, instant) {
    const rail = $('#rail');
    if (!rail) return;
    if (!pill || !pill.isConnected) {
      pill = document.createElement('div');
      pill.className = 'nav-pill';
      rail.prepend(pill);
      instant = true;
    }
    const nav = rail.querySelector(`.nav[data-id="${id}"]`);
    if (!nav) return;
    const y = nav.offsetTop - 4, h = nav.offsetHeight + 8, w = rail.clientWidth - 36;
    if (instant || reduce) { gsap.set(pill, { y, height: h, width: w }); return; }
    gsap.timeline()
      .to(pill, { y, height: h, width: w, duration: 0.7, ease: 'elastic.out(1,0.55)' }, 0)
      .fromTo(pill, { scaleX: 0.9 }, { scaleX: 1, duration: 0.7, ease: 'elastic.out(1.2,0.4)' }, 0);
    gsap.fromTo(nav, { x: 0 }, { x: 10, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  // ------------------------------------------------------------ title: 3D flip letters
  let idleTimer = null;
  function titleEnter(chars) {
    clearInterval(idleTimer);
    if (reduce) return;
    gsap.fromTo(chars,
      { rotationX: -100, yPercent: 70, opacity: 0, scale: 0.7, filter: 'blur(10px)', transformOrigin: '50% 100%' },
      { rotationX: 0, yPercent: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.1, stagger: { each: 0.045, from: 'center' }, ease: 'back.out(2.1)', clearProps: 'filter' });
    // a wave runs through the word every few seconds
    idleTimer = setInterval(() => {
      gsap.to(chars, { yPercent: -14, scaleY: 1.12, duration: 0.28, stagger: { each: 0.05, yoyo: true, repeat: 1 }, ease: 'sine.inOut', overwrite: 'auto' });
    }, 6500);
  }
  function titleExit(chars) {
    clearInterval(idleTimer);
    if (reduce || !chars.length) return Promise.resolve();
    return new Promise(res => gsap.to(chars, {
      rotationX: 95, yPercent: -60, opacity: 0, scale: 0.8, filter: 'blur(8px)', duration: 0.38,
      stagger: { each: 0.025, from: 'edges' }, ease: 'power3.in', onComplete: res, overwrite: 'auto',
    }));
  }
  function titleHover(el) {
    if (reduce) return;
    el.addEventListener('pointermove', e => {
      for (const c of el.querySelectorAll('.k-ch')) {
        const r = c.getBoundingClientRect();
        const d = Math.abs(e.clientX - (r.left + r.width / 2));
        const k = Math.exp(-Math.pow(d / 110, 2));
        gsap.to(c, { scaleY: 1 + 0.3 * k, scaleX: 1 - 0.1 * k, yPercent: -10 * k, duration: 0.3, ease: 'power2.out', overwrite: 'auto', transformOrigin: '50% 100%' });
      }
    }, { passive: true });
    el.addEventListener('pointerleave', () => gsap.to(el.querySelectorAll('.k-ch'), { scaleY: 1, scaleX: 1, yPercent: 0, duration: 0.9, stagger: 0.02, ease: 'elastic.out(1,0.4)', overwrite: 'auto' }));
  }

  // ------------------------------------------------------------ page enter + sweep
  function sweep() {
    if (reduce) return;
    let s = $('#sweep');
    if (!s) { s = document.createElement('div'); s.id = 'sweep'; document.body.appendChild(s); }
    gsap.timeline()
      .set(s, { scaleX: 0, transformOrigin: '0% 50%', opacity: 1 })
      .to(s, { scaleX: 1, duration: 0.35, ease: 'power3.inOut' })
      .set(s, { transformOrigin: '100% 50%' })
      .to(s, { scaleX: 0, duration: 0.45, ease: 'power3.inOut' });
  }
  function pageEnter(kids) {
    if (reduce || !kids.length) return;
    gsap.fromTo(kids,
      { y: (i) => 34 + i * 6, x: (i) => (i % 2 ? 24 : -24), opacity: 0, scale: 0.96, filter: 'blur(8px)' },
      { y: 0, x: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.09, ease: 'back.out(1.5)', clearProps: 'transform,filter,opacity' });
  }
  function pageExit(kids) {
    if (reduce || !kids.length) return Promise.resolve();
    return new Promise(res => gsap.to(kids, { y: -22, opacity: 0, scale: 0.97, filter: 'blur(6px)', duration: 0.28, stagger: 0.03, ease: 'power2.in', onComplete: res }));
  }
  function rows(els) {
    if (reduce || !els.length) return;
    gsap.fromTo(els,
      { x: (i) => (i % 2 ? 60 : -60), opacity: 0, rotationY: (i) => (i % 2 ? -12 : 12), transformPerspective: 800 },
      { x: 0, opacity: 1, rotationY: 0, duration: 0.8, stagger: 0.055, ease: 'back.out(1.4)', clearProps: 'transform,opacity' });
  }
  function skeleton(box, n = 6) {
    box.textContent = '';
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.className = 'row skel';
      s.innerHTML = '<div class="ic"></div><div><div class="sk sk1"></div><div class="sk sk2"></div></div><div class="sk sk3"></div>';
      box.appendChild(s);
    }
  }

  // ------------------------------------------------------------ confetti + toasts
  let cv = null, cx = null, parts = [], running = false;
  function ensureCanvas() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.id = 'fx';
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    cx = cv.getContext('2d');
    addEventListener('resize', () => { cv.width = innerWidth; cv.height = innerHeight; });
  }
  function confetti(x, y, n = 36) {
    if (reduce) return;
    ensureCanvas();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 3 + Math.random() * 7;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, r: 3 + Math.random() * 4, c: PAL[i % PAL.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1, sq: Math.random() < 0.5 });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.014;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalAlpha = clamp(p.life * 1.4, 0, 1); cx.fillStyle = p.c;
      if (p.sq) cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { cx.beginPath(); cx.arc(0, 0, p.r / 1.6, 0, 6.283); cx.fill(); }
      cx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; cx.clearRect(0, 0, cv.width, cv.height); }
  }
  function toast(msg, tone = 'ok') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + tone;
    t.textContent = msg;
    box.appendChild(t);
    if (reduce) { setTimeout(() => t.remove(), 3500); return; }
    gsap.fromTo(t, { x: 80, opacity: 0, scale: 0.9 }, { x: 0, opacity: 1, scale: 1, duration: 0.7, ease: 'elastic.out(1,0.55)' });
    gsap.to(t, { x: 60, opacity: 0, duration: 0.4, delay: 3.4, ease: 'power2.in', onComplete: () => t.remove() });
  }
  /** Button -> check mark with a draw-in stroke and a confetti pop. */
  function success(btn, label = 'INSTALLED') {
    btn.classList.remove('working');
    btn.classList.add('done');
    btn.innerHTML = '<svg class="tick" viewBox="0 0 24 24" width="16" height="16"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' + label + '</span>';
    const r = btn.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
    if (reduce) return;
    const path = btn.querySelector('path');
    const len = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(btn, { scale: 1.25 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1,0.35)' });
  }

  function init() {
    background(); cursorGlow(); interactions(); scrollSkew();
    const t = $('#title'); if (t) titleHover(t);
  }

  return { init, reduce, navPill, titleEnter, titleExit, pageEnter, pageExit, rows, skeleton, sweep, confetti, toast, success };
})();
