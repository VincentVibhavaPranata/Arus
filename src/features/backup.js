import { catOf } from '../core/categories.js';
import { sToInput, todayS } from '../core/dates.js';
import { isNative } from '../core/native.js';
import { DATA } from '../core/store.js';
import { isTf } from '../core/transfer.js';

/* =====================================================================
   EKSPOR / IMPOR — jalan keluar tanpa server.
   ===================================================================== */
/* RFC-4180: bungkus dengan kutip kalau ada koma, kutip, atau baris baru;
   kutip di dalamnya digandakan. */
export function csvEscape(v) {
  var s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function buildCSV(d) {
  d = d || DATA;
  var rows = [['Tanggal', 'Kategori', 'Keterangan', 'Akun', 'Nominal', 'Transfer']];
  var days = d.days.slice().sort(function (a, b) { return a.s - b.s; });  /* naik, ramah spreadsheet */
  days.forEach(function (day) {
    day.items.slice().reverse().forEach(function (it) {
      rows.push([
        sToInput(day.s),
        catOf(it.cat, d).label,
        it.title || '',
        it.acct,
        String(it.amt),                     /* angka polos, tanpa titik ribuan */
        isTf(it) ? 'ya' : ''
      ]);
    });
  });
  /* BOM supaya Excel membaca UTF-8 dengan benar; CRLF sesuai RFC-4180. */
  return '﻿' + rows.map(function (r) {
    return r.map(csvEscape).join(',');
  }).join('\r\n') + '\r\n';
}

export function buildJSON(d) {
  d = d || DATA;
  /* Kunci PIN tinggal di key localStorage TERPISAH, jadi tidak mungkin ikut
     terbawa ke sini. Ini disengaja.
     Token sinkronisasi DIBUANG: cadangan sering dikirim lewat email atau
     disimpan di cloud, dan token itu kunci masuk ke servermu. */
  var out = JSON.parse(JSON.stringify(d));
  if (out.sync) out.sync = { url: out.sync.url || '', token: '', user: out.sync.user || '',
                             rev: 0, lastAt: 0 };
  return JSON.stringify({
    app: 'arus', v: d.v || 2, exportedAt: new Date().toISOString(), data: out
  }, null, 2);
}

/* Impor JSON: divalidasi keras. Berkas yang bukan ekspor Arus DITOLAK, bukan
   dipaksa masuk dan merusak data yang ada. */
export function parseBackup(text) {
  var o;
  try { o = JSON.parse(text); }
  catch (e) { throw new Error('Bukan JSON yang sah.'); }
  var d = o && o.data ? o.data : o;
  if (!d || typeof d !== 'object') throw new Error('Isi berkas tidak dikenali.');
  if (!Array.isArray(d.days)) throw new Error('Tidak ada daftar transaksi (days).');
  if (!d.acctStart || typeof d.acctStart !== 'object')
    throw new Error('Tidak ada saldo awal akun (acctStart).');
  for (var i = 0; i < d.days.length; i++) {
    var day = d.days[i];
    if (typeof day.s !== 'number' || !Array.isArray(day.items))
      throw new Error('Bentuk hari ke-' + (i + 1) + ' tidak sah.');
  }
  return d;
}

export function backupStats(d) {
  var n = 0;
  for (var i = 0; i < d.days.length; i++) n += d.days[i].items.length;
  return {
    items: n, days: d.days.length,
    cats: (d.cats || []).length, goals: (d.goals || []).length,
    recurring: (d.recurring || []).length
  };
}

/* Unduhan berkas. Kalau lingkungannya tidak mendukung (mis. jsdom), fungsi
   ini melapor gagal alih-alih melempar — pemanggil menawarkan salin manual. */
export function downloadText(name, text, mime) {
  /* WebView Android mengabaikan atribut download tanpa memberi tahu. Kalau
     tetap dicoba, user mengira berkasnya tersimpan padahal tidak ada apa-apa. */
  if (isNative()) return false;
  try {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return true;
  } catch (e) {
    return false;
  }
}

export function stampName(ext) {
  var t = todayS();
  return 'arus-' + Math.floor(t / 10000) + '-' +
         String(Math.floor(t / 100) % 100).padStart(2, '0') + '-' +
         String(t % 100).padStart(2, '0') + '.' + ext;
}
