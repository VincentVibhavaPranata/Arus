import { ACCTS, LIAB_ACCTS } from './constants.js';
import { sYm } from './dates.js';
import { DATA } from './store.js';
import { isTf, tfLegs } from './transfer.js';

/* =====================================================================
   LAPISAN DERIVED — SATU-SATUNYA jalan membaca angka.
   Tak ada satu pun hasil di sini yang boleh disimpan ke DATA.
   ===================================================================== */
export function allItems(d) {
  d = d || DATA;
  var out = [];
  for (var i = 0; i < d.days.length; i++)
    for (var j = 0; j < d.days[i].items.length; j++)
      out.push({ s: d.days[i].s, it: d.days[i].items[j] });
  return out;
}

export function findItem(id, d) {
  d = d || DATA;
  for (var i = 0; i < d.days.length; i++)
    for (var j = 0; j < d.days[i].items.length; j++)
      if (d.days[i].items[j].id === id)
        return { day: d.days[i], it: d.days[i].items[j], di: i, ii: j };
  return null;
}

export function monthDays(ym, d) {
  d = d || DATA;
  return d.days.filter(function (x) { return sYm(x.s) === ym; });
}

/* Total bulan: transfer DIABAIKAN (bukan pengeluaran/pemasukan). */
export function monthTotals(ym, d) {
  var inn = 0, out = 0, days = monthDays(ym, d);
  for (var i = 0; i < days.length; i++)
    for (var j = 0; j < days[i].items.length; j++) {
      var it = days[i].items[j];
      if (isTf(it)) continue;
      if (it.amt >= 0) inn += it.amt; else out += -it.amt;
    }
  return { in: inn, out: out, net: inn - out };
}

export function dayTotal(day) {
  var t = 0;
  for (var j = 0; j < day.items.length; j++) if (!isTf(day.items[j])) t += day.items[j].amt;
  return t;
}

/* Pengeluaran per kategori dalam satu bulan (nilai POSITIF). */
export function catSpend(ym, d) {
  var m = {}, days = monthDays(ym, d);
  for (var i = 0; i < days.length; i++)
    for (var j = 0; j < days[i].items.length; j++) {
      var it = days[i].items[j];
      if (isTf(it) || it.amt >= 0) continue;
      m[it.cat] = (m[it.cat] || 0) + -it.amt;
    }
  return m;
}

/* Saldo berjalan per akun = acctStart + Σ transaksi.
   Transfer: -|amt| di kaki asal, +|amt| di kaki tujuan. */
export function acctBalances(d) {
  d = d || DATA;
  var bal = {}, i;
  for (i = 0; i < ACCTS.length; i++) bal[ACCTS[i]] = d.acctStart[ACCTS[i]] || 0;
  var all = allItems(d);
  for (i = 0; i < all.length; i++) {
    var it = all[i].it;
    if (isTf(it)) {
      var g = tfLegs(it), a = Math.abs(it.amt);
      if (g.from in bal) bal[g.from] -= a;
      if (g.to   in bal) bal[g.to]   += a;
    } else if (it.acct in bal) {
      bal[it.acct] += it.amt;
    }
  }
  return bal;
}

/* Saldo SATU akun sampai akhir tanggal s. Dipakai membandingkan hitungan kita
   dengan saldo yang dicetak bank. */
export function acctAtEnd(acct, s, d) {
  d = d || DATA;
  var t = d.acctStart[acct] || 0, all = allItems(d);
  for (var i = 0; i < all.length; i++) {
    if (all[i].s > s) continue;
    var it = all[i].it;
    if (isTf(it)) {
      var g = tfLegs(it), a = Math.abs(it.amt);
      if (g.from === acct) t -= a;
      if (g.to === acct) t += a;
    } else if (it.acct === acct) {
      t += it.amt;
    }
  }
  return t;
}

/* Selisih antara hitungan kita dan saldo yang dikatakan bank.
   0 = cocok. Positif = catatan kita kelebihan. Negatif = ada yang belum masuk. */
export function cpDiff(cp, d) {
  return acctAtEnd(cp.acct, cp.s, d) - cp.saldo;
}

export function cpAll(d) {
  d = d || DATA;
  return (d.checkpoints || []).slice().sort(function (a, b) { return a.s - b.s; });
}

export function cpLatest(acct, d) {
  var list = cpAll(d).filter(function (c) { return c.acct === acct; });
  return list.length ? list[list.length - 1] : null;
}

export function addCheckpoint(acct, s, saldo, src, d) {
  d = d || DATA;
  if (!d.checkpoints) d.checkpoints = [];
  /* Satu tanggal per akun: impor ulang berkas yang sama memperbarui, bukan
     menumpuk titik periksa kembar. */
  for (var i = 0; i < d.checkpoints.length; i++) {
    var c = d.checkpoints[i];
    if (c.acct === acct && c.s === s) {
      c.saldo = Math.round(saldo);
      c.src = src || c.src;
      return c;
    }
  }
  var nw = { id: 'c' + (++d.seq), acct: acct, s: s, saldo: Math.round(saldo),
             src: src || '', at: Date.now() };
  d.checkpoints.push(nw);
  return nw;
}

/* Selaraskan: geser saldo AWAL akun supaya hitungan kita mendarat persis di
   angka bank pada tanggal titik periksa. Yang digeser tetap satu-satunya
   angka uang yang memang kita simpan — bukan menambah sumber kebenaran baru. */
export function anchorAcct(cp, d) {
  d = d || DATA;
  var diff = cpDiff(cp, d);
  d.acctStart[cp.acct] = (d.acctStart[cp.acct] || 0) - diff;
  return -diff;
}

/* Nilai kelas 'cash' di net worth = Σ saldo akun. Bukan angka terpisah. */
export function cashTotal(d) {
  var b = acctBalances(d), t = 0;
  for (var k in b) {
    /* Akun utang bersaldo minus (GoPay Later) dihitung di Utang, bukan di sini — kalau tidak,
       utangnya terpotong dua kali dari kekayaan bersih. */
    if (LIAB_ACCTS.indexOf(k) >= 0 && b[k] < 0) continue;
    t += b[k];
  }
  return t;
}
