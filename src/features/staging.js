import { ACCTS } from '../core/constants.js';
import { allItems } from '../core/derived.js';
import { DATA, addItem } from '../core/store.js';
import { guessCat } from './categorize.js';

/* =====================================================================
   STAGING — alur seragam untuk SEMUA impor:
       parse -> staging -> layar Tinjau -> pilih -> commit
   Tidak ada impor yang boleh menulis langsung ke DATA.days. Satu pintu
   berarti dedup dan tinjauan tidak bisa dilewati oleh sumber baru.
   ===================================================================== */

/* Kunci dedup: tanggal + nominal + akun. Tiga hal ini yang benar-benar
   menandai "transaksi yang sama" di ekspor bank; keterangan sering berubah
   ejaannya antar-ekspor, jadi TIDAK dipakai. */
export function dedupKey(s, amt, acct) {
  return s + '|' + Math.round(amt) + '|' + String(acct || '');
}

/* BERAPA BANYAK catatan yang cocok, bukan sekadar ada atau tidak.
   Ini penting: kalau kamu benar-benar dua kali beli kopi Rp25.000 di hari yang
   sama, dua-duanya transaksi asli. Yang menandakan duplikat adalah JUMLAHNYA
   melebihi yang sudah tercatat. */
export function existingCounts(d) {
  d = d || DATA;
  var m = {}, all = allItems(d);
  for (var i = 0; i < all.length; i++) {
    var k = dedupKey(all[i].s, all[i].it.amt, all[i].it.acct);
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

/* Tandai state setiap baris staging. Dipanggil ulang setiap kali baris diubah
   supaya status 'dup' tidak pernah basi.

   Dedup dilakukan sebagai PENCOCOKAN JUMLAH, bukan pencocokan keberadaan:
     - N baris cocok dengan N catatan lama  -> N pertama dup, sisanya baru
     - dua baris identik dalam SATU berkas  -> dua-duanya asli
     - berkas yang sama diimpor DUA KALI    -> rombongan kedua dup
   Pembeda antara dua kasus terakhir adalah rombongan impornya (batch). */
export function restage(rows, d) {
  d = d || DATA;
  var have = existingCounts(d), used = {}, owner = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var key = dedupKey(r.s, r.amt, r.tfAcct || r.acct);
    var batch = r.batch == null ? 0 : r.batch;
    if (!r.s || isNaN(r.amt) || r.amt === 0) {
      r.state = 'check';
      r.hint = !r.s ? 'Tanggal tidak terbaca' : 'Nominal tidak terbaca';
    } else if ((used[key] || 0) < (have[key] || 0)) {
      used[key] = (used[key] || 0) + 1;
      r.state = 'dup';
      r.hint = 'Sudah ada di catatan';
    } else if (owner[key] != null && owner[key] !== batch) {
      r.state = 'dup';
      r.hint = 'Sudah ada di impor sebelumnya';
    } else if (r.forceCheck) {
      r.state = 'check';
      r.hint = r.hint || 'Perlu dipastikan';
    } else {
      r.state = 'auto';
      r.hint = '';
    }
    if (r.state !== 'dup' && owner[key] == null) owner[key] = batch;
    /* SATU aturan pilihan: hanya baris 'auto' yang tercentang. 'check' dan
       'dup' tidak — kalau baris yang perlu diperiksa ikut tercentang,
       tinjauannya jadi pura-pura. Aturan ini ditegakkan ulang setiap restage
       (supaya baris yang berubah jadi dup ikut terlepas), KECUALI kalau user
       sudah menyentuh baris itu sendiri — ditandai selAuto === false. */
    if (r.selAuto !== false) r.sel = (r.state === 'auto');
  }
  return rows;
}

export function stagingStats(rows) {
  var st = { total: rows.length, auto: 0, check: 0, dup: 0, sel: 0, selAmt: 0 };
  for (var i = 0; i < rows.length; i++) {
    st[rows[i].state]++;
    if (rows[i].sel) { st.sel++; st.selAmt += rows[i].amt || 0; }
  }
  return st;
}

/* Commit HANYA baris terpilih. Baris yang tidak dipilih tetap di staging —
   impor yang membuang sisa akan memaksa user mengulang dari nol. */
export function commitStaging() {
  var rows = DATA.staging.filter(function (r) { return r.sel && r.state !== 'dup'; });
  if (!rows.length) return 0;
  var n = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r.s || isNaN(r.amt) || r.amt === 0) continue;
    var o = { s: r.s, cat: r.cat, title: r.title, acct: r.tfAcct || r.acct, amt: r.amt };
    if (r.tfAcct) { o.transfer = true; }
    addItem(o);
    n++;
  }
  var done = {};
  for (i = 0; i < rows.length; i++) done[rows[i].sid] = 1;
  DATA.staging = DATA.staging.filter(function (r) { return !done[r.sid]; });
  restage(DATA.staging);
  return n;
}

export function mkStageRow(o) {
  return {
    sid: 's' + (++DATA.seq),
    src: o.src, s: o.s || 0, dateS: o.dateS || '', title: o.title || '',
    raw: o.raw || '', desc: o.desc || '', amt: o.amt, acct: o.acct || ACCTS[0],
    cat: o.cat || guessCat(o.title, o.amt),
    tfAcct: o.tfAcct || null,
    forceCheck: !!o.forceCheck, hint: o.hint || '',
    state: 'auto', sel: false, selAuto: true
  };
}
