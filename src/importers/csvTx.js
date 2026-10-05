import { mkStageRow } from '../features/staging.js';
import { findHeaderRow, normThousands, parseDateS, parseMoney, sniffDelim, splitCSVLine, splitLines } from './csvUtils.js';

/* =====================================================================
   IMPOR — parser CSV transaksi generik.
   Prinsip: kalau arah uang tidak jelas, baris DITANDAI 'check', bukan ditebak.
   ===================================================================== */
export function parseTxCSV(text, acct) {
  var lines = splitLines(text);
  if (!lines.length) throw new Error('Berkas kosong.');

  var hi = findHeaderRow(lines, ['tanggal'], ['keterangan', 'jumlah', 'debet', 'nominal', 'uraian']);
  if (hi < 0) hi = findHeaderRow(lines, ['date'], ['description', 'amount', 'debit']);
  if (hi < 0) throw new Error(
    'Baris header tidak ditemukan. Perlu kolom "Tanggal" dan salah satu dari ' +
    '"Keterangan" / "Jumlah" / "Nominal".');

  var delim = sniffDelim(lines[hi]);
  var head = splitCSVLine(normThousands(lines[hi]), delim).map(function (h) { return h.toLowerCase(); });
  function col() {
    for (var a = 0; a < arguments.length; a++) {
      var want = arguments[a];
      for (var i = 0; i < head.length; i++) if (head[i].indexOf(want) >= 0) return i;
    }
    return -1;
  }
  var iDate = col('tanggal', 'date');
  var iDesc = col('keterangan', 'uraian', 'description', 'deskripsi', 'catatan');
  var iAmt  = col('jumlah', 'nominal', 'amount', 'nilai');
  var iDeb  = col('debet', 'debit');
  var iCred = col('kredit', 'credit');
  var iType = col('db/cr', 'dbcr', 'tipe', 'type');

  if (iDate < 0) throw new Error('Kolom tanggal tidak ada.');
  if (iAmt < 0 && iDeb < 0 && iCred < 0)
    throw new Error('Tidak ada kolom nominal (Jumlah / Debet / Kredit).');

  var rows = [];
  for (var li = hi + 1; li < lines.length; li++) {
    var raw = lines[li];
    var f = splitCSVLine(delim === ',' ? normThousands(raw) : raw, delim);
    if (f.length < 2) continue;
    var dateS = f[iDate] || '';
    if (!dateS) continue;
    var s = parseDateS(dateS);
    var title = (iDesc >= 0 ? f[iDesc] : '').replace(/\s+/g, ' ').trim();

    var amt = NaN, forceCheck = false, hint = '';
    if (iDeb >= 0 || iCred >= 0) {
      var dv = iDeb >= 0 ? parseMoney(f[iDeb]) : NaN;
      var cv = iCred >= 0 ? parseMoney(f[iCred]) : NaN;
      var hasD = !isNaN(dv) && dv !== 0, hasC = !isNaN(cv) && cv !== 0;
      if (hasD && hasC) { forceCheck = true; hint = 'Debet dan kredit terisi dua-duanya'; amt = -Math.abs(dv); }
      else if (hasD) amt = -Math.abs(dv);
      else if (hasC) amt = Math.abs(cv);
    } else {
      var v = parseMoney(f[iAmt]);
      if (!isNaN(v)) {
        if (iType >= 0) {
          var t = String(f[iType]).toUpperCase();
          if (/^C|CR|K|KREDIT/.test(t)) amt = Math.abs(v);
          else if (/^D|DB|DEBET|DEBIT/.test(t)) amt = -Math.abs(v);
          else { amt = v; forceCheck = true; hint = 'Penanda arah "' + f[iType] + '" tak dikenali'; }
        } else if (v > 0) {
          /* Tanpa kolom arah dan nilainya positif, arah uang TIDAK PASTI.
             Diasumsikan pengeluaran tapi ditandai supaya diperiksa mata. */
          amt = -v;
          forceCheck = true;
          hint = 'Arah uang tidak ada di berkas — dianggap pengeluaran';
        } else {
          amt = v;
        }
      }
    }
    if (!title && isNaN(amt)) continue;
    rows.push(mkStageRow({
      src: 'csv', s: s, dateS: dateS, title: title || '(tanpa keterangan)',
      raw: raw, desc: title, amt: amt, acct: acct, forceCheck: forceCheck, hint: hint
    }));
  }
  if (!rows.length) throw new Error('Tidak ada baris data di bawah header.');
  return rows;
}
