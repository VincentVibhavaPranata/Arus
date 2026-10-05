/* Desktop: bungkus tiap "judul seksi + isinya" jadi satu panel supaya CSS bisa
   menyusunnya dalam dua kolom. Di HP panel ini `display: contents`, jadi tampilan
   mobile tidak berubah sama sekali. Elemen asli tidak diganti — hanya dipindah
   induknya — jadi semua event handler tetap menempel. */
var PANE_TABS = { dasbor: 1, akun: 1, lainnya: 1, impor: 1, trading: 1 };
var FULL = '.hero, .backbar, .stats';

export function groupPanes(main, tab) {
  if (!PANE_TABS[tab]) return;
  var kids = Array.prototype.slice.call(main.children);
  var pane = null;
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k.matches(FULL)) { pane = null; continue; }
    if (k.classList.contains('sec')) {
      pane = document.createElement('div');
      pane.className = 'pane';
      main.insertBefore(pane, k);
      pane.appendChild(k);
    } else if (pane) {
      pane.appendChild(k);
    }
  }
}
