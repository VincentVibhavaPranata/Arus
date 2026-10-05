import { render } from '../app/render.js';
import { ACCTS } from '../core/constants.js';
import { inputToS, sToInput } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { DATA, save, withUndo } from '../core/store.js';
import { setCatRule, titleKey } from '../features/categorize.js';
import { restage } from '../features/staging.js';
import { detectSource } from '../importers/bca.js';
import { parseImport, stageRows } from '../importers/index.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { el, monogram } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ---------- sheet: tempel CSV ---------- */
export function sheetPaste() {
  openSheet('Tempel teks CSV', function (bd) {
    bd.id = 'paste-body';
    var err = el('div', 'err');
    err.id = 'paste-err';
    err.hidden = true;
    bd.appendChild(err);

    var f0 = el('div', 'fld');
    f0.appendChild(el('label', null, 'Akun tujuan'));
    var acct = el('input');
    acct.type = 'hidden'; acct.id = 'paste-acct'; acct.value = 'BCA';
    f0.appendChild(acct);
    var g = el('div', 'acctgrid');
    g.id = 'paste-acctgrid';
    ACCTS.forEach(function (a) {
      var b = el('button', 'acctchip');
      b.type = 'button';
      b.dataset.acct = a;
      b.setAttribute('aria-pressed', a === acct.value ? 'true' : 'false');
      b.appendChild(el('span', 'mono', monogram(a)));
      b.appendChild(el('span', null, a));
      b.addEventListener('click', function () {
        acct.value = a;
        var all = g.querySelectorAll('.acctchip');
        for (var i = 0; i < all.length; i++)
          all[i].setAttribute('aria-pressed', all[i].dataset.acct === a ? 'true' : 'false');
      });
      g.appendChild(b);
    });
    f0.appendChild(g);
    bd.appendChild(f0);

    var f1 = el('div', 'fld');
    var lbl = el('label', null, 'Teks CSV');
    f1.appendChild(lbl);
    var ta = el('textarea', 'ta');
    ta.id = 'paste-text';
    ta.placeholder = 'Tanggal,Keterangan,Jumlah,DB/CR\n01/07,INDOMARET,87.500,DB';
    var kindLine = el('div', 'tiny mut');
    kindLine.id = 'paste-kind';
    kindLine.style.marginTop = '7px';
    ta.addEventListener('input', function () {
      var k = detectSource(ta.value);
      kindLine.textContent = !ta.value.trim() ? ''
        : k === 'klikbca' ? 'Terdeteksi: mutasi KlikBCA'
        : k === 'mybca' ? 'Terdeteksi: mutasi myBCA'
        : k === 'csv' ? 'Terdeteksi: CSV umum'
        : 'Belum terbaca — pastikan ada baris header dengan kolom Tanggal';
      kindLine.dataset.kind = k;
    });
    f1.appendChild(ta);
    f1.appendChild(kindLine);
    bd.appendChild(f1);

    /* Papan klip: paling praktis di Android karena mutasi sering datang lewat
       email. Kalau browser menolak akses, textarea tetap ada. */
    var clip = el('button', 'btn-sm plain');
    clip.id = 'paste-clip';
    clip.style.cssText = 'width:100%;padding:10px;margin-bottom:12px';
    clip.textContent = 'Tempel dari papan klip';
    clip.addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        toast('Papan klip tidak bisa diakses — tempel manual di kotak di bawah');
        return;
      }
      navigator.clipboard.readText().then(function (t) {
        ta.value = t;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      })['catch'](function () {
        toast('Papan klip ditolak browser — tempel manual saja');
      });
    });
    bd.appendChild(clip);

    var b = el('button', 'btn');
    b.id = 'paste-go';
    b.textContent = 'Tinjau';
    b.addEventListener('click', function () {
      var rows;
      try {
        rows = parseImport(ta.value, acct.value);
      } catch (e) {
        err.textContent = e.message;
        err.hidden = false;
        return;
      }
      closeSheet();
      stageRows(rows);
    });
    bd.appendChild(b);
  });
}

