import { digits, grp } from '../core/money.js';

/* ============================ INPUT UANG ============================ */
/* Satu perilaku untuk SEMUA input nominal (transaksi, anggaran, tujuan):
   tampil bertitik ribuan, angka mentah selalu di dataset.raw. */
export function attachMoney(inp, val) {
  function paint(d) {
    inp.dataset.raw = d;
    inp.value = d ? 'Rp' + grp(+d) : '';
  }
  inp.type = 'text';
  inp.inputMode = 'numeric';
  inp.autocomplete = 'off';
  inp.addEventListener('input', function () { paint(digits(inp.value)); });
  paint(val ? String(Math.abs(Math.round(val))) : '');
  return inp;
}

export function moneyVal(inp) {
  var d = digits(inp.dataset.raw != null ? inp.dataset.raw : inp.value);
  return d ? parseInt(d, 10) : 0;
}
