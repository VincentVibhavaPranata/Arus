import { assetClass } from '../core/networth.js';
import { DATA } from '../core/store.js';
import { findHeaderRow, normThousands, parseMoney, sniffDelim, splitCSVLine, splitLines } from './csvUtils.js';

/* =====================================================================
   IMPOR PORTOFOLIO — upsert BY NAME ke satu kelas aset.
   Nilai masuk sebagai PENYESUAIAN, bukan menimpa setoran: setoran adalah
   fakta dari transaksi dan tidak boleh dihapus oleh sebuah berkas.
   ===================================================================== */
export function parseFolioCSV(text) {
  var lines = splitLines(text);
  if (!lines.length) throw new Error('Berkas kosong.');
  var hi = findHeaderRow(lines, ['nama'], ['nilai', 'value', 'jumlah', 'saldo', 'market']);
  if (hi < 0) hi = findHeaderRow(lines, ['name'], ['value', 'amount', 'market', 'balance']);
  if (hi < 0) hi = findHeaderRow(lines, ['efek'], ['nilai', 'value']);
  if (hi < 0) throw new Error(
    'Perlu kolom nama (Nama / Name / Efek) dan kolom nilai (Nilai / Value / Market).');

  var delim = sniffDelim(lines[hi]);
  var head = splitCSVLine(normThousands(lines[hi]), delim).map(function (h) { return h.toLowerCase(); });
  function col() {
    for (var a = 0; a < arguments.length; a++)
      for (var i = 0; i < head.length; i++) if (head[i].indexOf(arguments[a]) >= 0) return i;
    return -1;
  }
  var iName = col('nama', 'name', 'efek', 'aset', 'instrumen');
  var iVal  = col('nilai', 'value', 'market', 'saldo', 'jumlah', 'amount', 'balance');
  var iSub  = col('jumlah unit', 'unit', 'lot', 'qty', 'kuantitas', 'keterangan');
  if (iName < 0 || iVal < 0) throw new Error('Kolom nama atau nilai tidak ditemukan.');

  var out = [];
  for (var li = hi + 1; li < lines.length; li++) {
    var f = splitCSVLine(delim === ',' ? normThousands(lines[li]) : lines[li], delim);
    var nm = (f[iName] || '').trim();
    if (!nm) continue;
    var v = parseMoney(f[iVal]);
    if (isNaN(v)) throw new Error('Nilai tidak terbaca untuk "' + nm + '": "' + f[iVal] + '"');
    out.push({ name: nm, amt: v, sub: iSub >= 0 ? (f[iSub] || '').trim() : '' });
  }
  if (!out.length) throw new Error('Tidak ada baris data di bawah header.');
  return out;
}

/* Rencana upsert — dihitung dulu, ditampilkan, baru diterapkan. Tidak ada
   berkas yang boleh mengubah aset tanpa kamu melihat akibatnya lebih dulu. */
export function folioPlan(k, rows) {
  var cls = assetClass(k);
  var have = {}, plan = [];
  (cls.rows || []).forEach(function (r) { have[r.name.toLowerCase()] = r; });
  rows.forEach(function (r) {
    var ex = have[r.name.toLowerCase()];
    plan.push({
      name: r.name, sub: r.sub, amt: r.amt,
      kind: ex ? (ex.amt === r.amt ? 'same' : 'update') : 'new',
      old: ex ? ex.amt : null, id: ex ? ex.id : null
    });
  });
  return plan;
}

export function applyFolio(k, plan) {
  var cls = assetClass(k);
  if (!cls.rows) cls.rows = [];
  plan.forEach(function (p) {
    if (p.id != null) {
      for (var i = 0; i < cls.rows.length; i++)
        if (cls.rows[i].id === p.id) {
          cls.rows[i].amt = p.amt;
          if (p.sub) cls.rows[i].sub = p.sub;
        }
    } else {
      cls.rows.push({ id: 'a' + (++DATA.seq), name: p.name, sub: p.sub || '', amt: p.amt });
    }
  });
}
