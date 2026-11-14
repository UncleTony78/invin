/*
  Settlement Currents (design/settlement-currents.md).
  A seeded flow field: particles begin in turbulence and settle onto horizontal ledger rulings as they age.
  Every particle has a mirrored twin across the centre line (double entry). The tangerine accent rides only
  the fastest currents. The pointer is a soft attractor with a spring-like return.

  mount(canvas, { seed, density, accent, ink, bg, fade, settle, mask }) -> { destroy }
*/

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Seeded 3D value noise with smoothstep interpolation, summed in octaves */
function makeNoise(rand) {
  const P = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const V = new Float32Array(256).map(() => rand());
  const s = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const h = (x, y, z) => V[P[P[P[x & 255] + (y & 255)] + (z & 255)]];
  const n3 = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi, u = s(xf), v = s(yf), w = s(zf);
    return lerp(
      lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w,
    );
  };
  return (x, y, z) => n3(x, y, z) * 0.62 + n3(x * 2.03, y * 2.03, z * 1.7) * 0.27 + n3(x * 4.1, y * 4.1, z * 2.3) * 0.11;
}

export function mount(canvas, o = {}) {
  const opt = { seed: 1729, density: 1, accent: "#ff5a1f", ink: "243,239,232", bg: "13,12,11", fade: 0.035, settle: 150, ...o };
  const ctx = canvas.getContext("2d", { alpha: false });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, dpr = 1, rulings = [], parts = [], raf = 0, running = false, frame = 0;
  let rand = mulberry32(opt.seed), noise = makeNoise(rand);
  const ptr = { x: -9999, y: -9999, k: 0, target: 0 };

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = `rgb(${opt.bg})`;
    ctx.fillRect(0, 0, W, H);
    // the staves of a ledger page, on the upper half; twins mirror them onto the lower half
    const gap = 22 * dpr;
    rulings = [];
    for (let y = gap; y < H / 2 - gap * 0.5; y += gap) rulings.push(y);
    const n = Math.min(900, Math.round((W * H) / (dpr * dpr * 4200) * opt.density));
    rand = mulberry32(opt.seed); noise = makeNoise(rand);
    parts = Array.from({ length: n }, () => spawn(true));
  }

  function spawn(anywhere) {
    const ruling = rulings[Math.floor(rand() * rulings.length)] ?? H / 4;
    return {
      x: anywhere ? rand() * W : -rand() * 40 * dpr,
      y: anywhere ? rand() * (H / 2) : ruling + (rand() - 0.5) * 140 * dpr,
      vx: 0, vy: 0,
      age: anywhere ? rand() * opt.settle : 0,
      life: opt.settle * (1.6 + rand() * 1.6),
      ruling,
      accent: rand() < 0.03,
      jitter: (rand() - 0.5) * 6 * dpr, // the twin is never a perfect mirror
      px: 0, py: 0,
    };
  }

  function step(t) {
    // the trails fade slowly instead of clearing, so density builds where currents converge
    ctx.fillStyle = `rgba(${opt.bg},${opt.fade})`;
    ctx.fillRect(0, 0, W, H);
    ptr.k += (ptr.target - ptr.k) * 0.06; // spring-like ease of the pointer's pull
    const sc = 0.0011 / dpr, z = t * 0.00005;
    ctx.lineWidth = 1 * dpr;
    ctx.lineCap = "round";
    for (const p of parts) {
      p.px = p.x; p.py = p.y;
      const chaos = Math.exp(-p.age / opt.settle * 1.8);
      const a = (noise(p.x * sc, p.y * sc, z) - 0.5) * Math.PI * 1.5;
      const heading = a * (0.22 + 0.78 * chaos); // as the particle ages, turbulence hands over to the ruling, a gentle wave remains
      const speed = (1.3 + (1 - chaos) * 1.1) * dpr;
      let ax = Math.cos(heading) * speed, ay = Math.sin(heading) * speed;
      ay += (p.ruling - p.y) * 0.02 * (1 - chaos);
      if (ptr.k > 0.01) {
        const dx = ptr.x - p.x, dy = Math.min(ptr.y, H - ptr.y) - p.y, d2 = dx * dx + dy * dy, R = 220 * dpr;
        if (d2 < R * R) { const f = (1 - Math.sqrt(d2) / R) * 1.4 * ptr.k; ax += (dx / (Math.sqrt(d2) + 1)) * f; ay += (dy / (Math.sqrt(d2) + 1)) * f; }
      }
      p.vx = p.vx * 0.82 + ax * 0.18;
      p.vy = p.vy * 0.82 + ay * 0.18;
      p.x += p.vx; p.y += p.vy; p.age++;
      const v = Math.hypot(p.vx, p.vy) / dpr;
      if (p.accent) {
        ctx.strokeStyle = opt.accent;
        ctx.globalAlpha = Math.min(0.85, 0.18 + v * 0.32);
      } else {
        ctx.strokeStyle = `rgb(${opt.ink})`;
        ctx.globalAlpha = 0.07 + Math.min(0.16, v * 0.07);
      }
      ctx.beginPath();
      ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y);
      // its twin: the credit to this debit, mirrored across the centre line
      ctx.moveTo(p.px, H - p.py + p.jitter); ctx.lineTo(p.x, H - p.y + p.jitter);
      ctx.stroke();
      if (p.x > W + 20 || p.x < -60 * dpr || p.y < -20 || p.y > H / 2 + 40 * dpr || p.age > p.life) Object.assign(p, spawn(false));
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) { step(t); frame++; raf = requestAnimationFrame(loop); }
  function start() { if (running || reduce) return; running = true; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  size();
  if (reduce) { for (let i = 0; i < 420; i++) step(i * 16); } // a settled still, nothing moving
  let inView = false;
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView && !document.hidden ? start() : stop(); }, { rootMargin: "120px" });
  io.observe(canvas);
  const vis = () => (document.hidden || !inView ? stop() : start());
  document.addEventListener("visibilitychange", vis);
  let rt = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { size(); if (reduce) for (let i = 0; i < 420; i++) step(i * 16); }, 120); });
  ro.observe(canvas);
  const host = canvas.parentElement;
  const move = (e) => {
    if (e.pointerType === "touch") return;
    const r = canvas.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) * dpr; ptr.y = (e.clientY - r.top) * dpr; ptr.target = 1;
  };
  const leave = () => { ptr.target = 0; };
  host.addEventListener("pointermove", move, { passive: true });
  host.addEventListener("pointerleave", leave);
  return { destroy() { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", vis); host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave); } };
}
