// One tooltip for the whole page. Anything with a data-tip attribute gets it: on hover with a mouse, and on a long press
// with a finger (a long press does not also pick the sticker). It stays inside the screen and inside an open dialog.
let tip, pressTimer, swallow = false;

const find = (t) => (t instanceof Element ? t.closest('[data-tip]') : null);

function show(el) {
  const host = document.querySelector('dialog[open]') ?? document.body; // a dialog covers the page, so the tip lives inside it
  if (tip.parentElement !== host) host.append(tip);
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  tip.style.left = '0px';
  tip.style.top = '0px';
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight, m = 8;
  const x = Math.max(m, Math.min(innerWidth - w - m, r.left + r.width / 2 - w / 2));
  const above = r.top - h - 8;
  tip.style.left = `${x}px`;
  tip.style.top = `${above >= m ? above : r.bottom + 8}px`;
}
const hide = () => { clearTimeout(pressTimer); if (tip) tip.hidden = true; };

export function initTooltips() {
  tip = document.createElement('div');
  tip.id = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);

  document.addEventListener('mouseover', (e) => { const el = find(e.target); if (el) show(el); else hide(); });
  document.addEventListener('mouseleave', hide);
  for (const ev of ['scroll', 'resize', 'keydown']) window.addEventListener(ev, hide, true);

  // touch: press and hold
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return hide();
    hide();
    const el = find(e.target);
    if (el) pressTimer = setTimeout(() => { show(el); swallow = true; }, 450);
  });
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => clearTimeout(pressTimer));
  document.addEventListener('click', (e) => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
}
