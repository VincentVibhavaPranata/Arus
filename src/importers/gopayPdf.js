import { allItems } from '../core/derived.js';
import { mkTfAcct } from '../core/transfer.js';
import { TF_CAT } from '../core/constants.js';
import { sToD } from '../core/dates.js';
import { mkStageRow } from '../features/staging.js';

/* =====================================================================
   E-STATEMENT GOPAY (PDF) — pemetaan baris ke transaksi.

   Diukur dari berkas asli (kolom, x dalam satuan PDF):
     x ~ 21    Tanggal (dd/mm/yyyy, baris kedua = jam)
     x ~ 95    Transaksi (bisa 2 baris)
     x ~ 267   ID transaksi (terpotong 2 baris -> disambung)
     x ~ 381+  Metode pembayaran (1-2 nilai: GoPay Coins / GoPay Later / Tabungan by Jago)
     x ~ 507+  Jumlah, rata kanan: "-Rp45.050" | "Rp199.000" | "38" (angka polos = Coins)
   Satu transaksi = 2 baris fisik, dan metode/jumlah kadang sedikit lebih tinggi atau
   rendah dari tanggalnya, jadi baris dikelompokkan ke tanggal TERDEKAT, bukan berurutan.

   Aturan pencatatan (sesuai pilihan pemilik):
   - Tabungan by Jago      -> akun GoPay
   - GoPay Later           -> akun "GoPay Later" (saldo minus = utang)
   - "GoPay Tabungan top up" -> transfer BCA -> GoPay. Pasangannya SUDAH dicatat impor BCA,
        jadi dicocokkan (nominal sama, +-2 hari). Cocok -> otomatis duplikat. Tidak ada
        pasangan -> ditandai "perlu dicek" dan tidak tercentang, supaya tidak dobel.
   - "GoTagihan"           -> transfer GoPay -> GoPay Later (bayar tagihan Later)
   - Coins (baris angka polos) bukan rupiah -> dilewati. Header GoPay pun tidak
        menghitungnya sebagai pemasukan.
   - Pembayaran campuran (Coins + metode lain): dicatat PENUH di metode non-Coins. Coins
        tidak dirinci per transaksi di statement, jadi tidak ada yang dikarang.
   ===================================================================== */

var RX_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
var RX_RP = /^(-?)\s*Rp\s*([\d.]+)$/;

function rupiah(str) {
  var m = RX_RP.exec(String(str).trim());
  if (!m) return null;
  var v = parseInt(m[2].replace(/\./g, ''), 10);
  return isNaN(v) ? null : (m[1] ? -v : v);
}
function plainInt(str) {
  return /^\d+$/.test(String(str).trim()) ? parseInt(str, 10) : null;
}

export function isGoPayPdf(pages) {
  var txt = '';
  for (var p = 0; p < Math.min(1, pages.length); p++)
    for (var i = 0; i < pages[p].lines.length; i++) txt += pages[p].lines[i].cols.map(function (c) { return c.s; }).join(' ') + '\n';
  return /ID transaksi/.test(txt) && /Metode pembayaran/.test(txt) && /E-statement|gopay/i.test(txt);
}

/* Total di header: baris label "Total Coins didapatkan ... Total pengeluaran", lalu baris nilainya.
   Urutannya tetap: [coins didapat, coins dipakai, pemasukan, pengeluaran]. */
function readHeaderTotals(page) {
  var L = page.lines, li = -1, i;
  for (i = 0; i < L.length; i++) if (/Total pemasukan/.test(L[i].cols.map(function (c) { return c.s; }).join(' '))) { li = i; break; }
  if (li < 0) return null;
  var labelY = L[li].y, best = null;
  for (i = 0; i < L.length; i++) {
    var d = labelY - L[i].y;
    if (d > 2 && d < 25) {
      var nums = L[i].cols.filter(function (c) { return /^(Rp)?[\d.]+$/.test(c.s); })
        .sort(function (a, b) { return a.x - b.x; });
      if (nums.length >= 4 && (!best || d < best.d)) best = { d: d, nums: nums };
    }
  }
  if (!best) return null;
  var n = best.nums.map(function (c) { return /^Rp/.test(c.s) ? rupiah(c.s) : plainInt(c.s); });
  return { coinsEarned: n[0], coinsUsed: n[1], pemasukan: n[2], pengeluaran: n[3] };
}

/* Jarak hari antara dua penanda tanggal s (yyyymmdd). */
function dayDiff(a, b) { return Math.abs(Math.round((sToD(a) - sToD(b)) / 86400000)); }

