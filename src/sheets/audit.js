import { icon } from '../core/icons.js';
import { withUndo } from '../core/store.js';
import { auditData, auditFix } from '../features/audit.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';

/* ==================== SHEET: AUDIT KONSISTENSI ==================== */
export function sheetAudit() {
  openSheet('Audit konsistensi', function (bd) {
    bd.id = 'audit-body';
    var found = auditData();
    bd.dataset.n = String(found.length);
    var err = found.filter(function (f) { return f.level === 'error'; });
    var warn = found.filter(function (f) { return f.level === 'warn'; });

    var st = el('div', 'stats');
    [['auto', found.length ? 0 : 1, 'Sehat'], ['check', warn.length, 'Perhatian'],
     ['dup', err.length, 'Masalah']].forEach(function (x) {
      var dd = el('div', x[0]);
      dd.appendChild(el('div', 'n', String(x[1])));
      dd.appendChild(el('div', 'l', x[2]));
      st.appendChild(dd);
    });
    bd.appendChild(st);

    if (!found.length) {
      var okBox = el('div', 'hint');
      okBox.id = 'audit-ok';
      okBox.style.textAlign = 'left';
      okBox.textContent = 'Semua invarian terpenuhi: hari urut dan tidak kembar, id unik, ' +
        'tidak ada kategori yatim, kaki transfer semuanya dikenali, target alokasi 100%, ' +
        'dan jurnal menunjuk kelas yang ada.';
      bd.appendChild(okBox);
      return;
    }

    var card = el('div', 'card');
    card.id = 'audit-list';
    card.style.padding = '4px 14px';
    found.forEach(function (f) {
      var r = el('div', 'crow');
      r.dataset.code = f.code;
      r.dataset.level = f.level;
      var av = el('div', 'av' + (f.level === 'error' ? '' : ' g'));
      av.appendChild(icon(f.level === 'error' ? 'close' : 'lain'));
      if (f.level === 'error') av.style.color = 'var(--down)';
      r.appendChild(av);
      var body = el('div', 'body');
      body.appendChild(el('div', 'nm', f.msg));
      body.appendChild(el('div', 'cnt', f.code + (f.fix ? ' · bisa diperbaiki otomatis'
                                                       : ' · perlu diperiksa sendiri')));
      r.appendChild(body);
      card.appendChild(r);
    });
    bd.appendChild(card);

    var bisa = found.filter(function (f) { return f.fix; });
    if (bisa.length) {
      var b = el('button', 'btn');
      b.id = 'audit-fix';
      b.textContent = 'Perbaiki ' + bisa.length + ' yang aman diperbaiki';
      b.addEventListener('click', function () {
        var codes = bisa.map(function (f) { return f.code; });
        closeSheet();
        withUndo('Diperbaiki: ' + codes.length + ' hal', function () { auditFix(codes); });
      });
      bd.appendChild(b);
    }
    var note = el('div', 'tiny mut');
    note.style.marginTop = '11px';
    note.textContent = 'Yang tidak bisa diperbaiki otomatis sengaja dibiarkan: menebak ' +
      'perbaikan atas catatan uang lebih berbahaya daripada membiarkannya terlihat. ' +
      'Perbaikan apa pun tetap bisa diurungkan.';
    bd.appendChild(note);
  });
}
