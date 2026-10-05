import { render } from '../app/render.js';
import { catExists, catOf, catsByKind } from '../core/categories.js';
import { ACCTS } from '../core/constants.js';
import { icon } from '../core/icons.js';
import { fmtRpSign } from '../core/money.js';
import { DATA, save, withUndo } from '../core/store.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { el, monogram } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: KELOLA RUTIN BULANAN ==================== */
export function sheetRecurring() {
  openSheet('Rutin bulanan', function (bd) {
    bd.id = 'rec-body';
    var note = el('div', 'tiny mut');
    note.style.margin = '0 0 14px';
    note.textContent = 'Tagihan yang berulang tiap bulan. Mode Auto mencatat ' +
      'sendiri saat jatuh tempo; mode Tanya memunculkan kartu di Dasbor. ' +
      'Tanggal 31 otomatis mundur ke akhir bulan pendek.';
    bd.appendChild(note);
    var host = el('div');
    host.id = 'rec-list';
    bd.appendChild(host);
    fill();

    function fill() {
      host.innerHTML = '';
      if (!DATA.recurring.length) {
        var e = el('div', 'empty');
        e.appendChild(el('div', null, 'Belum ada tagihan rutin'));
        host.appendChild(e);
      }
      var card = el('div', 'card');
      card.style.padding = '4px 14px';
      DATA.recurring.forEach(function (r) { card.appendChild(row(r)); });
      if (DATA.recurring.length) host.appendChild(card);
      host.appendChild(addForm());
    }

    function row(r) {
      var w = el('div', 'crow');
      w.dataset.rec = r.id;
      var av = el('div', 'av' + (r.active === false ? '' : ' g'));
      av.appendChild(icon(catOf(r.cat).ic));
      w.appendChild(av);
      var body = el('div', 'body');
      body.appendChild(el('div', 'nm', r.name));
      body.appendChild(el('div', 'cnt',
        'tiap tanggal ' + r.day + ' · ' + fmtRpSign(r.amt) + ' · ' + r.acct +
        ' · ' + (r.mode === 'auto' ? 'Auto' : 'Tanya') +
        (r.active === false ? ' · nonaktif' : '')));
      w.appendChild(body);

      var tog = el('button', 'pilltog');
      tog.dataset.role = 'aktif';
      tog.textContent = r.active === false ? 'mati' : 'aktif';
      tog.setAttribute('aria-pressed', r.active === false ? 'false' : 'true');
      tog.addEventListener('click', function () {
        r.active = r.active === false;
        save();
        fill();
        render();
      });
      w.appendChild(tog);

      var del = el('button', 'iconbtn danger');
      del.dataset.role = 'del';
      del.setAttribute('aria-label', 'Hapus ' + r.name);
      del.appendChild(icon('trash'));
      var armed = false;
      del.addEventListener('click', function () {
        if (!armed) {
          armed = true;
          del.dataset.armed = '1';
          del.classList.add('armed');
          del.innerHTML = '';
          del.textContent = 'Yakin?';
          return;
        }
        closeSheet();
        withUndo('Rutin "' + r.name + '" dihapus', function () {
          DATA.recurring = DATA.recurring.filter(function (x) { return x.id !== r.id; });
        });
      });
      w.appendChild(del);
      return w;
    }

    function addForm() {
      var wrap = el('div', 'newcat');
      wrap.id = 'rec-new';
      wrap.appendChild(el('label', null, 'Tambah tagihan rutin'));
      var nm = el('input', 'inp');
      nm.id = 'rec-name';
      nm.type = 'text';
      nm.placeholder = 'mis. Internet IndiHome';
      wrap.appendChild(nm);

      var r2 = el('div', 'row2');
      r2.style.marginTop = '9px';
      var amt = el('input', 'inp');
      amt.id = 'rec-amt';
      amt.placeholder = 'Nominal';
      attachMoney(amt, 0);
      r2.appendChild(amt);
      var day = el('input', 'inp');
      day.id = 'rec-day';
      day.type = 'number';
      day.min = '1';
      day.max = '31';
      day.value = '1';
      day.placeholder = 'Tgl';
      r2.appendChild(day);
      wrap.appendChild(r2);

      var lab = el('div', 'sublab');
      lab.style.margin = '12px 0 6px';
      lab.textContent = 'Akun';
      wrap.appendChild(lab);
      var hidA = el('input');
      hidA.type = 'hidden'; hidA.id = 'rec-acct'; hidA.value = 'BCA';
      wrap.appendChild(hidA);
      var ga = el('div', 'acctgrid');
      ga.id = 'rec-acctgrid';
      ACCTS.forEach(function (a) {
        var b = el('button', 'acctchip');
        b.type = 'button';
        b.dataset.acct = a;
        b.setAttribute('aria-pressed', a === hidA.value ? 'true' : 'false');
        b.appendChild(el('span', 'mono', monogram(a)));
        b.appendChild(el('span', null, a));
        b.addEventListener('click', function () {
          hidA.value = a;
          var all = ga.querySelectorAll('.acctchip');
          for (var i = 0; i < all.length; i++)
            all[i].setAttribute('aria-pressed', all[i].dataset.acct === a ? 'true' : 'false');
        });
        ga.appendChild(b);
      });
      wrap.appendChild(ga);

      var lab2 = el('div', 'sublab');
      lab2.style.margin = '12px 0 6px';
      lab2.textContent = 'Kategori';
      wrap.appendChild(lab2);
      var hidC = el('input');
      hidC.type = 'hidden'; hidC.id = 'rec-cat';
      hidC.value = catExists('tagihan') ? 'tagihan' : catsByKind('out')[0].k;
      wrap.appendChild(hidC);
      var gc = el('div', 'catgrid');
      gc.id = 'rec-catgrid';
      catsByKind('out').forEach(function (c) {
        var b = el('button', 'catchip');
        b.type = 'button';
        b.dataset.cat = c.k;
        b.setAttribute('aria-pressed', c.k === hidC.value ? 'true' : 'false');
        b.appendChild(icon(c.ic));
        b.appendChild(el('span', null, c.label));
        b.addEventListener('click', function () {
          hidC.value = c.k;
          var all = gc.querySelectorAll('.catchip');
          for (var i = 0; i < all.length; i++)
            all[i].setAttribute('aria-pressed', all[i].dataset.cat === c.k ? 'true' : 'false');
        });
        gc.appendChild(b);
      });
      wrap.appendChild(gc);

      var lab3 = el('div', 'sublab');
      lab3.style.margin = '12px 0 6px';
      lab3.textContent = 'Mode';
      wrap.appendChild(lab3);
      var seg = el('div', 'seg');
      seg.id = 'rec-mode';
      [['ask', 'Tanya dulu'], ['auto', 'Catat otomatis']].forEach(function (m) {
        var b = el('button', null, m[1]);
        b.type = 'button';
        b.dataset.mode = m[0];
        b.setAttribute('aria-pressed', m[0] === 'ask' ? 'true' : 'false');
        b.addEventListener('click', function () {
          var all = seg.querySelectorAll('button');
          for (var i = 0; i < all.length; i++)
            all[i].setAttribute('aria-pressed', all[i] === b ? 'true' : 'false');
        });
        seg.appendChild(b);
      });
      wrap.appendChild(seg);

      var err = el('div', 'err');
      err.id = 'rec-err';
      err.hidden = true;
      err.style.margin = '11px 0 0';
      wrap.appendChild(err);

      var add = el('button', 'btn-sm');
      add.id = 'rec-add';
      add.style.cssText = 'margin-top:11px;width:100%;padding:10px';
      add.textContent = 'Tambah';
      add.addEventListener('click', function () {
        var nmv = nm.value.trim(), amtv = moneyVal(amt), dayv = parseInt(day.value, 10);
        if (!nmv) { err.textContent = 'Nama belum diisi.'; err.hidden = false; return; }
        if (!amtv) { err.textContent = 'Nominal belum diisi.'; err.hidden = false; return; }
        if (!(dayv >= 1 && dayv <= 31)) {
          err.textContent = 'Tanggal harus 1–31.';
          err.hidden = false;
          return;
        }
        DATA.recurring.push({
          id: 'r' + (++DATA.seq), name: nmv, cat: hidC.value, acct: hidA.value,
          amt: -Math.abs(amtv), day: dayv,
          mode: seg.querySelector('button[aria-pressed="true"]').dataset.mode,
          doneYm: 0, active: true
        });
        save();
        nm.value = '';
        err.hidden = true;
        fill();
        render();
        toast('Rutin "' + nmv + '" ditambahkan');
      });
      wrap.appendChild(add);
      return wrap;
    }
  });
}
