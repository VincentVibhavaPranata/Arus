import { sYm, todayS } from './dates.js';
import { allItems } from './derived.js';
import { CATS_DEFAULT } from './icons.js';
import { DATA } from './store.js';

export function catOf(k, d) {
  d = d || DATA;
  for (var i = 0; i < d.cats.length; i++) if (d.cats[i].k === k) return d.cats[i];
  return { k: k, label: k, ic: 'lain', kind: 'out' };
}

export function catsByKind(kind, d) {
  d = d || DATA;
  return d.cats.filter(function (c) { return c.kind === kind; });
}

export function catExists(k, d) {
  d = d || DATA;
  return d.cats.some(function (c) { return c.k === k; });
}

export function catLabelExists(label, d) {
  var t = String(label).trim().toLowerCase();
  return (d || DATA).cats.some(function (c) { return c.label.toLowerCase() === t; });
}

/* Kunci kategori dari nama: slug + akhiran angka kalau bentrok. Kunci HARUS
   stabil karena item menyimpan `cat` sebagai kunci, bukan sebagai label. */
export function catKeyFor(name, d) {
  var base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!base) return '';
  if (!catExists(base, d)) return base;
  for (var i = 2; i < 999; i++) if (!catExists(base + '-' + i, d)) return base + '-' + i;
  return '';
}

export function isDefaultCat(k) {
  return CATS_DEFAULT.some(function (c) { return c.k === k; });
}

/* Berapa transaksi memakai kategori ini — dipakai sebelum menghapus. */
export function catUsage(k, d) {
  var all = allItems(d), n = 0;
  for (var i = 0; i < all.length; i++) if (all[i].it.cat === k) n++;
  return n;
}

/* rentang bulan yang punya data — untuk batas pemilih bulan */
export function ymRange(d) {
  d = d || DATA;
  var cur = sYm(todayS());
  if (!d.days.length) return { min: cur, max: cur };
  var mn = sYm(d.days[d.days.length-1].s), mx = sYm(d.days[0].s);
  return { min: Math.min(mn, cur), max: Math.max(mx, cur) };
}

/* Satu warna (hue HSL) per kategori, dipakai avatar, chip, bar anggaran, dan pita
   komposisi. Bawaan punya warna tetap; kategori buatan sendiri dapat hue stabil
   dari namanya, jadi warnanya tidak berubah-ubah antar sesi. */
var HUE = { makan: 24, transport: 200, tagihan: 252, belanja: 332, hiburan: 284,
            kesehatan: 150, pendidikan: 176, investasi: 96, lain: 228,
            gaji: 142, bonus: 164, transfer: 214 };
export function catHue(k) {
  if (k in HUE) return HUE[k];
  var h = 0, s = String(k);
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
