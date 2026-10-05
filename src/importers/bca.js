import { TF_CAT } from '../core/constants.js';
import { todayS } from '../core/dates.js';
import { mkTfAcct } from '../core/transfer.js';
import { mkStageRow } from '../features/staging.js';
import { findHeaderRow, normThousands, parseDateS, parseMoney, sniffDelim, splitCSVLine, splitLines } from './csvUtils.js';

/* =====================================================================
   BCA — dua dialek nyata.

   KlikBCA : delimiter koma, kolom Jumlah + DB/CR, tanggal 'dd/mm' TANPA tahun,
             preamble beberapa baris, footer rekap, baris berstatus PEND.
   myBCA   : delimiter titik koma, kolom Debet dan Kredit terpisah, tanggal
             lengkap.
   Dialek dideteksi, tidak ditanyakan — tapi kalau tak yakin, GAGAL dengan
   pesan, bukan menebak.
   ===================================================================== */
export var EWALLET = [
  [/\bGOPAY\b|\bGO-?PAY\b/i, 'GoPay'],
  [/\bOVO\b/i, 'OVO']
];

export var ATM_RE  = /TARIKAN ATM|TARIK TUNAI|ATM WITHDRAWAL|TUNAI ATM/i;

/* e-wallet yang TIDAK punya akun di app — jangan dipaksa jadi transfer */
export var EWALLET_LAIN = /\bDANA\b|SHOPEE ?PAY|LINKAJA|LINK ?AJA/i;

export function detectSource(text) {
  var lines = splitLines(text);
  if (!lines.length) return '';
  var joined = lines.slice(0, 12).join('\n').toLowerCase();
  var hi = findHeaderRow(lines, ['tanggal'], ['keterangan', 'jumlah', 'debet', 'kredit']);
  if (hi < 0) return '';
  var head = lines[hi].toLowerCase();
  var delim = sniffDelim(lines[hi]);
  if (delim === ';' && head.indexOf('debet') >= 0 && head.indexOf('kredit') >= 0) return 'mybca';
  if (head.indexOf('db/cr') >= 0 || head.indexOf('dbcr') >= 0) return 'klikbca';
  if (/no\.? ?rekening|klikbca|bca/.test(joined) && head.indexOf('jumlah') >= 0) return 'klikbca';
  return 'csv';
}

/* Tahun untuk tanggal 'dd/mm'. Diambil dari baris Periode kalau ada; kalau
   tidak, tahun berjalan. Bulan yang lebih kecil dari bulan awal periode berarti
   sudah menyeberang tahun (rekening Desember–Januari). */
export function bcaYearCtx(lines) {
  for (var i = 0; i < Math.min(lines.length, 15); i++) {
    var l = lines[i];
    if (!/periode|period/i.test(l)) continue;
    var m = l.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return { year: +m[3], startMonth: +m[2] };
  }
  var t = todayS();
  return { year: Math.floor(t / 10000), startMonth: 0 };
}

export function bcaResolveDate(dateS, ctx) {
  var m = String(dateS).match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (!m) return parseDateS(dateS, ctx.year);
  var day = +m[1], mon = +m[2], y = ctx.year;
  if (ctx.startMonth && mon < ctx.startMonth) y += 1;   // menyeberang tahun
  return y * 10000 + mon * 100 + day;
}

/* Keterangan BCA penuh kode mesin. Yang dibuang: apostrof awal, kode referensi
   (0107/FTSCY/WS95051), nominal yang ikut tercetak, dan spasi berlebih.
   Kalau hasilnya jadi kosong, keterangan asli dipakai — lebih baik berisik
   daripada kehilangan informasi. */
/* BCA sering MENEMPELKAN nominal ke nama merchant tanpa spasi:
     "...WS95051 500000.00GOPAY VINCENT"
   Akibatnya /\bGOPAY\b/ TIDAK cocok — antara '0' dan 'G' tidak ada batas kata.
   Semua pencocokan aturan dan pembersihan dilakukan SETELAH lem ini dipisah,
   kalau tidak aturan transfer akan diam-diam terlewat. */
