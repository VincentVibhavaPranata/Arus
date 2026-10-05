import { ACCTS, LIAB_ACCTS } from './constants.js';
import { clampDay, sYm, todayS, ymAdd } from './dates.js';
import { acctBalances, allItems, cashTotal } from './derived.js';
import { fmtRp } from './money.js';
import { DATA } from './store.js';
import { isTf, tfLegs } from './transfer.js';
import { tradePnl } from '../features/trading.js';

/* =====================================================================
   NET WORTH — semuanya derived.
   Kelas 'cash' TIDAK punya baris manual: barisnya adalah akun, nilainya
   saldo berjalan. Inilah sebabnya saldo akun dan net worth tidak bisa
   melenceng — keduanya membaca angka yang sama.
   ===================================================================== */
export function assetClass(k, d) {
  d = d || DATA;
  for (var i = 0; i < d.networth.assets.length; i++)
    if (d.networth.assets[i].k === k) return d.networth.assets[i];
  return null;
}

/* Baris sebuah kelas. Untuk kas: dibangkitkan dari akun, bukan dibaca. */
export function classRows(k, d) {
  d = d || DATA;
  if (k !== 'cash') {
    var c = assetClass(k, d);
    return c && c.rows ? c.rows : [];
  }
  var bal = acctBalances(d);
  /* Akun utang (GoPay Later) bukan kas: tampil di Utang. Kalau saldonya positif
     (kelebihan bayar) barulah ia dihitung sebagai kas. */
  return ACCTS.filter(function (a) { return LIAB_ACCTS.indexOf(a) < 0 || bal[a] > 0; }).map(function (a) {
    return {
      id: 'acct:' + a,
      name: a,
      sub: 'awal ' + fmtRp(d.acctStart[a] || 0) + ' · live',
      amt: bal[a],
      derived: true
    };
  });
}

/* SETORAN BERSIH ke sebuah kelas — derived dari transaksi bertanda transfer.
   Masuk (+) kalau kelas ada di kaki tujuan, keluar (−) kalau di kaki asal.
   Inilah yang membuat "beli reksa dana" menggerakkan dua tempat sekaligus
   tanpa langkah manual yang bisa terlupa. */
export function contribTotal(k, d) {
  var all = allItems(d), t = 0;
  for (var i = 0; i < all.length; i++) {
    var it = all[i].it;
    if (!isTf(it)) continue;
    var g = tfLegs(it), a = Math.abs(it.amt);
    if (g.to === k) t += a;
    if (g.from === k) t -= a;
  }
  return t;
}

export function contribCount(k, d) {
  var all = allItems(d), n = 0;
  for (var i = 0; i < all.length; i++) {
    var it = all[i].it;
    if (!isTf(it)) continue;
    var g = tfLegs(it);
    if (g.to === k || g.from === k) n++;
  }
  return n;
}

/* Nilai kelas = setoran bersih (dari catatan) + penyesuaian nilai (fakta yang
   kamu catat sendiri). Dua fakta berbeda, masing-masing satu sumber; tidak ada
   yang dihitung dua kali. Kas tetap istimewa: seluruhnya derived dari akun. */
export function classTotal(k, d) {
  if (k === 'cash') return cashTotal(d);
  /* TIGA fakta berbeda, masing-masing satu sumber, tak ada yang dobel:
       setoran bersih  <- transaksi bertanda transfer
       hasil trading   <- PnL trade tertutup di jurnal (kalau kelas ini ditunjuk)
       penyesuaian     <- baris manual / hasil Selaraskan */
  var rows = classRows(k, d), t = contribTotal(k, d) + tradePnl(k, d);
  for (var i = 0; i < rows.length; i++) t += rows[i].amt || 0;
  return t;
}

export function adjTotal(k, d) {
  var rows = classRows(k, d), t = 0;
  for (var i = 0; i < rows.length; i++) t += rows[i].amt || 0;
  return t;
}

export function assetsTotal(d) {
  d = d || DATA;
  var t = 0;
  for (var i = 0; i < d.networth.assets.length; i++) t += classTotal(d.networth.assets[i].k, d);
  return t;
}

/* Utang yang dicatat lewat akun utang (saldo negatif), mis. GoPay Later. */
export function acctDebts(d) {
  d = d || DATA;
  var bal = acctBalances(d), out = [];
  LIAB_ACCTS.forEach(function (a) { if (bal[a] < 0) out.push({ name: a, amt: -bal[a] }); });
  return out;
}
export function acctDebtTotal(d) {
  return acctDebts(d).reduce(function (t, x) { return t + x.amt; }, 0);
}
export function liabTotal(d) {
  d = d || DATA;
  var t = 0, l = d.networth.liab || [];
  for (var i = 0; i < l.length; i++) t += Math.abs(l[i].amt || 0);
  return t + acctDebtTotal(d);
}

export function networthTotal(d) { return assetsTotal(d) - liabTotal(d); }

/* Alokasi AKTUAL per kelas, persen dari total aset (bukan dari net worth —
   utang bukan alokasi). Kelas bernilai negatif dianggap 0 supaya donat
   tidak menggambar irisan mundur. */
export function allocPct(d) {
  d = d || DATA;
  var tot = 0, vals = {}, i, k;
  for (i = 0; i < d.networth.assets.length; i++) {
    k = d.networth.assets[i].k;
    vals[k] = Math.max(0, classTotal(k, d));
    tot += vals[k];
  }
  var out = {};
  for (k in vals) out[k] = tot > 0 ? (vals[k] / tot) * 100 : 0;
  return out;
}

export function targetTotal(d) {
  d = d || DATA;
  var t = 0;
  for (var k in d.networth.targets) t += d.networth.targets[k];
  return t;
}

/* Saldo kas di AKHIR bulan ym — derived dari catatan, bukan snapshot.
   Transfer saling menghapus di tingkat total, tapi tetap dihitung dua kaki
   supaya jalurnya sama dengan acctBalances (satu cara menghitung saja). */
export function cashAtEnd(ym, d) {
  d = d || DATA;
  var end = clampDay(ym, 31), t = 0, i;
  var isCash = function (a) { return ACCTS.indexOf(a) >= 0 && LIAB_ACCTS.indexOf(a) < 0; };
  for (i = 0; i < ACCTS.length; i++) if (isCash(ACCTS[i])) t += d.acctStart[ACCTS[i]] || 0;
  var all = allItems(d);
  for (i = 0; i < all.length; i++) {
    if (all[i].s > end) continue;
    var it = all[i].it;
    if (isTf(it)) {
      var g = tfLegs(it), a = Math.abs(it.amt);
      if (isCash(g.from)) t -= a;
      if (isCash(g.to)) t += a;
    } else if (isCash(it.acct)) {
      t += it.amt;
    }
  }
  return t;
}

/* n bulan terakhir sampai bulan berjalan, terlama dulu. */
export function cashSeries(n, endYm, d) {
  var out = [], base = endYm || sYm(todayS());
  for (var i = n - 1; i >= 0; i--) {
    var ym = ymAdd(base, -i);
    out.push({ ym: ym, v: cashAtEnd(ym, d) });
  }
  return out;
}
