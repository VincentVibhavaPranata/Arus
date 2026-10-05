import { render } from '../app/render.js';
import { inputToS, sLabel, sToInput, todayS } from '../core/dates.js';
import { fmtRp, fmtRpSign } from '../core/money.js';
import { DATA, save, withUndo } from '../core/store.js';
import { fmtR } from '../features/trading.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ---------- sheet: tambah / ubah trade ---------- */
export function sheetTrade(id) {
  var ex = null;
  if (id != null) (DATA.trades.list || []).forEach(function (t) { if (t.id === id) ex = t; });
  openSheet(ex ? 'Ubah trade' : 'Trade baru', function (bd) {
    bd.id = 'trade-body';
    var err = el('div', 'err');
    err.id = 'trade-err';
    err.hidden = true;
    bd.appendChild(err);

    var f0 = el('div', 'fld');
    f0.appendChild(el('label', null, 'Pair'));
    var pair = el('input', 'inp');
    pair.id = 'trade-pair';
    pair.type = 'text';
    pair.autocomplete = 'off';
    pair.placeholder = 'mis. BTCUSDT';
    if (ex) pair.value = ex.pair || '';
    f0.appendChild(pair);
    bd.appendChild(f0);

    var f1 = el('div', 'fld');
    f1.appendChild(el('label', null, 'Arah'));
    var seg = el('div', 'seg');
    seg.id = 'trade-dir';
    var cur = ex ? ex.dir : 'LONG';
    ['LONG', 'SHORT'].forEach(function (dd) {
      var b = el('button', null, dd);
      b.type = 'button';
      b.dataset.dir = dd;
      b.setAttribute('aria-pressed', dd === cur ? 'true' : 'false');
      b.addEventListener('click', function () {
        var all = seg.querySelectorAll('button');
        for (var i = 0; i < all.length; i++)
          all[i].setAttribute('aria-pressed', all[i] === b ? 'true' : 'false');
      });
      seg.appendChild(b);
    });
    f1.appendChild(seg);
    bd.appendChild(f1);

    var f2 = el('div', 'fld');
    f2.appendChild(el('label', null, 'Risiko (1R)'));
    var risk = el('input', 'inp');
    risk.id = 'trade-risk';
    risk.placeholder = 'Rp0';
    attachMoney(risk, ex ? ex.risk : 0);
    f2.appendChild(risk);
    var rh = el('div', 'tiny mut');
    rh.style.marginTop = '6px';
    rh.textContent = 'Berapa rupiah yang siap hilang kalau stop kena. Ini penyebut R.';
    f2.appendChild(rh);
    bd.appendChild(f2);

    var f3 = el('div', 'fld');
    f3.appendChild(el('label', null, 'Tanggal masuk'));
    var dIn = el('input', 'inp');
    dIn.id = 'trade-din';
    dIn.type = 'date';
    dIn.value = sToInput(ex && ex.dIn ? ex.dIn : todayS());
    f3.appendChild(dIn);
    bd.appendChild(f3);

    var f4 = el('div', 'fld');
    f4.appendChild(el('label', null, 'Catatan'));
    var note = el('input', 'inp');
    note.id = 'trade-note';
    note.type = 'text';
    note.placeholder = 'alasan masuk, setup, pelajaran';
    if (ex) note.value = ex.note || '';
    f4.appendChild(note);
    bd.appendChild(f4);

    var save_ = el('button', 'btn');
    save_.id = 'trade-save';
    save_.textContent = ex ? 'Simpan perubahan' : 'Buka posisi';
    save_.addEventListener('click', function () {
      var p = pair.value.trim();
      if (!p) { err.textContent = 'Pair belum diisi.'; err.hidden = false; return; }
      var rk = moneyVal(risk);
      var s = inputToS(dIn.value);
      if (!s) { err.textContent = 'Tanggal tidak valid.'; err.hidden = false; return; }
      var dir = seg.querySelector('button[aria-pressed="true"]').dataset.dir;
      if (ex) {
        closeSheet();
        withUndo('Trade diperbarui', function () {
          ex.pair = p; ex.dir = dir; ex.risk = rk; ex.dIn = s; ex.note = note.value.trim();
        });
        return;
      }
      DATA.trades.list.push({
        id: 't' + (++DATA.seq), pair: p, dir: dir, risk: rk, pnl: 0,
        open: true, dIn: s, dOut: 0, note: note.value.trim()
      });
      save();
      closeSheet();
      render();
      toast('Posisi ' + p + ' dibuka');
    });
    bd.appendChild(save_);

    if (ex) {
      var del = el('button', 'btn ghost');
      del.id = 'trade-del';
      del.style.cssText = 'margin-top:9px;color:var(--down);border-color:rgba(255,123,143,.35)';
      del.textContent = 'Hapus trade';
      var armed = false;
      del.addEventListener('click', function () {
        if (!armed) {
          armed = true;
          del.dataset.armed = '1';
          del.textContent = 'Ketuk sekali lagi untuk menghapus';
          return;
        }
        closeSheet();
        withUndo('Trade ' + (ex.pair || '') + ' dihapus', function () {
          DATA.trades.list = DATA.trades.list.filter(function (x) { return x.id !== ex.id; });
        });
      });
      bd.appendChild(del);
    }
  });
}

