/* InVin home: the real invoice designs (rendered by the app's own InvoicePaper), the hero's one loop,
   and the designs switcher. Everything else (hover, nav, moments, the scene) comes from the kit. */

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || innerWidth < 640;

const res = await fetch('/home/papers.json').then((r) => r.json()).catch(() => null);
const html = res?.html ?? {};
const labels = res?.labels ?? [];

function put(el, key, brand) {
  if (!html[key]) return;
  el.innerHTML = html[key];
  const paper = el.firstElementChild;
  if (paper) {
    paper.removeAttribute('role');
    paper.setAttribute('aria-hidden', 'true');
    if (brand) paper.style.setProperty('--brand', brand);
  }
}
document.querySelectorAll('[data-paper]').forEach((el) => put(el, el.dataset.paper));

/* ---------- hero: draft, sent, opened, paid. One 4 s cycle, seeded on its finished picture ---------- */
const win = document.querySelector('.hm-win');
if (win) {
  const pill = win.querySelector('[data-pill]');
  const pillText = win.querySelector('[data-pill-text]');
  const foot = win.querySelector('[data-foot]');
  const btn = win.querySelector('.hm-pause');
  const STEPS = [
    { s: 'draft', t: 'Draft', f: 'Not sent yet' },
    { s: 'sent', t: 'Sent', f: 'Sent with PDF · Nov 13' },
    { s: 'viewed', t: 'Opened', f: 'Opened by Northstar · 2 min ago' },
    { s: 'paid', t: 'Paid', f: 'Paid in full · Nov 21' },
  ];
  const AT = [0, 900, 1800, 2700];       // the last 1.3 s holds the finished picture
  const CYCLE = 4000;
  let timers = [];
  let paused = false;
  const show = (k) => {
    const st = STEPS[k];
    win.dataset.step = String(k);
    pill.dataset.s = st.s;
    pillText.textContent = st.t;
    foot.textContent = st.f;
  };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const run = () => {
    clear();
    AT.forEach((t, k) => timers.push(setTimeout(() => show(k), t)));
    timers.push(setTimeout(() => { if (!paused) run(); }, CYCLE));
  };
  show(3);
  if (still()) {
    btn.hidden = true;
  } else {
    timers.push(setTimeout(run, 600));
    btn.addEventListener('click', () => {
      paused = !paused;
      btn.setAttribute('aria-pressed', String(paused));
      btn.setAttribute('aria-label', paused ? 'Play the example' : 'Pause the example');
      win.toggleAttribute('data-paused', paused);
      if (paused) clear(); else run();
    });
    // The pointer entering restarts the story from the top (not in its first 800 ms)
    let last = 0;
    win.parentElement.addEventListener('pointerenter', () => {
      if (paused || performance.now() - last < 800) return;
      last = performance.now();
      run();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); else if (!paused) run(); });
  }
}

/* ---------- designs: nine designs, five colours, one live paper ---------- */
const design = document.querySelector('[data-design]');
const picks = document.querySelector('[data-picks]');
const swatches = document.querySelector('[data-swatches]');
if (design && picks && labels.length) {
  let tpl = 'editorial';
  let brand = '#0E5A52';
  const render = () => {
    put(design, tpl, brand);
    design.animate?.([{ opacity: 0.4, filter: 'blur(3px)', transform: 'scale(0.992)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: still() ? 0 : 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };
  for (const l of labels) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hm-pick';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(l.value === tpl));
    b.textContent = l.label;
    b.addEventListener('click', () => {
      tpl = l.value;
      picks.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      render();
    });
    picks.append(b);
  }
  swatches?.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    brand = getComputedStyle(b).getPropertyValue('--c').trim();
    swatches.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    const paper = design.firstElementChild;
    if (paper) paper.style.setProperty('--brand', brand);
  }));
  render();
}
