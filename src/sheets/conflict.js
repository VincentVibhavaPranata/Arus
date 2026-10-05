import { render } from '../app/render.js';
import { DATA, save, withUndo } from '../core/store.js';
import { backupStats } from '../features/backup.js';
import { syncApply, syncCfg, syncPush } from '../features/sync.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: KONFLIK 409 ====================
   Dua versi, satu keputusan, dan keputusannya milik user. */
export function sheetConflict(c) {
  openSheet('Versi bentrok', function (bd) {
    bd.id = 'conflict-body';
    bd.dataset.serverRev = String(c.rev);
    var warn = el('div', 'err');
    warn.hidden = false;
    warn.textContent = 'Server sudah punya revisi ' + c.rev +
      ' yang lebih baru dari yang kamu pegang. Arus TIDAK menggabung otomatis — ' +
      'pilih salah satu.';
    bd.appendChild(warn);

    var mine = backupStats(DATA);
    var theirs = backupStats(c.data || { days: [] });
    var tbl = el('div', 'stats');
    [['auto', mine.items, 'Lokal'], ['dup', theirs.items, 'Server']].forEach(function (x) {
      var d = el('div', x[0]);
      d.appendChild(el('div', 'n', String(x[1])));
      d.appendChild(el('div', 'l', x[2] + ' · transaksi'));
      tbl.appendChild(d);
    });
    bd.appendChild(tbl);

    var det = el('div', 'tiny mut');
    det.style.margin = '0 0 14px';
    det.textContent = 'Lokal: ' + mine.items + ' transaksi, ' + mine.goals + ' tujuan, ' +
      mine.recurring + ' rutin. Server: ' + theirs.items + ' transaksi, ' +
      theirs.goals + ' tujuan, ' + theirs.recurring + ' rutin.';
    bd.appendChild(det);

    var take = el('button', 'btn');
    take.id = 'conflict-take';
    take.textContent = 'Pakai versi server (buang perubahan lokal)';
    take.addEventListener('click', function () {
      closeSheet();
      withUndo('Versi server dipakai · revisi ' + c.rev, function () {
        syncApply(c.data, c.rev);
      });
    });
    bd.appendChild(take);

    var force = el('button', 'btn ghost');
    force.id = 'conflict-force';
    force.style.marginTop = '9px';
    force.textContent = 'Timpa server dengan versi lokal';
    var armed = false;
    force.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        force.dataset.armed = '1';
        force.textContent = 'Ketuk lagi — revisi ' + c.rev + ' server akan tertimpa';
        return;
      }
      /* Ikut nomor revisi server dulu, baru kirim: server yang menyimpan
         versi lama di riwayat, jadi timpa tetap bisa dipulihkan dari sana. */
      syncCfg().rev = c.rev;
      save();
      syncPush('timpa dari perangkat lokal').then(function (r) {
        closeSheet();
        render();
        toast(r.ok ? 'Server ditimpa · revisi ' + r.rev : 'Masih bentrok, coba lagi');
      })['catch'](function (e) { toast('Gagal: ' + e.message, { ms: 6000 }); });
    });
    bd.appendChild(force);

    var hint = el('div', 'tiny mut');
    hint.style.marginTop = '11px';
    hint.textContent = 'Apa pun pilihanmu, versi lama tetap ada di riwayat revisi ' +
      'server dan bisa dipulihkan.';
    bd.appendChild(hint);
  });
}
