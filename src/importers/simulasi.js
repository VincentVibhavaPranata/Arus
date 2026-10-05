import { TF_CAT } from '../core/constants.js';
import { grp } from '../core/money.js';
import { assetClass } from '../core/networth.js';
import { mkTfAcct } from '../core/transfer.js';
import { mkStageRow } from '../features/staging.js';
import { findHeaderRow, normThousands, parseDateS, parseMoney, parseVal, sniffDelim, splitCSVLine, splitLines } from './csvUtils.js';

/* ==================== SIMULASI BERLABEL (GoPay & Bybit) ====================
   Integrasi API sungguhan belum ada. Yang ada: data CONTOH berbentuk asli,
   dijalankan lewat parser sungguhan supaya jalur kodenya nyata. Setiap baris
   diberi hint 'simulasi' dan kartunya berlabel di UI — dilarang terlihat
   seperti sambungan hidup. */
export var SAMPLE_GOPAY = [
  'Tanggal,Waktu,Deskripsi,Nominal,Tipe',
  '01/07/2026,08:12,GoRide ke kantor,32.000,Pengeluaran',
  '01/07/2026,12:40,GoFood - Ayam Geprek,45.500,Pengeluaran',
  '02/07/2026,09:03,Top Up dari BCA,500.000,Pemasukan',
  '03/07/2026,19:22,GoPay Later - cicilan,150.000,Pengeluaran'
].join('\n');

export var SAMPLE_BYBIT = [
  'Time,Type,Coin,Amount,Status',
  '2026-07-02 10:15:00,Deposit,USDT,120.00,Success',
  '2026-07-05 14:02:00,Withdrawal,USDT,40.00,Success'
].join('\n');

export function parseGoPay(text) {
  var lines = splitLines(text);
  var hi = findHeaderRow(lines, ['tanggal'], ['deskripsi', 'nominal']);
  if (hi < 0) throw new Error('Format GoPay tidak dikenali.');
  var delim = sniffDelim(lines[hi]);
  var head = splitCSVLine(lines[hi], delim).map(function (h) { return h.toLowerCase(); });
  function col(w) { for (var i = 0; i < head.length; i++) if (head[i].indexOf(w) >= 0) return i; return -1; }
  var iD = col('tanggal'), iT = col('deskripsi'), iA = col('nominal'), iK = col('tipe');
  var rows = [];
  for (var li = hi + 1; li < lines.length; li++) {
    var f = splitCSVLine(delim === ',' ? normThousands(lines[li]) : lines[li], delim);
    if (!f[iD]) continue;
    var v = parseMoney(f[iA]);
    if (isNaN(v)) continue;
    var masuk = /pemasukan|top ?up|masuk|credit/i.test(f[iK] || '');
    var title = (f[iT] || '').trim();
    var tf = null, cat = null;
    /* Top up dari BCA itu perpindahan, bukan pemasukan baru. */
    if (masuk && /dari BCA|top ?up/i.test(title)) {
      tf = mkTfAcct('BCA', 'GoPay');
      cat = TF_CAT;
    }
    rows.push(mkStageRow({
      src: 'gopay', s: parseDateS(f[iD]), dateS: f[iD], title: title,
      raw: lines[li], desc: title, amt: tf ? -Math.abs(v) : (masuk ? Math.abs(v) : -Math.abs(v)),
      acct: 'GoPay', cat: cat, tfAcct: tf,
      forceCheck: true, hint: 'Data simulasi — bukan sambungan GoPay sungguhan'
    }));
  }
  if (!rows.length) throw new Error('Tidak ada baris GoPay yang terbaca.');
  return rows;
}

export function parseBybit(text, rate) {
  rate = rate || 16000;                    /* kurs contoh, bagian dari simulasi */
  var lines = splitLines(text);
  var hi = findHeaderRow(lines, ['time'], ['type', 'amount']);
  if (hi < 0) throw new Error('Format Bybit tidak dikenali.');
  var delim = sniffDelim(lines[hi]);
  var head = splitCSVLine(lines[hi], delim).map(function (h) { return h.toLowerCase(); });
  function col(w) { for (var i = 0; i < head.length; i++) if (head[i].indexOf(w) >= 0) return i; return -1; }
  var iT = col('time'), iK = col('type'), iA = col('amount'), iC = col('coin');
  var kripto = assetClass('kripto') ? 'kripto' : null;
  if (!kripto) throw new Error('Belum ada kelas aset "Kripto" di layar Akun.');
  var rows = [];
  for (var li = hi + 1; li < lines.length; li++) {
    var f = splitCSVLine(lines[li], delim);
    if (!f[iT]) continue;
    var v = parseVal(f[iA]);
    if (isNaN(v)) continue;
    var isDep = /deposit|masuk/i.test(f[iK] || '');
    var rp = Math.round(Math.abs(v) * rate);
    rows.push(mkStageRow({
      src: 'bybit', s: parseDateS(String(f[iT]).slice(0, 10)), dateS: String(f[iT]).slice(0, 10),
      title: (isDep ? 'Setor ' : 'Tarik ') + Math.abs(v) + ' ' + (f[iC] || 'USDT') + ' (Bybit)',
      raw: lines[li], amt: -rp, acct: 'BCA', cat: 'investasi',
      tfAcct: isDep ? mkTfAcct('BCA', kripto) : mkTfAcct(kripto, 'BCA'),
      forceCheck: true,
      hint: 'Simulasi · kurs contoh Rp' + grp(rate) + '/USDT — periksa nominalnya'
    }));
  }
  if (!rows.length) throw new Error('Tidak ada baris Bybit yang terbaca.');
  return rows;
}
