import { render } from '../app/render.js';
import { icon } from '../core/icons.js';
import { grp } from '../core/money.js';
import { LOCK_ITER, hasSubtle, lockClear, lockEnabled, lockLoad, lockSet } from '../features/lock.js';
import { showLock } from '../ui/lockScreen.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: PENGATURAN KUNCI ==================== */
export function sheetLock() {
  openSheet('Kunci PIN', function (bd) {
    bd.id = 'lock-body';
    var on = lockEnabled(), l = lockLoad();

    var note = el('div', 'hint');
    note.style.textAlign = 'left';
    note.id = 'lock-honest';
    note.textContent = 'PIN mengunci layar app, BUKAN mengenkripsi data. ' +
      'Catatanmu tetap tersimpan apa adanya di penyimpanan browser — siapa pun ' +
      'yang bisa membuka devtools atau menyalin profil browser tetap bisa ' +
      'membacanya. Gunanya menghalangi orang yang memegang HP-mu.';
    bd.appendChild(note);

    if (on) {
      var st = el('div', 'card');
      st.id = 'lock-status';
      st.dataset.algo = l.algo;
      st.style.cssText = 'display:flex;align-items:center;gap:12px';
      var av = el('div', 'av g');
      av.appendChild(icon('check'));
      st.appendChild(av);
      var sb = el('div');
      sb.style.flex = '1';
      sb.appendChild(el('div', null, 'Kunci aktif · ' + l.len + ' angka'));
      sb.appendChild(el('div', 'tiny mut', l.algo === 'pbkdf2'
        ? 'PBKDF2-SHA256, ' + grp(l.iter) + ' iterasi'
        : 'Hash sederhana — crypto.subtle tidak tersedia di perangkat ini, ' +
          'jadi ketahanannya jauh lebih rendah'));
      st.appendChild(sb);
      bd.appendChild(st);

      var offb = el('button', 'btn ghost');
      offb.id = 'lock-off';
      offb.style.cssText = 'color:var(--down);border-color:rgba(255,123,143,.35)';
      offb.textContent = 'Matikan kunci';
      offb.addEventListener('click', function () {
        lockClear();
        closeSheet();
        render();
        toast('Kunci dimatikan');
      });
      bd.appendChild(offb);
      var lockNow = el('button', 'btn');
      lockNow.id = 'lock-now';
      lockNow.style.marginTop = '9px';
      lockNow.textContent = 'Kunci sekarang';
      lockNow.addEventListener('click', function () { closeSheet(); showLock(); });
      bd.appendChild(lockNow);
      return;
    }

    var err = el('div', 'err');
    err.id = 'lock-err';
    err.hidden = true;
    bd.appendChild(err);

    var f1 = el('div', 'fld');
    f1.appendChild(el('label', null, 'PIN baru (4–8 angka)'));
    var p1 = el('input', 'inp');
    p1.id = 'lock-p1';
    p1.type = 'password';
    p1.inputMode = 'numeric';
    p1.autocomplete = 'new-password';
    f1.appendChild(p1);
    bd.appendChild(f1);

    var f2 = el('div', 'fld');
    f2.appendChild(el('label', null, 'Ulangi PIN'));
    var p2 = el('input', 'inp');
    p2.id = 'lock-p2';
    p2.type = 'password';
    p2.inputMode = 'numeric';
    p2.autocomplete = 'new-password';
    f2.appendChild(p2);
    bd.appendChild(f2);

    var algoLine = el('div', 'tiny mut');
    algoLine.id = 'lock-algo';
    algoLine.dataset.algo = hasSubtle() ? 'pbkdf2' : 'simple';
    algoLine.style.margin = '0 0 14px';
    algoLine.textContent = hasSubtle()
      ? 'Akan memakai PBKDF2-SHA256 dengan ' + grp(LOCK_ITER) + ' iterasi.'
      : 'crypto.subtle tidak tersedia di sini, jadi akan memakai hash sederhana ' +
        'yang jauh lebih lemah. Buka Arus lewat HTTPS untuk mendapat PBKDF2.';
    bd.appendChild(algoLine);

    var go_ = el('button', 'btn');
    go_.id = 'lock-save';
    go_.textContent = 'Aktifkan kunci';
    go_.addEventListener('click', function () {
      var a = String(p1.value || ''), b = String(p2.value || '');
      if (!/^\d{4,8}$/.test(a)) {
        err.textContent = 'PIN harus 4–8 angka.';
        err.hidden = false;
        return;
      }
      if (a !== b) {
        err.textContent = 'Kedua PIN tidak sama.';
        err.hidden = false;
        return;
      }
      go_.disabled = true;
      go_.textContent = 'Menghitung…';
      lockSet(a).then(function (algo) {
        closeSheet();
        render();
        toast('Kunci aktif · ' + (algo === 'pbkdf2' ? 'PBKDF2' : 'hash sederhana'));
      })['catch'](function (e) {
        go_.disabled = false;
        go_.textContent = 'Aktifkan kunci';
        err.textContent = e.message || 'Gagal mengaktifkan kunci.';
        err.hidden = false;
      });
    });
    bd.appendChild(go_);
  });
}
