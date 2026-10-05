import { catHue } from '../core/categories.js';
import { go } from '../ui/nav.js';
import { sheetTx } from '../sheets/tx.js';

/* Tiga hal kecil yang bikin app terasa hidup di desktop, tanpa menyentuh logika:
   1. kartu kaca bersinar mengikuti kursor,
   2. elemen ber-data-cat otomatis dapat warna kategorinya (--ch),
   3. shortcut keyboard: N = tambah transaksi, 1-5 = pindah halaman. */

var GLOW = '.card,.hero,.txs,.iopt,.stats>div';
var TABS = ['dasbor', 'transaksi', 'akun', 'trading', 'lainnya'];

function tint(root) {
  var list = root.querySelectorAll ? root.querySelectorAll('[data-cat]') : [];
  var all = root.matches && root.matches('[data-cat]') ? [root] : [];
  for (var i = 0; i < list.length; i++) all.push(list[i]);
  for (var j = 0; j < all.length; j++) {
    var n = all[j], k = n.dataset.cat;
    if (k && !n.style.getPropertyValue('--ch')) n.style.setProperty('--ch', String(catHue(k)));
  }
}

function typing(t) {
  return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
}

export function initInteractions() {
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var t = e.target.closest && e.target.closest(GLOW);
    if (!t) return;
    var r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++)
      for (var j = 0; j < muts[i].addedNodes.length; j++) {
        var n = muts[i].addedNodes[j];
        if (n.nodeType === 1) tint(n);
      }
  });
  ['main', 'sheet'].forEach(function (id) {
    var host = document.getElementById(id);
    if (host) { tint(host); mo.observe(host, { childList: true, subtree: true }); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    if (!document.getElementById('sheet').hidden) return;
    if (document.getElementById('lockscreen') || document.getElementById('onboarding')) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); sheetTx(); }
    else if (e.key >= '1' && e.key <= '5') go(TABS[Number(e.key) - 1]);
  });
}
