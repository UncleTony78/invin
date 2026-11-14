/*
  InVin home: the motion layer on top of the kit.
  - Settlement Currents behind the hero and the close (currents.js)
  - the hero arrives: words rise out of a blur, one after another
  - sections arrive as they scroll in: a short rise and a blur that clears, staggered
  - the hero's window and phone follow the pointer on springs, at two depths
  - a light follows the pointer across cards and panels
  - the design pills share one sliding highlight
  - the nav gains a reading-progress line and a frosted ground once you scroll
  Everything rests under prefers-reduced-motion; hovers only on a fine pointer.
*/
import { mount } from "./currents.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const root = document.documentElement;

/* ---------- the living ground ---------- */
document.querySelectorAll("canvas[data-currents]").forEach((c) => {
  mount(c, { seed: +c.dataset.seed || 1729, density: c.classList.contains("hm-currents--close") ? 0.8 : 1 });
});

/* ---------- the hero arrives ---------- */
const h1 = document.querySelector(".hm-hero h1");
if (h1 && !reduce) {
  const words = h1.textContent.trim().split(/\s+/);
  h1.setAttribute("aria-label", h1.textContent.trim());
  h1.innerHTML = words.map((w, i) => `<span class="hm-w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(" ");
  root.classList.add("hm-arrive");
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("hm-arrived")));
}

/* ---------- sections arrive as they come into view ---------- */
if (!reduce && "IntersectionObserver" in window) {
  const groups = [
    "main > section.section .section-head > *",
    "#features .card", "#team .card", ".hm-figures > div",
    "#designs .hm-picks", "#designs .hm-swatches", "#designs .hm-rows li", "#designs .hm-design",
    "#pay .hm-rows li", "#pay .hm-pay-frame",
    "#faq .faq__item",
    "footer.closing .closing__cta > *", "footer.closing .closing__links",
  ];
  const els = document.querySelectorAll(groups.join(","));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  els.forEach((el) => {
    // stagger siblings that share a parent
    const sib = [...el.parentElement.children].filter((c) => c.matches(groups.join(",")));
    el.style.setProperty("--d", `${Math.min(sib.indexOf(el), 6) * 70}ms`);
    el.classList.add("rv");
    io.observe(el);
  });
}

/* ---------- springs: the hero's window and phone follow the pointer at two depths ---------- */
function spring(stiffness = 120, damping = 18) {
  let x = 0, v = 0, target = 0;
  return {
    set(t) { target = t; },
    step(dt) { const f = -stiffness * (x - target) - damping * v; v += f * dt; x += v * dt; return x; },
    get settled() { return Math.abs(x - target) < 0.01 && Math.abs(v) < 0.01; },
  };
}
const stage = document.querySelector(".hm-stage");
if (stage && fine && !reduce) {
  const win = stage.querySelector(".hm-win");
  const phone = stage.querySelector(".hm-phone--hero");
  const sx = spring(), sy = spring();
  let raf = 0, last = 0;
  const tick = (t) => {
    const dt = Math.min(0.032, (t - (last || t)) / 1000); last = t;
    const x = sx.step(dt), y = sy.step(dt);
    if (win) win.style.transform = `translate3d(${(x * -10).toFixed(2)}px, ${(y * -8).toFixed(2)}px, 0)`;
    if (phone) phone.style.transform = `translate3d(${(x * 22).toFixed(2)}px, ${(y * 16).toFixed(2)}px, 0)`;
    raf = sx.settled && sy.settled ? 0 : requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
  const hero = document.querySelector(".hm-hero");
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    sx.set((e.clientX - r.left) / r.width - 0.5);
    sy.set((e.clientY - r.top) / r.height - 0.5);
    kick();
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { sx.set(0); sy.set(0); kick(); });
}

/* ---------- a light that follows the pointer across cards and panels ---------- */
if (fine) {
  document.querySelectorAll("#features .card, #team .card, .hm-pay-frame, .hm-design .iv-paper, .btn--primary").forEach((el) => {
    el.classList.add("hm-lit");
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
  });
}

/* ---------- the design pills share one sliding highlight ---------- */
const picks = document.querySelector("[data-picks]");
if (picks) {
  const ind = document.createElement("span");
  ind.className = "hm-pick-ind";
  ind.setAttribute("aria-hidden", "true");
  picks.prepend(ind);
  let first = true;
  const place = () => {
    const on = picks.querySelector('[aria-checked="true"]');
    if (!on) return;
    ind.style.transition = first || reduce ? "none" : "";
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.height = `${on.offsetHeight}px`;
    ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
    first = false;
  };
  new MutationObserver(place).observe(picks, { subtree: true, attributes: true, attributeFilter: ["aria-checked"], childList: true });
  addEventListener("resize", place);
  setTimeout(place, 50);
}

/* ---------- nav: reading progress and a frosted ground once scrolled ---------- */
const nav = document.querySelector("header.nav");
if (nav) {
  const bar = document.createElement("span");
  bar.className = "hm-progress";
  bar.setAttribute("aria-hidden", "true");
  nav.append(bar);
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    nav.toggleAttribute("data-scrolled", scrollY > 8);
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------- the trades band pauses under the pointer and for keyboard focus ---------- */
const band = document.querySelector(".hm-band");
if (band && reduce) band.classList.add("is-still");
