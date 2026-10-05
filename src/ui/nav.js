import { render } from '../app/render.js';
import { sYm, todayS } from '../core/dates.js';

/* ============================ NAVIGASI ============================ */
export var UI = {
  tab: 'dasbor',
  ym: sYm(todayS()),
  q: '',                 // kata cari (tidak disimpan — ini keadaan tampilan)
  fcat: '',              // filter kategori, '' = semua
  scope: 'month',        // 'month' | 'all'
  /* mode Atur per seksi. Kunci 'cls:<k>' dipakai per kelas aset. */
  edit: { budget: false, goals: false, alloc: false, liab: false }
};

export function go(tab) {
  UI.tab = tab;
  render();
  try { window.scrollTo(0, 0); } catch (e) {}
}

export function el(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

/* Monogram: pakai huruf kapital bawaan nama kalau ada (GoPay -> GP, BCA -> BC),
   kalau tidak ambil dua huruf pertama (Cash -> CA). */
export function monogram(s) {
  s = String(s || '?').trim();
  var w = s.split(/\s+/).filter(function (x) { return /^[A-Za-z0-9]/.test(x); });
  if (w.length > 1) return (w[0][0] + w[1][0]).toUpperCase();    // "GoPay Later" -> GL, "Kas & Setara" -> KS
  var caps = s.replace(/[^A-Z]/g, '');
  if (caps.length >= 2) return caps.slice(0, 2);
  return s.slice(0, 2).toUpperCase();
}
