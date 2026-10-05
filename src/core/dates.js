import { BULAN, BULAN_S, HARI } from './icons.js';

/* ============================ UTIL TANGGAL ============================ */
/* s = integer YYYYMMDD. ym = integer YYYYMM. */
export function todayS() { var d = new Date(); return dToS(d); }

export function dToS(d)  { return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(); }

export function sToD(s)  { return new Date(Math.floor(s/10000), Math.floor(s/100)%100 - 1, s%100); }

export function sYm(s)   { return Math.floor(s/100); }

// 20260727 -> 202607
export function ymY(ym)  { return Math.floor(ym/100); }

export function ymM(ym)  { return ym%100; }

// 1..12
export function ymAdd(ym, n) {
  var t = ymY(ym)*12 + (ymM(ym)-1) + n;
  return Math.floor(t/12)*100 + (t%12) + 1;
}

export function ymLabel(ym) { return BULAN[ymM(ym)-1] + ' ' + ymY(ym); }

export function sLabel(s)   { return (s%100) + ' ' + BULAN_S[Math.floor(s/100)%100 - 1] + ' ' + Math.floor(s/10000); }

export function sWeekday(s) { return HARI[sToD(s).getDay()]; }

export function sToInput(s) {                                          // -> 'YYYY-MM-DD'
  var m = Math.floor(s/100)%100, d = s%100;
  return Math.floor(s/10000) + '-' + (m<10?'0':'') + m + '-' + (d<10?'0':'') + d;
}

export function inputToS(v) {                                          // 'YYYY-MM-DD' -> int
  var p = String(v||'').split('-');
  if (p.length !== 3) return 0;
  return (+p[0])*10000 + (+p[1])*100 + (+p[2]);
}

/* clamp hari ke akhir bulan (31 -> 28/30) — dipakai rutin bulanan v0.6 */
export function clampDay(ym, day) {
  var last = new Date(ymY(ym), ymM(ym), 0).getDate();
  return ym*100 + Math.min(day, last);
}