/* ---------- sheet: ubah satu baris staging ---------- */
export function sheetStage(sid) {
  var r = null;
  for (var i = 0; i < DATA.staging.length; i++) if (DATA.staging[i].sid === sid) r = DATA.staging[i];
  if (!r) return;
  openSheet('Perbaiki baris', function (bd) {
    bd.id = 'stage-body';
    if (r.raw) {
      var rawBox = el('div', 'tiny mut');
      rawBox.style.cssText = 'background:var(--card);border:1px solid var(--line);' +
        'border-radius:10px;padding:9px 10px;margin-bottom:14px;word-break:break-all';
      rawBox.textContent = r.raw;
      bd.appendChild(rawBox);
    }
    var f1 = el('div', 'fld');
    f1.appendChild(el('label', null, 'Keterangan'));
    var ti = el('input', 'inp');
    ti.id = 'stage-title';
    ti.type = 'text';
    ti.value = r.title;
    f1.appendChild(ti);
    bd.appendChild(f1);

    var f2 = el('div', 'fld');
    f2.appendChild(el('label', null, 'Tanggal'));
    var dt = el('input', 'inp');
    dt.id = 'stage-date';
    dt.type = 'date';
    if (r.s) dt.value = sToInput(r.s);
    f2.appendChild(dt);
    bd.appendChild(f2);

    var f3 = el('div', 'fld');
    f3.appendChild(el('label', null, 'Nominal (negatif = keluar)'));
    var seg = el('div', 'seg');
    seg.id = 'stage-dir';
    [['out', 'Keluar'], ['in', 'Masuk']].forEach(function (m) {
      var b = el('button', null, m[1]);
      b.type = 'button';
      b.dataset.type = m[0];
      var isOut = !(r.amt > 0);
      b.setAttribute('aria-pressed', (m[0] === 'out') === isOut ? 'true' : 'false');
      b.addEventListener('click', function () {
        var all = seg.querySelectorAll('button');
        for (var q = 0; q < all.length; q++)
          all[q].setAttribute('aria-pressed', all[q] === b ? 'true' : 'false');
      });
      seg.appendChild(b);
    });
    f3.appendChild(seg);
    var mo = el('input', 'inp');
    mo.id = 'stage-amt';
    mo.style.marginTop = '9px';
    attachMoney(mo, isNaN(r.amt) ? 0 : Math.abs(r.amt));
    f3.appendChild(mo);
    bd.appendChild(f3);

    var f4 = el('div', 'fld');
    f4.appendChild(el('label', null, 'Kategori'));
    var cat = el('input');
    cat.type = 'hidden'; cat.id = 'stage-cat'; cat.value = r.cat;
    f4.appendChild(cat);
    var grid = el('div', 'catgrid');
    grid.id = 'stage-catgrid';
    DATA.cats.filter(function (c) { return c.kind !== 'tf'; }).forEach(function (c) {
      var b = el('button', 'catchip');
      b.type = 'button';
      b.dataset.cat = c.k;
      b.setAttribute('aria-pressed', c.k === r.cat ? 'true' : 'false');
      b.appendChild(icon(c.ic));
      b.appendChild(el('span', null, c.label));
      b.addEventListener('click', function () {
        cat.value = c.k;
        var all = grid.querySelectorAll('.catchip');
        for (var q = 0; q < all.length; q++)
          all[q].setAttribute('aria-pressed', all[q].dataset.cat === c.k ? 'true' : 'false');
      });
      grid.appendChild(b);
    });
    f4.appendChild(grid);
    bd.appendChild(f4);

    var save_ = el('button', 'btn');
    save_.id = 'stage-save';
    save_.textContent = 'Simpan baris';
    save_.addEventListener('click', function () {
      var mag = moneyVal(mo);
      var isOut = seg.querySelector('button[aria-pressed="true"]').dataset.type === 'out';
      var catLama = r.cat;
      r.title = ti.value.trim() || r.title;
      r.s = inputToS(dt.value) || 0;
      r.amt = isOut ? -mag : mag;
      r.cat = cat.value;
      if (catLama !== r.cat) r.catTouched = true;
      /* Membetulkan kategori satu baris impor biasanya berarti seluruh baris
         bernama sama juga salah — termasuk yang masih menunggu ditinjau. */
      if (catLama !== r.cat && !r.tfAcct) {
        var k = titleKey(r.title), ubah = 0;
        for (var q = 0; q < DATA.staging.length; q++) {
          var o2 = DATA.staging[q];
          if (o2 !== r && !o2.tfAcct && titleKey(o2.title) === k && o2.cat !== r.cat) {
            o2.cat = r.cat;
            ubah++;
          }
        }
        setCatRule(r.title, r.cat);
        if (ubah) toast(ubah + ' baris lain bernama sama ikut diubah · diingat');
      }
      r.forceCheck = false;
      r.hint = '';
      r.selAuto = true;            // kembalikan ke aturan otomatis setelah diperbaiki
      restage(DATA.staging);
      save();
      closeSheet();
      render();
    });
    bd.appendChild(save_);

    var del = el('button', 'btn ghost');
    del.id = 'stage-drop';
    del.style.cssText = 'margin-top:9px;color:var(--down);border-color:rgba(255,123,143,.35)';
    del.textContent = 'Buang baris ini';
    del.addEventListener('click', function () {
      closeSheet();
      withUndo('Baris dibuang', function () {
        DATA.staging = DATA.staging.filter(function (x) { return x.sid !== sid; });
      });
    });
    bd.appendChild(del);
  });
}
