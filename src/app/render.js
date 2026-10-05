import { viewAkun } from '../pages/akun.js';
import { viewDasbor } from '../pages/dasbor.js';
import { viewImpor } from '../pages/impor.js';
import { viewLainnya } from '../pages/lainnya.js';
import { viewTrading } from '../pages/trading.js';
import { viewTransaksi } from '../pages/transaksi.js';
import { groupPanes } from '../ui/layout.js';
import { UI } from '../ui/nav.js';

/* ============================ RENDER UTAMA ============================ */
var lastTab = null;
export function render() {
  var main = document.getElementById('main');
  main.innerHTML = '';
  if      (UI.tab === 'dasbor')    viewDasbor(main);
  else if (UI.tab === 'transaksi') viewTransaksi(main);
  else if (UI.tab === 'akun')      viewAkun(main);
  else if (UI.tab === 'impor')     viewImpor(main);
  else if (UI.tab === 'trading')   viewTrading(main);
  else                             viewLainnya(main);
  groupPanes(main, UI.tab);
  /* 'impor' = sub-layar Lainnya. 'trading' punya menu sendiri di sidebar desktop;
     di HP menu itu disembunyikan, jadi di sana tab yang menyala tetap Lainnya. */
  var tn = document.getElementById('nav-trading');
  var tradingVisible = tn && getComputedStyle(tn).display !== 'none';
  var cur = UI.tab === 'impor' ? 'lainnya'
          : UI.tab === 'trading' ? (tradingVisible ? 'trading' : 'lainnya')
          : UI.tab;
  var btns = document.querySelectorAll('#nav button[data-tab]');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].dataset.tab === cur) btns[i].setAttribute('aria-current', 'page');
    else btns[i].removeAttribute('aria-current');
  }
  document.body.dataset.tab = UI.tab;
  /* Transisi halaman hanya saat pindah halaman, bukan tiap render ulang. */
  if (lastTab !== null && lastTab !== UI.tab) {
    main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
  }
  lastTab = UI.tab;
}
