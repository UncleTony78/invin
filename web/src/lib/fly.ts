/**
 * A small tile that travels from where you pinned something to where it lands in the sidebar,
 * so you see where it went. Rare action, so it can afford a moment of delight.
 * Uses the Web Animations API (off the main thread) and does nothing with reduced motion or a hidden sidebar.
 */
export function flyToSidebar(from: Element, label: string, colors: [string, string]) {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = document.querySelector(".pins") ?? document.querySelector('[data-pins-empty]');
  const side = document.querySelector(".side-in");
  if (!target || !side || side.getBoundingClientRect().right <= 0) return;
  const a = from.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  // Land where the new row will appear: the bottom of the list, or its top if the list is empty
  const tx = t.left + 22, ty = Math.min(t.bottom, innerHeight - 40) + (target.children.length ? 2 : 14);
  const ghost = document.createElement("div");
  ghost.className = "pin-ghost iv-mono";
  ghost.textContent = label.slice(-3);
  ghost.style.background = colors[0];
  ghost.style.color = colors[1];
  ghost.style.left = `${a.left + a.width / 2 - 11}px`;
  ghost.style.top = `${a.top + a.height / 2 - 11}px`;
  document.body.appendChild(ghost);
  const dx = tx - (a.left + a.width / 2), dy = ty - (a.top + a.height / 2);
  // An arc: travel left fast, drop a little later, like something thrown onto a shelf
  const anim = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1.15)", opacity: 0 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 40}px) scale(1.1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.9)`, opacity: 0.2 },
    ],
    { duration: 560, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
  );
  anim.onfinish = () => ghost.remove();
  anim.oncancel = () => ghost.remove();
}
