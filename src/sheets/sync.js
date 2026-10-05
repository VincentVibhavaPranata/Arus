import { render } from '../app/render.js';
import { dToS, sLabel } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { save, withUndo } from '../core/store.js';
import { syncApply, syncCfg, syncFetch, syncOn, syncPull, syncPush } from '../features/sync.js';
import { sheetConflict } from './conflict.js';
import { sheetHistory } from './history.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: SINKRONISASI ==================== */
export function sheetSync() {
  openSheet('Sinkronisasi', function (bd) {
    bd.id = 'sync-body';
    var s = syncCfg();

    var note = el('div', 'hint');
    note.style.textAlign = 'left';
    note.textContent = 'Servermu sendiri, satu dokumen per akun. Isinya TIDAK ' +
      'dienkripsi di server — jalankan di mesinmu sendiri lewat Tailscale atau ' +
      'VPS pribadi, bukan hosting bersama.';
    bd.appendChild(note);

    var err = el('div', 'err');
    err.id = 'sync-err';
    err.hidden = true;
    bd.appendChild(err);
    function fail(m) { err.textContent = m; err.hidden = false; }

    var f0 = el('div', 'fld');
    f0.appendChild(el('label', null, 'Alamat server'));
    var url = el('input', 'inp');
    url.id = 'sync-url';
    url.type = 'url';
    url.placeholder = 'http://100.x.y.z:8788';
    url.value = s.url || '';
    url.addEventListener('change', function () {
      s.url = url.value.trim().replace(/\/+$/, '');
      save();
    });
    f0.appendChild(url);
    bd.appendChild(f0);

    if (syncOn()) {
      var st = el('div', 'card');
      st.id = 'sync-status';
      st.dataset.rev = String(s.rev || 0);
      st.style.cssText = 'display:flex;align-items:center;gap:12px';
      var av = el('div', 'av g');
      av.appendChild(icon('check'));
      st.appendChild(av);
      var sb = el('div');
      sb.style.flex = '1';
      sb.appendChild(el('div', null, 'Masuk sebagai ' + s.user));
      sb.appendChild(el('div', 'tiny mut', 'revisi ' + (s.rev || 0) +
        (s.lastAt ? ' · terakhir ' + sLabel(dToS(new Date(s.lastAt))) : ' · belum pernah sinkron')));
      st.appendChild(sb);
      bd.appendChild(st);

      var push = el('button', 'btn');
      push.id = 'sync-push';
      push.textContent = 'Kirim ke server';
      push.addEventListener('click', function () {
        err.hidden = true;
        push.disabled = true;
        syncPush().then(function (r) {
          push.disabled = false;
          if (r.conflict) { closeSheet(); sheetConflict(r); return; }
          closeSheet();
          render();
          toast('Terkirim · revisi ' + r.rev);
        })['catch'](function (e) { push.disabled = false; fail(e.message); });
      });
      bd.appendChild(push);

      var pull = el('button', 'btn ghost');
      pull.id = 'sync-pull';
      pull.style.marginTop = '9px';
      pull.textContent = 'Ambil dari server';
      pull.addEventListener('click', function () {
        err.hidden = true;
        pull.disabled = true;
        syncPull().then(function (r) {
          pull.disabled = false;
          closeSheet();
          withUndo('Diambil · revisi ' + r.rev, function () { syncApply(r.data, r.rev); });
        })['catch'](function (e) { pull.disabled = false; fail(e.message); });
      });
      bd.appendChild(pull);

      var hist = el('button', 'btn ghost');
      hist.id = 'sync-history';
      hist.style.marginTop = '9px';
      hist.textContent = 'Riwayat revisi';
      hist.addEventListener('click', function () { closeSheet(); sheetHistory(); });
      bd.appendChild(hist);

      var out = el('button', 'btn ghost');
      out.id = 'sync-logout';
      out.style.cssText = 'margin-top:9px;color:var(--down);border-color:rgba(255,123,143,.35)';
      out.textContent = 'Keluar';
      out.addEventListener('click', function () {
        syncFetch('/api/logout', { method: 'POST' })['catch'](function () {});
        s.token = ''; s.user = ''; s.rev = 0;
        save();
        closeSheet();
        render();
        toast('Keluar dari sinkronisasi');
      });
      bd.appendChild(out);
      return;
    }

    var f1 = el('div', 'fld');
    f1.appendChild(el('label', null, 'Nama pengguna'));
    var u = el('input', 'inp');
    u.id = 'sync-user';
    u.type = 'text';
    u.autocomplete = 'username';
    u.value = s.user || '';
    f1.appendChild(u);
    bd.appendChild(f1);

    var f2 = el('div', 'fld');
    f2.appendChild(el('label', null, 'Sandi'));
    var p = el('input', 'inp');
    p.id = 'sync-pass';
    p.type = 'password';
    p.autocomplete = 'current-password';
    f2.appendChild(p);
    bd.appendChild(f2);

    function doAuth(pathX, label, btn) {
      err.hidden = true;
      if (!url.value.trim()) return fail('Alamat server belum diisi.');
      s.url = url.value.trim().replace(/\/+$/, '');
      btn.disabled = true;
      syncFetch(pathX, {
        method: 'POST', auth: false,
        body: { user: u.value.trim(), pass: p.value }
      }).then(function (r) {
        btn.disabled = false;
        if (!r.ok) return fail(r.body.error || label + ' gagal (HTTP ' + r.status + ').');
        s.token = r.body.token;
        s.user = r.body.user;
        s.rev = r.body.rev || 0;
        save();
        closeSheet();
        render();
        toast(label + ' berhasil · ' + s.user);
      })['catch'](function () {
        btn.disabled = false;
        fail('Tidak bisa menghubungi server. Periksa alamat dan jaringannya.');
      });
    }
    var login = el('button', 'btn');
    login.id = 'sync-login';
    login.textContent = 'Masuk';
    login.addEventListener('click', function () { doAuth('/api/login', 'Masuk', login); });
    bd.appendChild(login);

    var reg = el('button', 'btn ghost');
    reg.id = 'sync-register';
    reg.style.marginTop = '9px';
    reg.textContent = 'Daftar akun baru';
    reg.addEventListener('click', function () { doAuth('/api/register', 'Daftar', reg); });
    bd.appendChild(reg);
  });
}
