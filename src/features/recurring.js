import { clampDay, sYm, todayS, ymAdd } from '../core/dates.js';
import { DATA, addItem, save } from '../core/store.js';

/* =====================================================================
   RUTIN BULANAN — template tagihan.
   Yang DISIMPAN cuma templatenya + bulan terakhir yang sudah ditangani.
   "Sudah jatuh tempo atau belum" selalu DIHITUNG dari tanggal hari ini,
   tak pernah disimpan sebagai status.
   ===================================================================== */
export function recDueDate(r, ym) { return clampDay(ym, r.day); }

/* 31 -> 28/29/30 */

/* Daftar {r, ym} yang jatuh temponya sudah lewat tapi belum ditangani.
   Kalau doneYm belum ada (template baru), mulai dari BULAN INI — template baru
   tidak boleh membangkitkan tagihan bertahun-tahun ke belakang. */
export function recPending(d, today) {
  d = d || DATA;
  today = today || todayS();
  var cur = sYm(today), out = [];
  (d.recurring || []).forEach(function (r) {
    if (r.active === false) return;
    var ym = r.doneYm ? ymAdd(r.doneYm, 1) : cur;
    for (var guard = 0; ym <= cur && guard < 24; ym = ymAdd(ym, 1), guard++) {
      if (recDueDate(r, ym) <= today) out.push({ r: r, ym: ym });
    }
  });
  out.sort(function (a, b) { return recDueDate(a.r, a.ym) - recDueDate(b.r, b.ym); });
  return out;
}

export function recPost(r, ym, d) {
  d = d || DATA;
  var it = addItem({ s: recDueDate(r, ym), cat: r.cat, title: r.name,
                     acct: r.acct, amt: r.amt }, d);
  r.doneYm = ym;
  return it;
}

/* Lewati = tandai bulan itu selesai TANPA membuat catatan. Bulan berikutnya
   tetap akan ditanyakan. */
export function recSkip(r, ym) { r.doneYm = ym; }

/* Mode auto dijalankan sekali saat boot. Idempoten lewat doneYm: buka app
   sepuluh kali sehari pun tidak akan menggandakan tagihan. */
export function runAutoRecurring() {
  var pend = recPending().filter(function (p) { return p.r.mode === 'auto'; });
  if (!pend.length) return 0;
  pend.forEach(function (p) { recPost(p.r, p.ym); });
  save();
  return pend.length;
}
