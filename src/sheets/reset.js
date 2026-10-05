import { icon } from '../core/icons.js';
import { DATA, blankData, save, seedDemo, setData, withUndo } from '../core/store.js';
import { backupStats, buildJSON, downloadText, stampName } from '../features/backup.js';
import { syncCfg, syncOn } from '../features/sync.js';
import { showText } from './backup.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';

/* ==================== SHEET: MULAI ULANG ====================
   Menghapus semua catatan. Sengaja bertingkat: lihat apa yang hilang, ekspor
   dulu kalau mau, baru dua ketuk. Sambungan sinkronisasi SENGAJA dipertahankan
   — kalau ternyata salah tekan, datamu masih bisa ditarik dari server. */
export function resetAll(mode) {
  var keepSync = JSON.parse(JSON.stringify(syncCfg()));
  setData(mode === 'contoh' ? seedDemo() : blankData());
  DATA.onboarded = true;
  DATA.sync = keepSync;
  save();
}

export function sheetReset() {
  openSheet('Mulai ulang', function (bd) {
    bd.id = 'reset-body';
    var st = backupStats(DATA);
    bd.dataset.items = String(st.items);

    var warn = el('div', 'err');
    warn.hidden = false;
    warn.textContent = 'Ini menghapus SEMUA catatanmu di perangkat ini: ' +
      st.items + ' transaksi, ' + st.goals + ' tujuan, ' + st.recurring + ' rutin, ' +
      st.cats + ' kategori, dan seluruh nilai aset.';
    bd.appendChild(warn);

    var b0 = el('button', 'btn ghost');
    b0.id = 'reset-export';
    b0.appendChild(icon('share'));
    b0.appendChild(el('span', null, ' Ekspor cadangan dulu'));
    b0.addEventListener('click', function () {
      var text = buildJSON();
      if (!downloadText(stampName('json'), text, 'application/json')) showText('Salin JSON', text);
    });
    bd.appendChild(b0);

    var note = el('div', 'tiny mut');
    note.style.margin = '12px 0 16px';
    note.textContent = syncOn()
      ? 'Sambungan sinkronisasi ke ' + syncCfg().user + ' dipertahankan, jadi kalau ' +
        'ternyata salah tekan, datamu masih bisa diambil lagi dari server.'
      : 'Kunci PIN tidak ikut terhapus. Tanpa sinkronisasi, cadangan JSON di atas ' +
        'adalah satu-satunya jalan kembali setelah app ditutup.';
    bd.appendChild(note);

    function tombolHapus(id, label, mode, ket) {
      var b = el('button', mode === 'kosong' ? 'btn' : 'btn ghost');
      b.id = id;
      b.style.cssText = 'text-align:left;padding:14px 15px' + (mode === 'kosong' ? '' : ';margin-top:9px');
      var t = el('div');
      t.style.cssText = 'font-weight:700;font-size:14px';
      t.textContent = label;
      b.appendChild(t);
      var s2 = el('div');
      s2.style.cssText = 'font-size:11.5px;font-weight:500;margin-top:3px;opacity:.75';
      s2.textContent = ket;
      b.appendChild(s2);
      var armed = false;
      b.addEventListener('click', function () {
        if (!armed) {
          armed = true;
          b.dataset.armed = '1';
          t.textContent = 'Ketuk sekali lagi untuk menghapus';
          return;
        }
        closeSheet();
        withUndo('Semua data dihapus · ' + label.toLowerCase(), function () { resetAll(mode); });
      });
      return b;
    }
    bd.appendChild(tombolHapus('reset-empty', 'Hapus & mulai dari nol', 'kosong',
      'Kosong sama sekali, siap kamu isi sendiri.'));
    bd.appendChild(tombolHapus('reset-demo', 'Hapus & muat data contoh', 'contoh',
      'Kembali ke keadaan seperti baru pasang, dengan data contoh.'));

    var last = el('div', 'tiny mut');
    last.style.marginTop = '12px';
    last.textContent = 'Masih bisa diurungkan lewat toast selama app belum ditutup.';
    bd.appendChild(last);
  });
}
