import { render } from './render.js';
import { initInteractions } from '../ui/interactions.js';
import { icon } from '../core/icons.js';
import { isNative } from '../core/native.js';
import { DATA, blankData, load, restore, setData, snapshot } from '../core/store.js';
import { lockEnabled } from '../features/lock.js';
import { runAutoRecurring } from '../features/recurring.js';
import { showOnboarding } from '../sheets/onboarding.js';
import { sheetTx } from '../sheets/tx.js';
import { showLock } from '../ui/lockScreen.js';
import { go } from '../ui/nav.js';
import { closeSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ============================ BOOT ============================ */
var booted = false;

export function boot() {
  if (booted) return;                 // idempoten: aman dipanggil dua kali
  booted = true;
  /* ARUS_EMBED: halaman lain memakai skrip ini HANYA sebagai pustaka parser.
     Jangan merender app, jangan menyentuh localStorage, jangan daftarkan
     service worker. DATA tetap dibuat karena parser membutuhkannya (kategori,
     penghitung id), tapi seluruhnya di memori. */
  if (window.ARUS_EMBED) {
    setData(blankData());
    return;
  }
  var first = load();
  /* ikon di markup statis diisi dari SET IKON yang sama — satu sumber bentuk.
     #nav pakai awalan nav_, sisanya (mis. brand) pakai nama apa adanya. */
  var hosts = document.querySelectorAll('[data-ic]');
  for (var i = 0; i < hosts.length; i++) {
    var host = hosts[i], nm = host.dataset.ic;
    if (host.closest('#nav')) nm = 'nav_' + nm;
    host.innerHTML = '';
    host.appendChild(icon(nm));
  }
  document.getElementById('nav-dasbor').addEventListener('click', function () { go('dasbor'); });
  document.getElementById('nav-transaksi').addEventListener('click', function () { go('transaksi'); });
  document.getElementById('nav-akun').addEventListener('click', function () { go('akun'); });
  document.getElementById('nav-trading').addEventListener('click', function () { go('trading'); });
  document.getElementById('nav-lainnya').addEventListener('click', function () { go('lainnya'); });
  document.getElementById('nav-add').addEventListener('click', function () { sheetTx(); });
  initInteractions();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !document.getElementById('sheet').hidden) closeSheet();
  });
  /* Back di Android / tombol mundur browser: tutup sheet dulu, jangan keluar. */
  window.addEventListener('popstate', function () {
    if (!document.getElementById('sheet').hidden) closeSheet(true);
  });
  /* Rutin mode auto dijalankan SEKALI di sini, sebelum render pertama, supaya
     angka di Dasbor sudah termasuk tagihan yang baru dicatat. Aman dipanggil
     berulang: doneYm mencegah penggandaan. */
  var snapAuto = snapshot();
  var posted = runAutoRecurring();
  render();
  if (posted) toast(posted + ' tagihan rutin dicatat otomatis', {
    actionLabel: 'Urungkan',
    action: function () { restore(snapAuto); toast('Dibatalkan'); }
  });
  /* Kunci dipasang SETELAH render supaya app di bawahnya sudah siap saat
     terbuka — dan supaya cooldown yang tersimpan langsung berlaku. */
  if (lockEnabled()) showLock();
  /* Boot pertama: JANGAN diam-diam memberi data contoh sebagai kalau-kalau itu
     punyanya. Tawarkan pilihan, dan katakan datanya tinggal di perangkat ini. */
  if (first && !DATA.onboarded) showOnboarding();
  /* Di APK, isi app sudah lokal — service worker cuma menambah lapisan cache
     yang bisa menyajikan versi lama setelah APK diperbarui. */
  /* Hanya di build produksi: di dev, cache SW akan menyajikan modul lama dan HMR rusak. */
  if (import.meta.env.PROD && !isNative() && 'serviceWorker' in navigator && location.protocol !== 'file:')
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(function () {});
}
