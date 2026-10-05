import { fmtRp } from '../core/money.js';
import { assetClass, contribTotal } from '../core/networth.js';
import { DATA, withUndo } from '../core/store.js';
import { applyFolio, folioPlan, parseFolioCSV } from '../importers/folio.js';
import { el, monogram } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

export function sheetFolio(text) {
  var rows;
  try {
    rows = parseFolioCSV(text);
  } catch (e) {
    toast('Gagal: ' + e.message, { ms: 6000 });
    return;
  }
  openSheet('Impor portofolio', function (bd) {
    bd.id = 'folio-body';
    var target = DATA.networth.assets.filter(function (c) { return c.k !== 'cash'; });
    if (!target.length) {
      bd.appendChild(el('div', 'err', 'Belum ada kelas aset manual. Tambah dulu di layar Akun.'));
      return;
    }
    var k = target[0].k;

    var f0 = el('div', 'fld');
    f0.appendChild(el('label', null, 'Masukkan ke kelas'));
    var hid = el('input');
    hid.type = 'hidden'; hid.id = 'folio-class'; hid.value = k;
    f0.appendChild(hid);
    var g = el('div', 'catgrid');
    g.id = 'folio-classgrid';
    target.forEach(function (c) {
      var b = el('button', 'catchip');
      b.type = 'button';
      b.dataset.cls = c.k;
      b.setAttribute('aria-pressed', c.k === k ? 'true' : 'false');
      b.appendChild(el('span', 'mono', monogram(c.label)));
      b.appendChild(el('span', null, c.label));
      b.addEventListener('click', function () {
        hid.value = c.k;
        var all = g.querySelectorAll('.catchip');
        for (var i = 0; i < all.length; i++)
          all[i].setAttribute('aria-pressed', all[i].dataset.cls === c.k ? 'true' : 'false');
        paint();
      });
      g.appendChild(b);
    });
    f0.appendChild(g);
    bd.appendChild(f0);

    var prev = el('div');
    prev.id = 'folio-preview';
    bd.appendChild(prev);

    var go_ = el('button', 'btn');
    go_.id = 'folio-apply';
    bd.appendChild(go_);
    paint();

    function paint() {
      var plan = folioPlan(hid.value, rows);
      prev.innerHTML = '';
      var nNew = plan.filter(function (p) { return p.kind === 'new'; }).length;
      var nUpd = plan.filter(function (p) { return p.kind === 'update'; }).length;
      var nSame = plan.filter(function (p) { return p.kind === 'same'; }).length;
      var st = el('div', 'stats');
      [['auto', nNew, 'Baru'], ['check', nUpd, 'Diperbarui'], ['dup', nSame, 'Sama']]
        .forEach(function (x) {
          var d = el('div', x[0]);
          d.appendChild(el('div', 'n', String(x[1])));
          d.appendChild(el('div', 'l', x[2]));
          st.appendChild(d);
        });
      prev.appendChild(st);

      var card = el('div', 'card');
      card.id = 'folio-list';
      card.style.padding = '4px 12px';
      plan.forEach(function (p) {
        var r = el('div', 'arow');
        r.dataset.name = p.name;
        r.dataset.kind = p.kind;
        r.dataset.amt = String(p.amt);
        r.appendChild(el('div', 'av', monogram(p.name)));
        var body = el('div', 'body');
        body.appendChild(el('div', 'n1', p.name));
        body.appendChild(el('div', 'n2', p.kind === 'new' ? 'baris baru'
          : p.kind === 'same' ? 'tidak berubah'
          : fmtRp(p.old) + ' → ' + fmtRp(p.amt)));
        r.appendChild(body);
        r.appendChild(el('div', 'v', fmtRp(p.amt)));
        card.appendChild(r);
      });
      prev.appendChild(card);

      var cls = assetClass(hid.value);
      var after = contribTotal(cls.k);
      var seen = {};
      plan.forEach(function (p) { seen[p.name.toLowerCase()] = p.amt; });
      (cls.rows || []).forEach(function (r0) {
        if (!(r0.name.toLowerCase() in seen)) after += r0.amt;
      });
      for (var nm in seen) after += seen[nm];
      var note = el('div', 'tsum');
      note.id = 'folio-after';
      note.dataset.after = String(after);
      note.appendChild(el('span', null, 'Nilai kelas setelah impor'));
      note.appendChild(el('span', 'spacer'));
      note.appendChild(el('b', null, fmtRp(after)));
      prev.appendChild(note);
      var hint = el('div', 'tiny mut');
      hint.style.margin = '9px 0 14px';
      hint.textContent = 'Baris yang tidak ada di berkas dibiarkan apa adanya. ' +
        'Setoran dari transaksi tidak disentuh.';
      prev.appendChild(hint);

      go_.textContent = (nNew + nUpd) ? 'Terapkan ' + (nNew + nUpd) + ' perubahan' : 'Tidak ada perubahan';
      go_.disabled = (nNew + nUpd) === 0;
      go_.onclick = function () {
        var kk = hid.value;
        closeSheet();
        withUndo(nNew + ' baru · ' + nUpd + ' diperbarui', function () {
          applyFolio(kk, folioPlan(kk, rows));
        });
      };
    }
  });
}