/* Parse seluruh dokumen -> baris staging. rows.recon & rows.skipped terisi. */
export function parseGoPayPdf(pages) {
  var rows = [], totals = null, recs = [], pi;

  for (pi = 0; pi < pages.length; pi++) {
    var L = pages[pi].lines.slice().sort(function (a, b) { return b.y - a.y; });
    if (pi === 0) totals = readHeaderTotals(pages[0]);

    /* posisi kolom dari baris judul tabel; cadangan = ukuran berkas asli */
    var hdr = null, i;
    for (i = 0; i < L.length; i++)
      if (L[i].cols.some(function (c) { return c.s === 'Tanggal'; }) && L[i].cols.some(function (c) { return c.s === 'Jumlah'; })) { hdr = L[i]; break; }
    if (!hdr) continue;
    var xOf = function (re, fb) { var c = hdr.cols.filter(function (q) { return re.test(q.s); })[0]; return c ? c.x : fb; };
    var X = { title: xOf(/^Transaksi$/, 95) - 6, id: xOf(/^ID/, 267) - 6, method: xOf(/^Metode/, 381) - 6, amt: xOf(/^Jumlah$/, 507) - 8 };

    var body = L.filter(function (l) { return l.y < hdr.y - 1; });
    var anchors = body.filter(function (l) { return l.cols.some(function (c) { return c.x < X.title && RX_DATE.test(c.s); }); });
    if (!anchors.length) continue;
    var ay = anchors.map(function (a) { return a.y; });          // menurun

    var blocks = anchors.map(function () { return []; });
    body.forEach(function (l) {
      var k = 0, bd = Infinity;
      for (var q = 0; q < ay.length; q++) { var dd = Math.abs(l.y - ay[q]); if (dd < bd) { bd = dd; k = q; } }
      blocks[k].push(l);
    });

    blocks.forEach(function (lines) {
      lines.sort(function (a, b) { return b.y - a.y; });
      var rec = { date: '', time: '', title: [], id: [], methods: [], amtTxt: '' };
      lines.forEach(function (l) {
        l.cols.slice().sort(function (a, b) { return a.x - b.x; }).forEach(function (c) {
          if (c.x < X.title) { if (RX_DATE.test(c.s)) rec.date = c.s; else if (/^\d{2}:\d{2}$/.test(c.s)) rec.time = c.s; }
          else if (c.x < X.id) rec.title.push(c.s);
          else if (c.x < X.method) rec.id.push(c.s);
          else if (c.x < X.amt) { if (/^(GoPay Coins|GoPay Later|Tabungan by Jago)$/.test(c.s)) rec.methods.push(c.s); }
          else rec.amtTxt = c.s;
        });
      });
      recs.push(rec);
    });
  }

  /* pasangan top up: transfer BCA->GoPay yang SUDAH ada di catatan (hasil impor BCA) */
  var tfKey = mkTfAcct('BCA', 'GoPay');
  var existing = allItems().filter(function (x) { return x.it.transfer === true && x.it.acct === tfKey; })
    .map(function (x) { return { s: x.s, amt: Math.abs(x.it.amt), used: false }; });

  var skipped = { coins: 0, unreadable: 0 };
  var sumIn = 0, sumOut = 0;

  recs.forEach(function (r) {
    var dm = RX_DATE.exec(r.date);
    var title = r.title.join(' ').replace(/\s+/g, ' ').trim();
    var id = r.id.join('');
    var v = rupiah(r.amtTxt);
    if (!dm || !title) { skipped.unreadable++; return; }
    if (v == null) {                                     // angka polos = Coins, bukan rupiah
      if (plainInt(r.amtTxt) != null) skipped.coins++; else skipped.unreadable++;
      return;
    }
    var s = parseInt(dm[3], 10) * 10000 + parseInt(dm[2], 10) * 100 + parseInt(dm[1], 10);
    var later = r.methods.indexOf('GoPay Later') >= 0;
    if (v > 0) sumIn += v; else sumOut += -v;

    var o = { src: 'gopay-pdf', s: s, dateS: r.date + (r.time ? ' ' + r.time : ''), title: title, raw: id, desc: title,
              amt: v, acct: later ? 'GoPay Later' : 'GoPay' };

    if (/^gopay tabungan top ?up$/i.test(title) && v > 0) {
      o.amt = -v;                                        // konvensi transfer: kaki asal negatif
      o.tfAcct = tfKey; o.acct = 'BCA'; o.cat = TF_CAT;
      var best = null;
      existing.forEach(function (e) {
        if (!e.used && e.amt === v && dayDiff(e.s, s) <= 2 && (!best || dayDiff(e.s, s) < dayDiff(best.s, s))) best = e;
      });
      if (best) { best.used = true; o.s = best.s; }      // selaraskan tanggal -> terdeteksi duplikat otomatis
      else { o.forceCheck = true; o.hint = 'Pasangannya belum ada di catatan BCA — impor mutasi BCA dulu agar tidak dobel'; }
    } else if (/^gotagihan$/i.test(title) && v < 0) {
      o.tfAcct = mkTfAcct('GoPay', 'GoPay Later'); o.acct = 'GoPay'; o.cat = TF_CAT;
      o.title = 'Bayar tagihan GoPay Later (GoTagihan)';
    } else if (/^bunga$/i.test(title) && v > 0) {
      o.title = 'Bunga Tabungan by Jago'; o.cat = 'bonus';
    } else if (/^pajak atas bunga$/i.test(title) && v < 0) {
      o.cat = 'tagihan';
    }
    rows.push(mkStageRow(o));
  });

  /* Rekonsiliasi dengan total di header. Pengeluaran header = total keluar - Coins yang dipakai
     (Coins ikut dihitung di nominal per baris, tapi tidak dirinci per transaksi). */
  var recon = { gopay: true, cocok: null, pemasukan: sumIn, pengeluaran: sumOut, header: totals,
                coinsUsed: totals ? totals.coinsUsed : null, selisih: null, ym: 0 };
  if (totals) {
    var dIn = sumIn - totals.pemasukan;
    var dOut = sumOut - totals.coinsUsed - totals.pengeluaran;
    recon.selisih = Math.abs(dIn) + Math.abs(dOut);
    recon.cocok = dIn === 0 && dOut === 0;
  }
  rows.recon = recon;
  rows.skipped = skipped;
  return rows;
}
