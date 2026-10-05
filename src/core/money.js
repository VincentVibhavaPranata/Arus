/* ============================ UTIL UANG ============================ */
/* Rupiah, titik ribuan, TANPA desimal. fmtRp(2500000) -> 'Rp2.500.000' */
export function grp(n) {
  var s = String(Math.abs(Math.round(n))), out = '', c = 0;
  for (var i = s.length - 1; i >= 0; i--) {
    out = s[i] + out;
    if (++c % 3 === 0 && i > 0) out = '.' + out;
  }
  return out;
}

export function fmtRp(n)     { return (n < 0 ? '-' : '') + 'Rp' + grp(n); }

export function fmtRpSign(n) { return (n > 0 ? '+' : n < 0 ? '-' : '') + 'Rp' + grp(n); }

export function fmtRpShort(n) {
  var a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + 'Rp' + (a/1e9).toFixed(a >= 1e10 ? 0 : 1).replace('.', ',') + ' M';
  if (a >= 1e6) return s + 'Rp' + (a/1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' jt';
  if (a >= 1e3) return s + 'Rp' + Math.round(a/1e3) + ' rb';
  return s + 'Rp' + grp(a);
}

export function digits(v) { return String(v == null ? '' : v).replace(/[^0-9]/g, ''); }
