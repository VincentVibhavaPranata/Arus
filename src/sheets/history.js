import { dToS, sLabel } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { withUndo } from '../core/store.js';
import { syncApply, syncCfg, syncFetch } from '../features/sync.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: RIWAYAT REVISI ==================== */
export function sheetHistory() {
  openSheet('Riwayat revisi', function (bd) {
    bd.id = 'history-body';
    var host = el('div');
    host.id = 'history-list';
    bd.appendChild(host);
    host.appendChild(el('div', 'tiny mut', 'Memuat…'));

    syncFetch('/api/history').then(function (r) {
      host.innerHTML = '';
      if (!r.ok) {
        var e = el('div', 'err');
        e.textContent = r.body.error || 'Gagal memuat riwayat.';
        host.appendChild(e);
        return;
      }
      var revs = r.body.revs || [];
      host.dataset.n = String(revs.length);
      if (!revs.length) {
        host.appendChild(el('div', 'empty', 'Belum ada revisi tersimpan'));
        return;
      }
      var info = el('div', 'tiny mut');
      info.style.margin = '0 0 12px';
      info.textContent = 'Server menyimpan ' + (r.body.keep || 10) +
        ' revisi terakhir. Memulihkan revisi lama menulisnya sebagai revisi BARU — ' +
        'riwayatnya tetap lurus, tidak bercabang.';
      host.appendChild(info);

      var card = el('div', 'card');
      card.style.padding = '4px 14px';
      revs.forEach(function (rv) {
        var row = el('div', 'arow');
        row.dataset.rev = String(rv.rev);
        var av = el('div', 'av' + (rv.rev === syncCfg().rev ? ' g' : ''));
        av.appendChild(icon('repeat'));
        row.appendChild(av);
        var body = el('div', 'body');
        body.appendChild(el('div', 'n1', 'Revisi ' + rv.rev +
          (rv.rev === syncCfg().rev ? ' · yang kamu pegang' : '')));
        var d = new Date(rv.at);
        body.appendChild(el('div', 'n2',
          sLabel(dToS(d)) + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
          String(d.getMinutes()).padStart(2, '0') +
          ' · ' + Math.round(rv.size / 1024) + ' KB' + (rv.note ? ' · ' + rv.note : '')));
        row.appendChild(body);
        var b = el('button', 'btn-sm plain');
        b.dataset.role = 'restore';
        b.textContent = 'Pulihkan';
        b.addEventListener('click', function () {
          if (!b.dataset.armed) {
            b.dataset.armed = '1';
            b.textContent = 'Yakin?';
            return;
          }
          syncFetch('/api/restore', { method: 'POST', body: { rev: rv.rev } })
            .then(function (rr) {
              if (!rr.ok) { toast('Gagal: ' + (rr.body.error || rr.status)); return; }
              closeSheet();
              withUndo('Dipulihkan dari revisi ' + rv.rev + ' · kini revisi ' + rr.body.rev,
                function () { syncApply(rr.body.data, rr.body.rev); });
            })['catch'](function (e) { toast('Gagal: ' + e.message); });
        });
        row.appendChild(b);
        card.appendChild(row);
      });
      host.appendChild(card);
    })['catch'](function (e) {
      host.innerHTML = '';
      var e2 = el('div', 'err');
      e2.textContent = 'Tidak bisa menghubungi server: ' + e.message;
      host.appendChild(e2);
    });
  });
}
