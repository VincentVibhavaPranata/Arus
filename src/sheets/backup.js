import { icon } from '../core/icons.js';
import { DATA, migrate, setData, withUndo } from '../core/store.js';
import { backupStats, buildCSV, buildJSON, downloadText, parseBackup, stampName } from '../features/backup.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: EKSPOR & IMPOR ==================== */
export function sheetBackup() {
  openSheet('Ekspor & impor', function (bd) {
    bd.id = 'backup-body';
    var st = backupStats(DATA);
    var info = el('div', 'tiny mut');
    info.style.margin = '0 0 14px';
    info.textContent = st.items + ' transaksi · ' + st.cats + ' kategori · ' +
      st.goals + ' tujuan · ' + st.recurring + ' rutin. Kunci PIN tidak ikut diekspor.';
    bd.appendChild(info);

    function btn(id, label, sub, fn) {
      var b = el('button', 'iopt');
      b.id = id;
      var av = el('div', 'av g');
      av.appendChild(icon('share'));
      b.appendChild(av);
      var body = el('div', 'body');
      body.appendChild(el('div', 't1', label));
      body.appendChild(el('div', 't2', sub));
      b.appendChild(body);
      b.addEventListener('click', fn);
      return b;
    }
    bd.appendChild(btn('exp-json', 'Ekspor JSON', 'Cadangan penuh — bisa diimpor kembali', function () {
      var text = buildJSON();
      if (!downloadText(stampName('json'), text, 'application/json')) showText('Salin JSON', text);
    }));
    bd.appendChild(btn('exp-csv', 'Ekspor CSV', 'Untuk Excel / Google Sheets · UTF-8 dengan BOM', function () {
      var text = buildCSV();
      if (!downloadText(stampName('csv'), text, 'text/csv')) showText('Salin CSV', text);
    }));

    bd.appendChild(el('div', 'sublab', 'Impor'));
    var err = el('div', 'err');
    err.id = 'imp-json-err';
    err.hidden = true;
    bd.appendChild(err);
    var ta = el('textarea', 'ta');
    ta.id = 'imp-json-text';
    ta.placeholder = 'Tempel isi berkas .json cadangan di sini';
    bd.appendChild(ta);
    var go_ = el('button', 'btn');
    go_.id = 'imp-json-go';
    go_.style.marginTop = '11px';
    go_.textContent = 'Ganti semua data dengan cadangan ini';
    go_.addEventListener('click', function () {
      var d;
      try { d = parseBackup(ta.value); }
      catch (e) { err.textContent = e.message; err.hidden = false; return; }
      var s2 = backupStats(d);
      closeSheet();
      withUndo('Dipulihkan · ' + s2.items + ' transaksi', function () {
        setData(migrate(d));
      });
    });
    bd.appendChild(go_);
    var warn = el('div', 'tiny mut');
    warn.style.marginTop = '9px';
    warn.textContent = 'Impor MENGGANTI seluruh data. Masih bisa diurungkan lewat toast.';
    bd.appendChild(warn);
  });
}

/* Kalau unduhan tidak tersedia, teksnya tetap harus bisa diambil. */
export function showText(title, text) {
  openSheet(title, function (bd) {
    bd.id = 'text-body';
    var ta = el('textarea', 'ta');
    ta.id = 'text-out';
    ta.style.minHeight = '260px';
    ta.value = text;
    bd.appendChild(ta);
    var b = el('button', 'btn');
    b.style.marginTop = '11px';
    b.textContent = 'Salin ke papan klip';
    b.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(function () { toast('Disalin'); })
          ['catch'](function () { toast('Gagal menyalin — pilih manual'); });
      else toast('Pilih teksnya lalu salin manual');
    });
    bd.appendChild(b);
  });
}
