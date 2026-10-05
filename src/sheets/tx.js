import { render } from '../app/render.js';
import { catExists, catKeyFor, catLabelExists, catOf, catsByKind } from '../core/categories.js';
import { ACCTS, TF_CAT } from '../core/constants.js';
import { inputToS, sToInput, sYm, todayS } from '../core/dates.js';
import { findItem } from '../core/derived.js';
import { PICKABLE_ICONS, icon } from '../core/icons.js';
import { fmtRp, fmtRpSign } from '../core/money.js';
import { DATA, addItem, removeItem, save, updateItem, withUndo } from '../core/store.js';
import { isClassKey, isTf, legLabel, mkTfAcct, tfLegs } from '../core/transfer.js';
import { offerRecat } from '../features/categorize.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { UI, el, monogram } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== FORM TRANSAKSI (tambah & ubah) ====================
   Satu form untuk dua mode. Kalau id diberikan, form terisi dan tombol Hapus
   muncul. Menyimpan dalam mode ubah MEMPERTAHANKAN id meski tanggal pindah. */
export function sheetTx(id) {
  var ex = id != null ? findItem(id) : null;
  var isEdit = !!ex;
  openSheet(isEdit ? 'Ubah transaksi' : 'Catat transaksi', function (bd) {
    var mode = !isEdit ? 'out' : (isTf(ex.it) ? 'tf' : (ex.it.amt >= 0 ? 'in' : 'out'));

    var errBox = el('div', 'err');
    errBox.id = 'f-err';
    errBox.hidden = true;
    bd.appendChild(errBox);

    /* jenis */
    var f0 = el('div', 'fld');
    f0.appendChild(el('label', null, 'Jenis'));
    var seg = el('div', 'seg');
    seg.id = 'f-type';
    var modes = [['out','Keluar'], ['in','Masuk'], ['tf','Transfer']];
    var segBtns = {};
    modes.forEach(function (m) {
      var b = el('button', null, m[1]);
      b.type = 'button';
      b.dataset.type = m[0];
      b.setAttribute('aria-pressed', m[0] === mode ? 'true' : 'false');
      b.addEventListener('click', function () { setMode(m[0]); });
      seg.appendChild(b);
      segBtns[m[0]] = b;
    });
    f0.appendChild(seg);
    bd.appendChild(f0);

    /* nominal */
    var f1 = el('div', 'fld');
    f1.appendChild(el('label', null, 'Nominal'));
    var amt = el('input', 'inp money');
    amt.id = 'f-amt';
    amt.placeholder = 'Rp0';
    attachMoney(amt, isEdit ? ex.it.amt : 0);
    f1.appendChild(amt);
    bd.appendChild(f1);

    /* kategori — grid, SEMUA pilihan terlihat sekaligus (bukan dropdown).
       Nilai terpilih hidup di satu tempat: input hidden #f-cat. */
    var f2 = el('div', 'fld');
    f2.id = 'f-cat-fld';
    f2.appendChild(el('label', null, 'Kategori'));
    var cat = el('input');
    cat.type = 'hidden';
    cat.id = 'f-cat';
    f2.appendChild(cat);
    var grid = el('div', 'catgrid');
    grid.id = 'f-catgrid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Kategori');
    f2.appendChild(grid);
    bd.appendChild(f2);

    /* akun — chip, bahasa visual sama dengan kategori (bukan dropdown native).
       Mode transfer memunculkan grup kedua: Dari ↓ Ke. */
    var f3 = el('div', 'fld');
    f3.id = 'f-acct-fld';
    var lab3 = el('label', null, 'Akun');
    lab3.id = 'f-acct-label';
    f3.appendChild(lab3);

    var exLeg = isEdit && isTf(ex.it) ? tfLegs(ex.it) : null;
    var acct = el('input');
    acct.type = 'hidden'; acct.id = 'f-acct';
    acct.value = exLeg ? exLeg.from : (isEdit ? ex.it.acct : 'BCA');
    var acct2 = el('input');
    acct2.type = 'hidden'; acct2.id = 'f-acct2';
    acct2.value = exLeg ? exLeg.to
                        : ACCTS.filter(function (x) { return x !== acct.value; })[0];
    f3.appendChild(acct); f3.appendChild(acct2);

    var g1 = el('div', 'acctgrid');
    g1.id = 'f-acctgrid';
    g1.setAttribute('role', 'group');
    g1.setAttribute('aria-label', 'Akun');
    f3.appendChild(g1);

    var tw = el('div');
    tw.id = 'f-acct2-wrap';
    tw.hidden = true;
    var sep = el('div', 'tfsep');
    sep.appendChild(el('span', 'ln'));
    sep.appendChild(icon('arrow_d'));
    sep.appendChild(el('span', 'ln'));
    tw.appendChild(sep);
    var sl = el('label', 'sublab', 'Ke akun');
    sl.id = 'f-acct2-label';
    tw.appendChild(sl);
    var g2 = el('div', 'acctgrid');
    g2.id = 'f-acctgrid2';
    g2.setAttribute('role', 'group');
    g2.setAttribute('aria-label', 'Akun tujuan');
    tw.appendChild(g2);
    f3.appendChild(tw);
    bd.appendChild(f3);

    /* judul */
    var f4 = el('div', 'fld');
    f4.appendChild(el('label', null, 'Keterangan'));
    var title = el('input', 'inp');
    title.id = 'f-title';
    title.type = 'text';
    title.autocomplete = 'off';
    title.placeholder = 'mis. Kopi pagi';
    if (isEdit) title.value = ex.it.title || '';
    f4.appendChild(title);
    bd.appendChild(f4);

    /* tanggal */
    var f5 = el('div', 'fld');
    f5.appendChild(el('label', null, 'Tanggal'));
    var date = el('input', 'inp');
    date.id = 'f-date';
    date.type = 'date';
    date.value = sToInput(isEdit ? ex.day.s : todayS());
    f5.appendChild(date);
    bd.appendChild(f5);

    var save_ = el('button', 'btn', isEdit ? 'Simpan perubahan' : 'Simpan');
    save_.id = 'f-save';
    save_.type = 'button';
    bd.appendChild(save_);

    /* Hapus: dua ketuk (arm -> konfirmasi) DAN tetap punya Urungkan. */
    if (isEdit) {
      var del = el('button', 'btn ghost');
      del.id = 'f-del';
      del.type = 'button';
      del.style.marginTop = '9px';
      del.style.color = 'var(--down)';
      del.style.borderColor = 'rgba(255,123,143,.35)';
      del.appendChild(icon('trash'));
      del.appendChild(el('span', null, ' Hapus transaksi'));
      del.querySelector('.ic').style.cssText =
        'display:inline-block;vertical-align:-3px;margin-right:6px;width:15px;height:15px';
      var armed = false;
      del.addEventListener('click', function () {
        if (!armed) {
          armed = true;
          del.dataset.armed = '1';
          del.textContent = 'Ketuk sekali lagi untuk menghapus';
          return;
        }
        var label = ex.it.title || catOf(ex.it.cat).label;
        closeSheet();
        withUndo('Dihapus · ' + label, function () { removeItem(id); });
      });
      bd.appendChild(del);
    }

    /* --- akun: satu builder, dua grup, tanpa state ganda ---
       Di mode transfer, grid ikut memuat KELAS ASET sebagai kaki yang sah:
       BCA → Saham itu setoran investasi, Saham → Kripto itu rebalance.
       Kelas 'cash' tidak ikut — kas ITU akun-akunnya sendiri. */
    function buildAcct(host, input) {
      host.innerHTML = '';
      function chip(key, label, mono) {
        var b = el('button', 'acctchip');
        b.type = 'button';
        b.dataset.acct = key;
        b.setAttribute('aria-pressed', 'false');
        b.appendChild(el('span', 'mono', mono));
        b.appendChild(el('span', null, label));
        b.addEventListener('click', function () { pickAcct(input, key); });
        return b;
      }
      ACCTS.forEach(function (a) { host.appendChild(chip(a, a, monogram(a))); });
      if (mode !== 'tf') return;
      var cls = DATA.networth.assets.filter(function (c) { return c.k !== 'cash'; });
      if (!cls.length) return;
      var lab = el('div', 'sublab');
      lab.style.cssText = 'grid-column:1/-1;margin:10px 0 0';
      lab.textContent = 'Kelas aset';
      host.appendChild(lab);
      cls.forEach(function (c) {
        host.appendChild(chip(c.k, c.label, monogram(c.label)));
      });
    }
    function syncAcct() {
      [[g1, acct], [g2, acct2]].forEach(function (p) {
        var chips = p[0].querySelectorAll('.acctchip');
        for (var i = 0; i < chips.length; i++)
          chips[i].setAttribute('aria-pressed', chips[i].dataset.acct === p[1].value ? 'true' : 'false');
      });
    }
    /* Di mode transfer dua kaki tak boleh sama, jadi memilih akun yang sudah
       dipakai kaki lain akan MENUKAR keduanya — bukan memunculkan error. */
    function pickAcct(input, a) {
      var other = input === acct ? acct2 : acct;
      if (mode === 'tf' && other.value === a) other.value = input.value;
      input.value = a;
      syncAcct();
      errBox.hidden = true;
    }
    function pickCat(k) {
      cat.value = k;
      var chips = grid.querySelectorAll('.catchip');
      for (var i = 0; i < chips.length; i++)
        chips[i].setAttribute('aria-pressed', chips[i].dataset.cat === k ? 'true' : 'false');
      errBox.hidden = true;
    }
    function fillCats(want) {
      grid.innerHTML = '';
      var kind = mode === 'in' ? 'in' : 'out';
      var list = catsByKind(kind);
      list.forEach(function (c) {
        var b = el('button', 'catchip');
        b.type = 'button';
        b.dataset.cat = c.k;
        b.setAttribute('aria-pressed', 'false');
        b.appendChild(icon(c.ic));
        b.appendChild(el('span', null, c.label));
        b.addEventListener('click', function () { pickCat(c.k); });
        grid.appendChild(b);
      });
      /* chip terakhir: buat kategori sendiri */
      var add = el('button', 'catchip addchip');
      add.type = 'button';
      add.id = 'f-cat-add';
      add.setAttribute('aria-expanded', 'false');
      add.appendChild(icon('plus'));
      add.appendChild(el('span', null, 'Tambah'));
      add.addEventListener('click', function () { toggleNewCat(); });
      grid.appendChild(add);

      var keep = want && list.some(function (c) { return c.k === want; });
      pickCat(keep ? want : (list.length ? list[0].k : ''));
    }

    /* --- panel kategori baru: nama + pemilih ikon, inline di dalam sheet --- */
    var np = el('div', 'newcat');
    np.id = 'f-newcat';
    np.hidden = true;
    np.appendChild(el('label', null, 'Kategori baru'));
    var nName = el('input', 'inp');
    nName.id = 'f-newcat-name';
    nName.type = 'text';
    nName.autocomplete = 'off';
    nName.placeholder = 'mis. Kopi, Kos, Donasi';
    np.appendChild(nName);
    var nIc = el('input');
    nIc.type = 'hidden'; nIc.id = 'f-newcat-ic'; nIc.value = PICKABLE_ICONS[0];
    np.appendChild(nIc);
    var ip = el('div', 'ipick');
    ip.id = 'f-newcat-icons';
    PICKABLE_ICONS.forEach(function (nm) {
      var b = el('button');
      b.type = 'button';
      b.dataset.ic = nm;
      b.setAttribute('aria-label', 'Ikon ' + nm);
      b.setAttribute('aria-pressed', nm === nIc.value ? 'true' : 'false');
      b.appendChild(icon(nm));
      b.addEventListener('click', function () {
        nIc.value = nm;
        var all = ip.querySelectorAll('button');
        for (var i = 0; i < all.length; i++)
          all[i].setAttribute('aria-pressed', all[i].dataset.ic === nm ? 'true' : 'false');
      });
      ip.appendChild(b);
    });
    np.appendChild(ip);
    var nErr = el('div', 'err');
    nErr.id = 'f-newcat-err';
    nErr.hidden = true;
    nErr.style.margin = '10px 0 0';
    np.appendChild(nErr);
    var nSave = el('button', 'btn-sm');
    nSave.id = 'f-newcat-save';
    nSave.type = 'button';
    nSave.textContent = 'Buat kategori';
    nSave.style.cssText = 'margin-top:11px;width:100%;padding:10px';
    np.appendChild(nSave);
    f2.appendChild(np);

    function toggleNewCat(force) {
      var open = force != null ? force : np.hidden;
      np.hidden = !open;
      var add = document.getElementById('f-cat-add');
      if (add) add.setAttribute('aria-expanded', open ? 'true' : 'false');
      nErr.hidden = true;
      if (open) nName.focus();
    }
    nSave.addEventListener('click', function () {
      var name = nName.value.trim();
      if (!name) { nErr.textContent = 'Nama kategori belum diisi.'; nErr.hidden = false; return; }
      var k = catKeyFor(name);
      if (!k) { nErr.textContent = 'Nama itu tidak bisa dipakai, coba yang lain.'; nErr.hidden = false; return; }
      if (catExists(k) || catLabelExists(name)) {
        nErr.textContent = 'Kategori "' + name + '" sudah ada.';
        nErr.hidden = false;
        return;
      }
      DATA.cats.push({ k: k, label: name, ic: nIc.value, kind: mode === 'in' ? 'in' : 'out' });
      save();
      nName.value = '';
      toggleNewCat(false);
      fillCats(k);                        // langsung terpilih
      toast('Kategori "' + name + '" dibuat');
    });

    function setMode(m) {
      mode = m;
      for (var k in segBtns) segBtns[k].setAttribute('aria-pressed', k === m ? 'true' : 'false');
      var tf = m === 'tf';
      f2.hidden = tf;
      tw.hidden = !tf;
      /* jaga dua kaki selalu beda saat masuk mode transfer */
      if (tf && acct.value === acct2.value)
        acct2.value = ACCTS.filter(function (x) { return x !== acct.value; })[0];
      lab3.textContent = tf ? 'Dari akun / kelas' : 'Akun';
      sl.textContent = 'Ke akun / kelas';
      buildAcct(g1, acct);
      buildAcct(g2, acct2);
      syncAcct();
      if (tf) toggleNewCat(false);
      else fillCats(isEdit ? ex.it.cat : null);
      errBox.hidden = true;
    }
    setMode(mode);

    function fail(msg) {
      errBox.textContent = msg;
      errBox.hidden = false;
    }
    save_.addEventListener('click', function () {
      var n = moneyVal(amt);
      var s = inputToS(date.value);
      if (!n)                       return fail('Nominal belum diisi.');
      if (!s)                       return fail('Tanggal tidak valid.');
      if (mode !== 'tf' && !cat.value) return fail('Kategori belum dipilih.');
      if (mode === 'tf' && acct.value === acct2.value)
        return fail('Akun asal dan tujuan tidak boleh sama.');

      var o;
      if (mode === 'tf') {
        var legs = mkTfAcct(acct.value, acct2.value);
        var invest = isClassKey(acct.value) || isClassKey(acct2.value);
        /* Kategori diturunkan dari kakinya, bukan dipilih user — kalau dipilih
           terpisah, suatu hari akan ada "investasi" yang kakinya dua akun. */
        var kat = invest && catExists('investasi') ? 'investasi' : TF_CAT;
        o = { s: s, cat: kat, transfer: true, acct: legs, amt: -n,
              title: title.value.trim() || (invest ? legLabel(acct2.value) : 'Transfer') };
      } else {
        o = { s: s, cat: cat.value, title: title.value.trim() || catOf(cat.value).label,
              acct: acct.value, amt: mode === 'in' ? n : -n };
      }
      if (isEdit) {
        var catBerubah = mode !== 'tf' && ex.it.cat !== o.cat;
        closeSheet();
        if (UI.scope === 'month') UI.ym = sYm(s);
        withUndo('Perubahan disimpan', function () { updateItem(id, o); });
        /* Kategori baru saja diubah? Tawarkan yang senama sekalian. */
        if (catBerubah) offerRecat(o.title, o.cat, id);
        return;
      }
      addItem(o);
      save();
      UI.ym = sYm(s);
      UI.scope = 'month';
      if (UI.tab !== 'transaksi' && UI.tab !== 'dasbor') UI.tab = 'transaksi';
      closeSheet();
      render();
      toast(mode === 'tf' ? 'Transfer dicatat · ' + fmtRp(n)
                          : 'Dicatat · ' + fmtRpSign(o.amt));
    });
  });
}
