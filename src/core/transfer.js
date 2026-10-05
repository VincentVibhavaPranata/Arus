import { ACCTS, SEP } from './constants.js';
import { assetClass } from './networth.js';

/* ============================ TRANSFER ============================ */
export function isTf(it)   { return it.transfer === true; }

export function tfLegs(it) {
  var p = String(it.acct || '').split(SEP);
  return { from: (p[0]||'').trim(), to: (p[1]||'').trim() };
}

export function mkTfAcct(from, to) { return from + SEP + to; }

export function isAcct(x)     { return ACCTS.indexOf(x) >= 0; }

export function isClassKey(x) { return x !== 'cash' && !!assetClass(x); }

/* Jenis sebuah transfer, DIDERIVASI dari kakinya — bukan disimpan sebagai
   field, supaya tidak ada dua sumber kebenaran soal "ini investasi atau bukan".
     'acct'   BCA → GoPay      pindah antar akun
     'invest' BCA → saham      setoran ke kelas aset (atau tarik, kalau dibalik)
     'swap'   saham → kripto   rebalance antar kelas aset
     ''       kaki tak dikenali */
export function tfKind(it) {
  var g = tfLegs(it);
  var a = isAcct(g.from), b = isAcct(g.to);
  var ca = isClassKey(g.from), cb = isClassKey(g.to);
  if (a && b) return 'acct';
  if ((a && cb) || (ca && b)) return 'invest';
  if (ca && cb) return 'swap';
  return '';
}

export function isInvestFlow(it) {
  if (!isTf(it)) return false;
  var k = tfKind(it);
  return k === 'invest' || k === 'swap';
}

/* Kaki disimpan sebagai KUNCI (akun apa adanya, kelas pakai slug). Yang tampil
   ke user selalu label — jadi mengubah nama kelas tidak memutus transaksi. */
export function legLabel(x) {
  if (isAcct(x)) return x;
  var c = assetClass(x);
  return c ? c.label : x;
}

export function tfLabel(it) {
  var g = tfLegs(it);
  return legLabel(g.from) + SEP + legLabel(g.to);
}
