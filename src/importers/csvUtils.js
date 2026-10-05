import { todayS } from '../core/dates.js';

/* =====================================================================
   UTILITAS CSV — dipakai semua impor (portofolio v0.4, BCA v0.5).
   Bagian ini yang paling gampang salah, jadi aturannya ditulis eksplisit.
   ===================================================================== */

/* RFC-4180: kutip ganda membungkus, "" di dalam kutip = satu kutip literal. */
export function splitCSVLine(line, delim) {
  var out = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(function (s) { return s.trim(); });
}

/* Delimiter di-sniff dari BARIS HEADER, bukan diasumsikan. Yang menang adalah
   yang paling banyak muncul di luar kutip. */
export function sniffDelim(line) {
  var n = { ',': 0, ';': 0, '\t': 0 }, inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && ch in n) n[ch]++;
  }
  var best = ',', bv = -1;
  for (var k in n) if (n[k] > bv) { bv = n[k]; best = k; }
  return bv === 0 ? ',' : best;
}

/* KOMA RIBUAN TANPA KUTIP.
   Pada delimiter koma, "1,500,000" tanpa kutip harus dinormalkan SEBELUM
   dipecah. Normalisasinya PER-TOKEN ANGKA UTUH — bukan per-digit. Regex
   per-digit (mis. /(\d),(\d)/) akan memakan koma pemisah kolom yang berada
   di sebelah field numerik: "100,Kopi" jadi "100Kopi". Itu bug nyata.
   Bagian di dalam kutip tidak disentuh: di sana koma memang literal. */
export function normThousands(line) {
  function fix(s) {
    return s.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, function (m) {
      return m.replace(/,/g, '');
    });
  }
  var out = '', buf = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (!inQ) { out += fix(buf); buf = ''; }
      inQ = !inQ;
      out += ch;
      continue;
    }
    if (inQ) out += ch; else buf += ch;
  }
  return out + fix(buf);
}

/* parseVal: locale-aware. ATURAN — pemisah TERAKHIR menentukan.
     ekor 3 digit  -> pemisah itu RIBUAN, semua pemisah dibuang
                      "1.500.000" -> 1500000 ; "1,500" -> 1500
     ekor != 3     -> pemisah itu DESIMAL
                      "100,000.00" -> 100000 ; "1.500,75" -> 1500.75
   Negatif: tanda minus di depan/belakang, atau dibungkus tanda kurung.
   Bukan angka -> NaN. Pemanggil WAJIB memeriksa; dilarang menebak 0. */
export function parseVal(str) {
  var s = String(str == null ? '' : str).trim();
  if (!s) return NaN;
  var neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/^(rp|idr)\s*/i, '');
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }
  if (/^-/.test(s)) { neg = true; s = s.slice(1); }
  s = s.replace(/[^0-9.,]/g, '');
  if (!/[0-9]/.test(s)) return NaN;

  var last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  var val;
  if (last < 0) {
    val = parseFloat(s);
  } else {
    var tail = s.slice(last + 1);
    if (tail.length === 3) {
      val = parseFloat(s.replace(/[.,]/g, ''));
    } else {
      val = parseFloat(s.slice(0, last).replace(/[.,]/g, '') + '.' + tail);
    }
  }
  if (isNaN(val)) return NaN;
  return neg ? -val : val;
}

/* Uang selalu integer rupiah. NaN diteruskan supaya kegagalan tidak diam-diam
   berubah jadi nol. */
export function parseMoney(str) {
  var v = parseVal(str);
  return isNaN(v) ? NaN : Math.round(v);
}

/* Cari baris header berdasarkan KATA KUNCI, jangan asumsikan nomor barisnya:
   ekspor bank punya preamble yang panjangnya berubah-ubah. */
export function findHeaderRow(lines, must, anyOf) {
  for (var i = 0; i < lines.length; i++) {
    var low = lines[i].toLowerCase();
    var okAll = must.every(function (w) { return low.indexOf(w) >= 0; });
    if (!okAll) continue;
    if (!anyOf || !anyOf.length) return i;
    if (anyOf.some(function (w) { return low.indexOf(w) >= 0; })) return i;
  }
  return -1;
}

export function splitLines(text) {
  return String(text || '').replace(/\r\n?/g, '\n').split('\n')
    .filter(function (l) { return l.trim() !== ''; });
}

/* Tanggal dari berbagai bentuk -> integer YYYYMMDD, atau 0 kalau tak yakin.
   yearHint dipakai untuk 'dd/mm' tanpa tahun (KlikBCA). */
export function parseDateS(str, yearHint) {
  var s = String(str == null ? '' : str).trim();
  if (!s) return 0;
  var m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))
    return (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3]);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) {
    var y = +m[3];
    if (y < 100) y += y < 70 ? 2000 : 1900;
    return y * 10000 + (+m[2]) * 100 + (+m[1]);
  }
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})$/))) {
    var yh = yearHint || Math.floor(todayS() / 10000);
    return yh * 10000 + (+m[2]) * 100 + (+m[1]);
  }
  return 0;
}
