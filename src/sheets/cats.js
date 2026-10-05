import { render } from '../app/render.js';
import { catLabelExists, catUsage, catsByKind, isDefaultCat } from '../core/categories.js';
import { TF_CAT } from '../core/constants.js';
import { allItems } from '../core/derived.js';
import { icon } from '../core/icons.js';
import { DATA, save, withUndo } from '../core/store.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: KELOLA KATEGORI ==================== */
export function sheetCats() {
  openSheet('Kelola kategori', function (bd) {
    bd.id = 'cats-body';
    var note = el('div', 'tiny mut');
    note.style.margin = '0 0 14px';
    note.textContent = 'Ubah nama, atau hapus yang tak terpakai. Transaksi yang ' +
      'memakai kategori terhapus dipindahkan ke Lain-lain.';
    bd.appendChild(note);

    var host = el('div');
    host.id = 'cats-list';
    bd.appendChild(host);
    fill();

    function fill() {
      host.innerHTML = '';
      [['out', 'Pengeluaran'], ['in', 'Pemasukan']].forEach(function (grp) {
        var list = catsByKind(grp[0]);
        if (!list.length) return;
        host.appendChild(el('div', 'sublab', grp[1]));
        var card = el('div', 'card');
        card.style.padding = '4px 14px';
        list.forEach(function (c) { card.appendChild(row(c)); });
        host.appendChild(card);
      });
    }

    function row(c) {
      var r = el('div', 'crow');
      r.dataset.cat = c.k;
      var av = el('div', 'av');
      av.appendChild(icon(c.ic));
      r.appendChild(av);

      var body = el('div', 'body');
      var inp = el('input', 'inp');
      inp.type = 'text';
      inp.value = c.label;
      inp.dataset.role = 'label';
      inp.addEventListener('change', function () {
        var v = inp.value.trim();
        if (!v) { inp.value = c.label; return; }
        if (v.toLowerCase() !== c.label.toLowerCase() && catLabelExists(v)) {
          inp.value = c.label;
          toast('Nama "' + v + '" sudah dipakai');
          return;
        }
        c.label = v;                       // kunci TIDAK diubah — item tetap nyambung
        save();
        render();
        toast('Nama diubah');
      });
      body.appendChild(inp);
      var used = catUsage(c.k);
      body.appendChild(el('div', 'cnt', used ? used + ' transaksi' : 'belum dipakai'));
      r.appendChild(body);

      /* 'lain' adalah tujuan pengalihan, jadi tak boleh ikut dihapus. */
      if (c.k === 'lain' || c.k === TF_CAT) {
        var lock = el('div', 'tiny mut');
        lock.style.cssText = 'flex:0 0 auto;padding-right:4px';
        lock.textContent = 'tetap';
        r.appendChild(lock);
        return r;
      }

      var del = el('button', 'iconbtn danger');
      del.dataset.role = 'del';
      del.setAttribute('aria-label', 'Hapus ' + c.label);
      del.appendChild(icon('trash'));
      var armed = false;
      del.addEventListener('click', function () {
        if (!armed) {
          armed = true;
          del.classList.add('armed');
          del.dataset.armed = '1';
          del.innerHTML = '';
          del.textContent = used ? 'Pindah ' + used + ' & hapus?' : 'Yakin?';
          return;
        }
        closeSheet();
        withUndo(used ? 'Kategori dihapus · ' + used + ' transaksi ke Lain-lain'
                      : 'Kategori dihapus', function () {
          var all = allItems();
          for (var i = 0; i < all.length; i++)
            if (all[i].it.cat === c.k) all[i].it.cat = 'lain';
          DATA.cats = DATA.cats.filter(function (x) { return x.k !== c.k; });
          /* kategori bawaan harus dicatat, kalau tidak migrate() akan
             memunculkannya lagi setiap kali app dibuka */
          if (isDefaultCat(c.k)) {
            if (!DATA.catsRemoved) DATA.catsRemoved = [];
            if (DATA.catsRemoved.indexOf(c.k) < 0) DATA.catsRemoved.push(c.k);
          }
          /* anggaran kategori itu ikut dibersihkan supaya tidak jadi hantu */
          delete DATA.budgets[c.k];
          for (var m in DATA.budgetsMo) delete DATA.budgetsMo[m][c.k];
        });
      });
      r.appendChild(del);
      return r;
    }
  });
}
