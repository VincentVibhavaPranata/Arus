import { icon } from '../core/icons.js';
import { el } from './nav.js';

/* ============================ BOTTOM SHEET ============================ */
/* Tombol Back Android memetakan ke history. Dengan menitipkan satu langkah
   riwayat saat sheet dibuka, Back menutup sheet alih-alih KELUAR dari app —
   di APK maupun di browser. */
var sheetHist = false;

export function openSheet(title, build) {
  var sh = document.getElementById('sheet'), sc = document.getElementById('scrim');
  sh.innerHTML = '';
  sh.appendChild(el('div', 'grip'));
  var hd = el('div', 'sh-hd');
  var h3 = el('h3', null, title);
  h3.id = 'sh-title';
  hd.appendChild(h3);
  var x = el('button', 'sh-x');
  x.appendChild(icon('close'));
  x.id = 'sh-close';
  x.setAttribute('aria-label', 'Tutup');
  /* Dibungkus, JANGAN dipasang langsung: handler menerima objek Event sebagai
     argumen pertama, dan itu akan terbaca sebagai fromPop=true — riwayatnya
     tidak pernah diambil kembali, lalu menumpuk setiap kali sheet dibuka. */
  x.addEventListener('click', function () { closeSheet(); });
  hd.appendChild(x);
  sh.appendChild(hd);
  var bd = el('div', 'sh-bd');
  sh.appendChild(bd);
  sh.hidden = false; sc.hidden = false;
  build(bd);
  /* rAF hanya kosmetik; tanpa rAF kelas langsung dipasang */
  if (typeof requestAnimationFrame === 'function')
    requestAnimationFrame(function () { sh.classList.add('on'); sc.classList.add('on'); });
  else { sh.classList.add('on'); sc.classList.add('on'); }
  sc.onclick = function () { closeSheet(); };
  document.body.style.overflow = 'hidden';
  if (!sheetHist) {
    try { history.pushState({ arusSheet: 1 }, ''); sheetHist = true; } catch (e) {}
  }
}

/* fromPop=true berarti dipanggil KARENA tombol Back, jadi jangan mundur lagi. */
export function closeSheet(fromPop) {
  var sh = document.getElementById('sheet'), sc = document.getElementById('scrim');
  var terbuka = !sh.hidden;
  sh.classList.remove('on'); sc.classList.remove('on');
  document.body.style.overflow = '';
  var done = function () { sh.hidden = true; sc.hidden = true; sh.innerHTML = ''; };
  if (typeof requestAnimationFrame === 'function') setTimeout(done, 260); else done();
  if (sheetHist) {
    sheetHist = false;
    if (!fromPop && terbuka) { try { history.back(); } catch (e) {} }
  }
}
