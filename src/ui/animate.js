import { fmtRp } from '../core/money.js';

/* ============================ ANIMASI ANGKA ============================ */
/* data-val selalu berisi integer eksak (tes membaca ini), teks dianimasikan
   hanya kalau requestAnimationFrame tersedia. */
export function setNum(el, val, fmt) {
  fmt = fmt || fmtRp;
  el.dataset.val = String(val);
  var raf = typeof requestAnimationFrame === 'function';
  var reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches; }
  catch (e) {}
  if (!raf || reduce || Math.abs(val) < 1000) { el.textContent = fmt(val); return; }
  var dur = 520, t0 = null;
  function step(t) {
    if (t0 === null) t0 = t;
    var p = Math.min(1, (t - t0) / dur);
    var e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(val * e));
    if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(val);
  }
  el.textContent = fmt(0);
  requestAnimationFrame(step);
}
