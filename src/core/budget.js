import { DATA } from './store.js';

/* Anggaran efektif: override bulan > default global > 0 */
export function budgetFor(cat, ym, d) {
  d = d || DATA;
  var mo = d.budgetsMo && d.budgetsMo[ym];
  if (mo && typeof mo[cat] === 'number') return mo[cat];
  if (typeof d.budgets[cat] === 'number') return d.budgets[cat];
  return 0;
}

export function budgetIsOverride(cat, ym, d) {
  d = d || DATA;
  var mo = d.budgetsMo && d.budgetsMo[ym];
  return !!(mo && typeof mo[cat] === 'number');
}

/* Kategori yang dianggarkan di bulan ini. Yang menentukan adalah KEBERADAAN
   kunci, bukan nilainya — anggaran Rp0 tetap dianggarkan (dan artinya setiap
   pengeluaran langsung terhitung lewat batas). Kalau disaring `> 0`, kategori
   yang baru ditambahkan (mulai dari 0) tidak akan pernah tampil. */
export function budgetedCats(ym, d) {
  d = d || DATA;
  var set = {}, k;
  for (k in d.budgets) if (typeof d.budgets[k] === 'number') set[k] = 1;
  var mo = d.budgetsMo && d.budgetsMo[ym];
  for (k in (mo || {})) if (typeof mo[k] === 'number') set[k] = 1;
  return Object.keys(set);
}

/* Rasio pemakaian anggaran. Batas 0 dengan pengeluaran > 0 = sudah lewat,
   bukan 0% — kalau dibulatkan ke 0 barnya bohong. */
export function budgetPct(used, lim) {
  if (lim > 0) return used / lim;
  return used > 0 ? 2 : 0;
}