export function bcaSplitGlue(s) {
  return String(s || '')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2');
}

export function cleanBCADesc(s) {
  var t = bcaSplitGlue(String(s || '').replace(/^'+/, '').trim());
  var out = t
    .replace(/\b\d{4}\/[A-Z0-9]+\/[A-Z0-9]+\b/gi, ' ')
    .replace(/\b\d+\.\d{2}\b/g, ' ')
    .replace(/\bTRSF E-BANKING\b\s*(DB|CR)?/gi, ' ')
    .replace(/\bSWITCHING\b\s*(DB|CR)?/gi, ' ')
    .replace(/\bKARTU DEBIT\b/gi, ' ')
    .replace(/\bDB\b|\bCR\b/g, ' ')
    .replace(/\bTRANSAKSI DEBIT\b/gi, ' ')
    .replace(/\bTGL:?\s*\d{1,2}\/\d{1,2}\b/gi, ' ')
    .replace(/\bQR\s*\d{2,4}\b/gi, ' ')
    .replace(/^[\s\d-]+/, '')          /* sisa nomor referensi di depan */
    .replace(/\s+-\s+-\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  /* Kalau yang tersisa tidak mengandung kata sama sekali (cuma sisa angka
     kode referensi), keterangan asli lebih berguna daripada "95051". */
  if (!/[A-Za-z]{2,}/.test(out)) return t;
  return out || t;
}

/* SATU tempat untuk aturan transfer & dugaan BCA. Jalur CSV dan jalur PDF
   memanggil fungsi yang sama — kalau tidak, dua jalur itu pasti melenceng
   satu sama lain suatu hari. */
export function bcaClassify(descRaw, amt, acct) {
  var d = bcaSplitGlue(descRaw || '');
  var out = { tfAcct: null, cat: null, forceCheck: false, hint: '' };
  if (amt >= 0) return out;
  for (var w = 0; w < EWALLET.length; w++) {
    if (EWALLET[w][0].test(d)) {
      out.tfAcct = mkTfAcct(acct, EWALLET[w][1]);
      out.cat = TF_CAT;
      out.forceCheck = true;
      out.hint = 'Diduga top up ' + EWALLET[w][1] + ' — pastikan';
      return out;
    }
  }
  if (ATM_RE.test(d)) {
    out.tfAcct = mkTfAcct(acct, 'Cash');
    out.cat = TF_CAT;
    out.forceCheck = true;
    out.hint = 'Tarikan ATM — dicatat sebagai pindah ke Cash';
    return out;
  }
  if (EWALLET_LAIN.test(d)) {
    /* dompet ini tidak punya akun di Arus, jadi TIDAK dipaksa jadi transfer —
       itu akan menciptakan kaki ke akun yang tidak ada. */
    out.forceCheck = true;
    out.hint = 'Dompet digital tanpa akun di Arus — dicatat sebagai pengeluaran';
  }
  return out;
}

export function parseBCA(text, acct) {
  acct = acct || 'BCA';
  var lines = splitLines(text);
  if (!lines.length) throw new Error('Berkas kosong.');
  var kind = detectSource(text);
  if (kind !== 'klikbca' && kind !== 'mybca')
    throw new Error('Ini tidak terbaca sebagai mutasi BCA. Pakai "Tempel teks CSV" untuk berkas umum.');

  var hi = findHeaderRow(lines, ['tanggal'], ['keterangan', 'jumlah', 'debet', 'kredit']);
  var delim = sniffDelim(lines[hi]);
  var head = splitCSVLine(normThousands(lines[hi]), delim).map(function (h) { return h.toLowerCase().trim(); });
  function col() {
    for (var a = 0; a < arguments.length; a++)
      for (var i = 0; i < head.length; i++) if (head[i].indexOf(arguments[a]) >= 0) return i;
    return -1;
  }
  var iDate = col('tanggal');
  var iDesc = col('keterangan', 'uraian', 'deskripsi');
  var iAmt  = col('jumlah', 'nominal');
  var iType = col('db/cr', 'dbcr');
  var iDeb  = col('debet', 'debit');
  var iCred = col('kredit', 'credit');
  if (iDate < 0 || iDesc < 0) throw new Error('Kolom Tanggal atau Keterangan tidak ada.');
  if (iAmt < 0 && iDeb < 0 && iCred < 0) throw new Error('Kolom nominal tidak ada.');

  var ctx = bcaYearCtx(lines);
  var rows = [], skipped = { pend: 0, footer: 0 };

  for (var li = hi + 1; li < lines.length; li++) {
    var raw = lines[li];
    var f = splitCSVLine(delim === ',' ? normThousands(raw) : raw, delim);
    var dateS = (f[iDate] || '').trim();

    /* Baris PEND = transaksi belum dibukukan. DILEWATI: kalau diimpor, nanti
       akan muncul lagi dengan tanggal sebenarnya dan jadi ganda. */
    if (/^PEND/i.test(dateS)) { skipped.pend++; continue; }
    /* Footer rekap (Saldo Awal / Mutasi Kredit / Saldo Akhir) bukan transaksi. */
    if (!dateS || /saldo awal|saldo akhir|mutasi (kredit|debet)|total/i.test(raw)) {
      skipped.footer++;
      continue;
    }
    var s = bcaResolveDate(dateS, ctx);
    if (!s) { skipped.footer++; continue; }

    var descRaw = bcaSplitGlue(f[iDesc] || '');
    var title = cleanBCADesc(f[iDesc] || '');

    /* --- arah uang --- */
    var amt = NaN, forceCheck = false, hint = '';
    if (iDeb >= 0 || iCred >= 0) {
      var dv = iDeb >= 0 ? parseMoney(f[iDeb]) : NaN;
      var cv = iCred >= 0 ? parseMoney(f[iCred]) : NaN;
      var hasD = !isNaN(dv) && dv !== 0, hasC = !isNaN(cv) && cv !== 0;
      if (hasD && hasC) { amt = -Math.abs(dv); forceCheck = true; hint = 'Debet dan kredit terisi dua-duanya'; }
      else if (hasD) amt = -Math.abs(dv);
      else if (hasC) amt = Math.abs(cv);
      else continue;                       /* dua-duanya kosong: bukan baris data */
    } else {
      var v = parseMoney(f[iAmt]);
      if (isNaN(v)) { skipped.footer++; continue; }
      var t = String(f[iType] || '').toUpperCase().trim();
      if (/^C|^K/.test(t)) amt = Math.abs(v);          /* CR -> pemasukan */
      else if (/^D/.test(t)) amt = -Math.abs(v);
      else {
        amt = -Math.abs(v);
        forceCheck = true;
        hint = 'Penanda DB/CR "' + (f[iType] || '') + '" tak dikenali';
      }
    }

    /* --- aturan transfer (satu fungsi, dipakai jalur CSV & PDF) --- */
    var cls = bcaClassify(descRaw, amt, acct);
    var tfAcct = cls.tfAcct, cat = cls.cat;
    if (cls.forceCheck) { forceCheck = true; hint = hint || cls.hint; }

    rows.push(mkStageRow({
      src: kind, s: s, dateS: dateS, title: title || '(tanpa keterangan)',
      raw: raw, desc: descRaw, amt: amt, acct: acct, cat: cat, tfAcct: tfAcct,
      forceCheck: forceCheck, hint: hint
    }));
  }
  if (!rows.length) throw new Error(
    'Tidak ada baris transaksi. ' + (skipped.pend ? skipped.pend + ' baris PEND dilewati. ' : '') +
    'Pastikan berkasnya mutasi rekening, bukan rekap saldo.');
  rows.skipped = skipped;
  return rows;
}
