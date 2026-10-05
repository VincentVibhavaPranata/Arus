import { KEY } from '../core/constants.js';
import { icon } from '../core/icons.js';
import { LOCK_FAIL_MAX, lockClear, lockCooldownLeft, lockLoad, lockTry } from '../features/lock.js';
import { el } from './nav.js';
import { toast } from './toast.js';

/* ==================== LAYAR KUNCI ==================== */
var lockTimer = null;

export function showLock() {
  if (document.getElementById('lockscreen')) return;
  var l = lockLoad();
  var wrap = el('div');
  wrap.id = 'lockscreen';
  var mark = el('div', 'mark');
  mark.appendChild(icon('brand'));
  wrap.appendChild(mark);
  wrap.appendChild(el('h1', null, 'Arus terkunci'));
  wrap.appendChild(el('div', 'sub',
    'Masukkan PIN ' + (l.len || 6) + ' angka. Ini kunci layar, bukan enkripsi — ' +
    'datanya tetap tersimpan apa adanya di perangkat ini.'));

  var dots = el('div', 'dots');
  dots.id = 'lock-dots';
  wrap.appendChild(dots);
  var msg = el('div', null, '');
  msg.id = 'lock-msg';
  wrap.appendChild(msg);

  var pad = el('div', 'keypad');
  pad.id = 'lock-pad';
  var entry = '', busy = false;

  function paintDots() {
    dots.innerHTML = '';
    var n = l.len || 6;
    for (var i = 0; i < n; i++) {
      var s = el('span');
      if (i < entry.length) s.className = 'on';
      dots.appendChild(s);
    }
    dots.dataset.n = String(entry.length);
  }
  function cooldownTick() {
    var left = lockCooldownLeft();
    var keys = pad.querySelectorAll('button');
    for (var i = 0; i < keys.length; i++) keys[i].disabled = left > 0 || busy;
    if (left > 0) {
      msg.className = '';
      msg.textContent = 'Terlalu banyak percobaan. Tunggu ' +
        Math.ceil(left / 1000) + ' detik.';
      msg.dataset.cooldown = String(Math.ceil(left / 1000));
    } else if (msg.dataset.cooldown) {
      delete msg.dataset.cooldown;
      msg.textContent = '';
    }
  }
  function press(d) {
    if (busy || lockCooldownLeft() > 0) return;
    entry += d;
    paintDots();
    if (entry.length >= (l.len || 6)) submit();
  }
  function back() {
    if (busy) return;
    entry = entry.slice(0, -1);
    paintDots();
  }
  function submit() {
    busy = true;
    cooldownTick();
    var pin = entry;
    entry = '';
    lockTry(pin).then(function (res) {
      busy = false;
      paintDots();
      if (res.ok) {
        if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
        wrap.parentNode && wrap.parentNode.removeChild(wrap);
        document.body.style.overflow = '';
        return;
      }
      if (res.left > 0) {
        cooldownTick();
      } else {
        msg.className = '';
        var sisa = LOCK_FAIL_MAX - (res.fails || 0);
        msg.textContent = 'PIN salah.' + (sisa > 0 && sisa <= 2
          ? ' Sisa ' + sisa + ' percobaan sebelum jeda.' : '');
        msg.dataset.fails = String(res.fails || 0);
      }
      cooldownTick();
    })['catch'](function (e) {
      busy = false;
      msg.className = '';
      msg.textContent = e.message || 'Gagal memeriksa PIN.';
      cooldownTick();
    });
  }

  ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (d) {
    var b = el('button', null, d);
    b.dataset.key = d;
    b.addEventListener('click', function () { press(d); });
    pad.appendChild(b);
  });
  var lupa = el('button', 'act', '');
  lupa.dataset.key = 'noop';
  lupa.disabled = true;
  lupa.style.visibility = 'hidden';
  pad.appendChild(lupa);
  var zero = el('button', null, '0');
  zero.dataset.key = '0';
  zero.addEventListener('click', function () { press('0'); });
  pad.appendChild(zero);
  var bs = el('button', 'act');
  bs.dataset.key = 'back';
  bs.setAttribute('aria-label', 'Hapus');
  bs.appendChild(icon('close'));
  bs.addEventListener('click', back);
  pad.appendChild(bs);
  wrap.appendChild(pad);

  /* Reset lewat sandi sinkronisasi — hanya tersedia kalau server memang
     tersetel. Kalau tidak, satu-satunya jalan tetap menghapus data. */
  var cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  var hasSync = !!(cfg && cfg.sync && cfg.sync.url && cfg.sync.user);

  if (hasSync) {
    var byPass = el('button', null, 'Reset PIN dengan sandi sinkronisasi');
    byPass.id = 'lock-reset-sync';
    byPass.style.cssText = 'margin-top:18px;font-size:12.5px;color:var(--acc);' +
      'border:1px solid var(--acc-d);padding:9px 13px;border-radius:9px';
    byPass.addEventListener('click', function () {
      var inp = document.getElementById('lock-syncpass');
      if (!inp) {
        inp = el('input', 'inp');
        inp.id = 'lock-syncpass';
        inp.type = 'password';
        inp.placeholder = 'Sandi akun ' + cfg.sync.user;
        inp.style.cssText = 'margin-top:14px;max-width:280px';
        wrap.insertBefore(inp, byPass);
        byPass.textContent = 'Periksa sandi & buka kunci';
        return;
      }
      msg.className = 'info';
      msg.textContent = 'Memeriksa ke server…';
      fetch(String(cfg.sync.url).replace(/\/+$/, '') + '/api/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: cfg.sync.user, pass: inp.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) {
            msg.className = '';
            msg.textContent = res.j.error || 'Sandi salah.';
            return;
          }
          /* Sandi server benar -> PIN dilepas. DATA tidak disentuh. */
          lockClear();
          if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
          wrap.parentNode && wrap.parentNode.removeChild(wrap);
          document.body.style.overflow = '';
          toast('PIN dilepas lewat sandi sinkronisasi');
        })['catch'](function () {
          msg.className = '';
          msg.textContent = 'Tidak bisa menghubungi server sinkronisasi.';
        });
    });
    wrap.appendChild(byPass);
  }

  var forgot = el('button', null, 'Lupa PIN?');
  forgot.id = 'lock-forgot';
  forgot.addEventListener('click', function () {
    msg.className = 'info';
    msg.textContent = hasSync
      ? 'Kalau sandi sinkronisasi juga lupa, satu-satunya jalan adalah menghapus ' +
        'data app (ketuk lagi untuk lanjut).'
      : 'PIN tidak bisa dipulihkan. Satu-satunya jalan masuk tanpa PIN adalah ' +
        'menghapus data app (ketuk lagi untuk lanjut).';
    if (forgot.dataset.armed) {
      lockClear();
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
      return;
    }
    forgot.dataset.armed = '1';
    forgot.textContent = 'Hapus semua data & buka kunci';
  });
  wrap.appendChild(forgot);

  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  paintDots();
  cooldownTick();
  if (lockTimer) clearInterval(lockTimer);
  lockTimer = setInterval(cooldownTick, 500);
}