/* ---------- sheet: tutup posisi ---------- */
export function sheetClose(id) {
  var t = null;
  (DATA.trades.list || []).forEach(function (x) { if (x.id === id) t = x; });
  if (!t) return;
  openSheet('Tutup ' + (t.pair || 'posisi'), function (bd) {
    bd.id = 'close-body';
    var info = el('div', 'tiny mut');
    info.style.margin = '0 0 14px';
    info.textContent = t.dir + ' · risiko ' + fmtRp(t.risk) +
      ' · buka ' + (t.dIn ? sLabel(t.dIn) : '—');
    bd.appendChild(info);

    var err = el('div', 'err');
    err.id = 'close-err';
    err.hidden = true;
    bd.appendChild(err);

    /* PnL BERTANDA: arahnya dipilih eksplisit, tidak ditebak dari besarnya. */
    var f0 = el('div', 'fld');
    f0.appendChild(el('label', null, 'Hasil'));
    var seg = el('div', 'seg');
    seg.id = 'close-dir';
    [['win', 'Profit'], ['loss', 'Rugi'], ['flat', 'Impas']].forEach(function (m) {
      var b = el('button', null, m[1]);
      b.type = 'button';
      b.dataset.kind = m[0];
      b.setAttribute('aria-pressed', m[0] === 'win' ? 'true' : 'false');
      b.addEventListener('click', function () {
        var all = seg.querySelectorAll('button');
        for (var i = 0; i < all.length; i++)
          all[i].setAttribute('aria-pressed', all[i] === b ? 'true' : 'false');
        paint();
      });
      seg.appendChild(b);
    });
    f0.appendChild(seg);
    bd.appendChild(f0);

    var f1 = el('div', 'fld');
    f1.appendChild(el('label', null, 'Nominal PnL'));
    var amt = el('input', 'inp money');
    amt.id = 'close-amt';
    amt.placeholder = 'Rp0';
    attachMoney(amt, 0);
    amt.addEventListener('input', paint);
    f1.appendChild(amt);
    var rline = el('div', 'tiny mut');
    rline.id = 'close-r';
    rline.style.marginTop = '7px';
    f1.appendChild(rline);
    bd.appendChild(f1);

    var f2 = el('div', 'fld');
    f2.appendChild(el('label', null, 'Tanggal keluar'));
    var dOut = el('input', 'inp');
    dOut.id = 'close-dout';
    dOut.type = 'date';
    dOut.value = sToInput(todayS());
    f2.appendChild(dOut);
    bd.appendChild(f2);

    var b2 = el('button', 'btn');
    b2.id = 'close-save';
    b2.textContent = 'Tutup posisi';
    b2.addEventListener('click', function () {
      var kind = seg.querySelector('button[aria-pressed="true"]').dataset.kind;
      var mag = moneyVal(amt);
      var s = inputToS(dOut.value);
      if (!s) { err.textContent = 'Tanggal tidak valid.'; err.hidden = false; return; }
      if (kind !== 'flat' && !mag) {
        err.textContent = 'Nominal PnL belum diisi.';
        err.hidden = false;
        return;
      }
      if (s < t.dIn) {
        err.textContent = 'Tanggal keluar tidak boleh sebelum tanggal masuk.';
        err.hidden = false;
        return;
      }
      var pnl = kind === 'flat' ? 0 : (kind === 'win' ? mag : -mag);
      closeSheet();
      withUndo((t.pair || 'Posisi') + ' ditutup · ' + fmtRpSign(pnl), function () {
        t.open = false;
        t.pnl = pnl;
        t.dOut = s;
      });
    });
    bd.appendChild(b2);

    function paint() {
      var kind = seg.querySelector('button[aria-pressed="true"]').dataset.kind;
      var mag = moneyVal(amt);
      var pnl = kind === 'flat' ? 0 : (kind === 'win' ? mag : -mag);
      amt.disabled = kind === 'flat';
      rline.textContent = t.risk > 0
        ? 'Setara ' + fmtR(pnl / t.risk) + ' dari risiko ' + fmtRp(t.risk)
        : 'Risiko tidak tercatat — trade ini tidak akan punya nilai R';
      rline.dataset.r = t.risk > 0 ? (pnl / t.risk).toFixed(4) : '';
    }
    paint();
  });
}
