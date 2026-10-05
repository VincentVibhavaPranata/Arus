import { guessCat } from '../features/categorize.js';
import { mkStageRow } from '../features/staging.js';
import { bcaClassify, cleanBCADesc } from './bca.js';
import { parseVal } from './csvUtils.js';

/* =====================================================================
   E-STATEMENT BCA (PDF) — pemetaan baris ke transaksi.

   Tata letak yang benar-benar dipakai BCA (diukur dari berkas asli):
     x <  60   TANGGAL   dd/mm
     x <  370  KETERANGAN (termasuk kolom detail di x≈194 dan CBG di x≈310)
     x <  435  MUTASI    nominal, rata kanan
     x <  480  penanda   "DB" kalau debit; KOSONG artinya kredit
     x >= 480  SALDO     saldo berjalan (tidak dicetak di setiap baris)

   Baris tanpa tanggal adalah LANJUTAN keterangan transaksi di atasnya.
   ===================================================================== */
export var BULAN_NAMA = { JANUARI:1, FEBRUARI:2, MARET:3, APRIL:4, MEI:5, JUNI:6, JULI:7,
                   AGUSTUS:8, SEPTEMBER:9, OKTOBER:10, NOVEMBER:11, DESEMBER:12 };

export function bcaPdfCol(x) {
  return x < 60 ? 'tgl' : x < 370 ? 'ket' : x < 435 ? 'jml' : x < 480 ? 'tanda' : 'saldo';
}

export function parseBCAPdf(pages, acct) {
  acct = acct || 'BCA';
  var all = [];
  pages.forEach(function (p) { p.lines.forEach(function (l) { all.push(l); }); });

  var ym = 0;
  for (var i = 0; i < all.length; i++) {
    var mp = all[i].text.match(/PERIODE\s*:?\s*([A-Z]+)\s+(\d{4})/i);
    if (mp && BULAN_NAMA[mp[1].toUpperCase()]) ym = (+mp[2]) * 100 + BULAN_NAMA[mp[1].toUpperCase()];
  }
  if (!ym) throw new Error(
    'Baris "PERIODE : <BULAN> <TAHUN>" tidak ditemukan. Pastikan ini e-statement BCA.');

  var rows = [], saldoAwal = null, saldoAkhir = null, last = null, lastRaw = null;
  for (i = 0; i < all.length; i++) {
    var g = { tgl: [], ket: [], jml: [], tanda: [], saldo: [] };
    all[i].cols.forEach(function (c) { g[bcaPdfCol(c.x)].push(c.s); });
    var t = (g.tgl[0] || '').match(/^(\d{2})\/(\d{2})$/);

    if (!t) {
      /* lanjutan keterangan — tempelkan ke transaksi terakhir */
      var ketX = g.ket.join(' ').trim();
      if (last && ketX && !g.jml.length &&
          !/^(TANGGAL|SALDO|MUTASI|CATATAN|Bersambung|Rekening|telah|BCA|HALAMAN|PERIODE|MATA UANG|NO\.)/i.test(ketX)) {
        lastRaw += ' ' + ketX;
        last.title = cleanBCADesc(lastRaw);
        var re = bcaClassify(lastRaw, last.amt, acct);
        if (re.tfAcct) { last.tfAcct = re.tfAcct; last.cat = re.cat; }
        if (re.forceCheck) { last.forceCheck = true; last.hint = re.hint; }
        /* Nama merchant BCA ada di baris LANJUTAN ("QR 200 … WARTEG GRA"),
           jadi dugaan kategori WAJIB dihitung ulang setelah ditempel — kalau
           tidak, hampir semua transaksi QR akan jatuh ke Lain-lain. */
        if (!last.tfAcct) last.cat = guessCat(last.title, last.amt);
        last.raw = lastRaw;
      }
      continue;
    }
    var ket = g.ket.join(' ').trim();
    if (/^SALDO AWAL/i.test(ket)) {
      saldoAwal = parseVal(g.saldo[0] || g.jml[0]);
      last = null;
      continue;
    }
    if (!g.jml.length) { last = null; continue; }
    var mag = parseVal(g.jml[g.jml.length - 1]);
    if (isNaN(mag)) { last = null; continue; }

    /* Penanda "DB" = keluar. KOSONG = masuk (kredit). Ini kesepakatan BCA,
       bukan tebakan: 72 dari 77 baris di berkas contoh bertanda DB, dan
       kelima sisanya memang transfer masuk. */
    var db = g.tanda.some(function (x) { return /^DB$/i.test(x); });
    var cr = g.tanda.some(function (x) { return /^CR$/i.test(x); });
    var amt = (db || (!cr && /\bDB\b/.test(ket))) ? -Math.abs(mag) : Math.abs(mag);

    var day = +t[1], mon = +t[2], year = Math.floor(ym / 100);
    if (mon < ym % 100) year += 1;             /* rekening menyeberang tahun */
    var s = year * 10000 + mon * 100 + day;

    var saldo = g.saldo.length ? parseVal(g.saldo[g.saldo.length - 1]) : null;
    if (saldo != null && !isNaN(saldo)) saldoAkhir = saldo;

    var cls = bcaClassify(ket, amt, acct);
    var row = mkStageRow({
      src: 'bca-pdf', s: s, dateS: t[0], title: cleanBCADesc(ket), raw: ket, desc: ket,
      amt: Math.round(amt), acct: acct, cat: cls.cat, tfAcct: cls.tfAcct,
      forceCheck: cls.forceCheck, hint: cls.hint
    });
    row.saldo = (saldo != null && !isNaN(saldo)) ? saldo : null;
    rows.push(row);
    last = row;
    lastRaw = ket;
  }
  if (!rows.length) throw new Error('Tidak ada baris transaksi di PDF ini.');

  /* REKONSILIASI: kolom Saldo adalah kebenaran yang ditulis bank sendiri.
     Kalau rantainya tidak nyambung, ada nominal yang salah baca — dan itu
     HARUS dikatakan, bukan didiamkan. */
  rows.recon = { ym: ym, saldoAwal: saldoAwal, saldoAkhir: saldoAkhir,
                 cocok: null, selisih: 0, titik: 0, meleset: 0 };
  if (saldoAwal != null && !isNaN(saldoAwal)) {
    var jalan = saldoAwal;
    for (i = 0; i < rows.length; i++) {
      jalan += rows[i].amt;
      if (rows[i].saldo != null) {
        rows.recon.titik++;
        if (Math.abs(jalan - rows[i].saldo) > 0.5) rows.recon.meleset++;
      }
    }
    if (saldoAkhir != null) {
      rows.recon.selisih = jalan - saldoAkhir;
      rows.recon.cocok = Math.abs(rows.recon.selisih) < 0.5 && rows.recon.meleset === 0;
    }
  }
  return rows;
}
