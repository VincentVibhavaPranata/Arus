import { render } from '../app/render.js';
import { icon } from '../core/icons.js';
import { DATA, blankData, save, setData } from '../core/store.js';
import { sheetAcctStart } from '../pages/akun.js';
import { el } from '../ui/nav.js';
import { toast } from '../ui/toast.js';

/* ==================== ONBOARDING PERTAMA KALI ==================== */
export function showOnboarding() {
  if (document.getElementById('onboarding')) return;
  var wrap = el('div');
  wrap.id = 'onboarding';
  var mark = el('div', 'mark');
  mark.appendChild(icon('brand'));
  wrap.appendChild(mark);
  wrap.appendChild(el('h1', null, 'Selamat datang di Arus'));
  wrap.appendChild(el('div', 'sub',
    'Pencatat keuangan yang datanya tinggal di perangkat ini. Tidak ada akun, ' +
    'tidak ada server, kecuali kamu sendiri yang menyalakannya nanti.'));

  function pick(id, judul, ket, primer) {
    var b = el('button', primer ? 'btn' : 'btn ghost');
    b.id = id;
    b.style.cssText = 'max-width:320px;text-align:left;padding:15px 16px' +
      (primer ? '' : ';margin-top:10px');
    var t = el('div');
    t.style.cssText = 'font-weight:700;font-size:14.5px';
    t.textContent = judul;
    b.appendChild(t);
    var s2 = el('div');
    s2.style.cssText = 'font-size:11.5px;font-weight:500;margin-top:3px;opacity:.75';
    s2.textContent = ket;
    b.appendChild(s2);
    return b;
  }
  var nol = pick('onb-empty', 'Mulai dari nol',
    'Kosong, siap kamu isi. Saldo awal akun bisa diatur sekarang.', true);
  nol.addEventListener('click', function () {
    setData(blankData());
    DATA.onboarded = true;
    save();
    close_();
    render();
    sheetAcctStart();
  });
  wrap.appendChild(nol);

  var demo = pick('onb-demo', 'Lihat data contoh',
    'Beberapa transaksi, anggaran, dan aset buatan untuk mencoba-coba dulu.');
  demo.addEventListener('click', function () {
    DATA.onboarded = true;
    save();
    close_();
    render();
    toast('Data contoh dimuat · semuanya bertanda contoh dan bisa dihapus', { ms: 6000 });
  });
  wrap.appendChild(demo);

  var note = el('div', 'tiny mut');
  note.style.cssText = 'margin-top:20px;max-width:300px;text-align:center;line-height:1.5';
  note.textContent = 'Catatanmu disimpan di penyimpanan browser HP ini. ' +
    'Ekspor JSON di menu Lainnya adalah cadanganmu.';
  wrap.appendChild(note);

  function close_() {
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    document.body.style.overflow = '';
  }
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
}
