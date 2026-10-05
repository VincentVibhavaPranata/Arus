import { render } from '../app/render.js';
import { budgetFor, budgetIsOverride, budgetPct, budgetedCats } from '../core/budget.js';
import { catOf, catsByKind, ymRange } from '../core/categories.js';
import { sLabel, ymAdd, ymLabel } from '../core/dates.js';
import { catSpend, monthTotals } from '../core/derived.js';
import { icon } from '../core/icons.js';
import { fmtRp, fmtRpShort, fmtRpSign } from '../core/money.js';
import { DATA, save, withUndo } from '../core/store.js';
import { recDueDate, recPending, recPost, recSkip } from '../features/recurring.js';
import { sechd } from './lainnya.js';
import { sheetBudget } from '../sheets/budget.js';
import { sheetGoal } from '../sheets/goal.js';
import { setNum } from '../ui/animate.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { UI, el } from '../ui/nav.js';

/* ============================ RENDER: DASBOR ============================ */
export function viewDasbor(root) {
  var t = monthTotals(UI.ym), rg = ymRange();

  /* --- hero --- */
  var hero = el('div', 'hero');
  var mrow = el('div', 'mrow');
  var prev = el('button', 'mnav');
  prev.appendChild(icon('chev_l'));
  prev.id = 'm-prev'; prev.setAttribute('aria-label', 'Bulan sebelumnya');
  prev.disabled = UI.ym <= ymAdd(rg.min, -1);
  var next = el('button', 'mnav');
  next.appendChild(icon('chev_r'));
  next.id = 'm-next'; next.setAttribute('aria-label', 'Bulan berikutnya');
  next.disabled = UI.ym >= ymAdd(rg.max, 1);
  var lab = el('div', 'mlab', ymLabel(UI.ym));
  lab.id = 'month-label'; lab.dataset.ym = String(UI.ym);
  prev.addEventListener('click', function () { UI.ym = ymAdd(UI.ym, -1); render(); });
  next.addEventListener('click', function () { UI.ym = ymAdd(UI.ym,  1); render(); });
  mrow.appendChild(prev); mrow.appendChild(lab); mrow.appendChild(next);
  hero.appendChild(mrow);

  hero.appendChild(el('div', 'biglab', 'Pengeluaran bulan ini'));
  var big = el('div', 'big');
  big.id = 'sum-out';
  hero.appendChild(big);
  setNum(big, t.out);

  var pair = el('div', 'pair');
  function cell(k, v, id, cls) {
    var d = el('div');
    d.appendChild(el('div', 'k', k));
    var s = el('div', 'v' + (cls ? ' ' + cls : ''));
    s.id = id;
    d.appendChild(s);
    setNum(s, v, id === 'sum-net' ? fmtRpSign : fmtRp);
    return d;
  }
  pair.appendChild(cell('Masuk', t.in, 'sum-in', 'pos'));
  pair.appendChild(cell('Selisih', t.net, 'sum-net', t.net >= 0 ? 'pos' : 'neg'));
  hero.appendChild(pair);

  /* Pita komposisi: ke mana uang bulan ini mengalir. Lebar = porsi pengeluaran. */
  var sp = catSpend(UI.ym);
  var keys = Object.keys(sp).filter(function (k) { return sp[k] > 0; })
    .sort(function (a, b) { return sp[b] - sp[a]; });
  if (keys.length) {
    var tot = keys.reduce(function (a, k) { return a + sp[k]; }, 0);
    var rib = el('div', 'ribbon');
    rib.setAttribute('role', 'img');
    rib.setAttribute('aria-label', 'Komposisi pengeluaran bulan ini');
    keys.forEach(function (k) {
      var seg = el('i');
      seg.dataset.cat = k;
      seg.style.flexGrow = String(sp[k]);
      seg.title = catOf(k).label + ' · ' + fmtRpShort(sp[k]);
      rib.appendChild(seg);
    });
    hero.appendChild(rib);
    var lg = el('div', 'ribleg');
    keys.slice(0, 3).forEach(function (k) {
      var sx = el('span');
      sx.dataset.cat = k;
      sx.appendChild(el('b'));
      sx.appendChild(document.createTextNode(catOf(k).label + ' ' + Math.round(sp[k] / tot * 100) + '%'));
      lg.appendChild(sx);
    });
    hero.appendChild(lg);
  }
  root.appendChild(hero);

  /* kartu jatuh tempo (mode tanya) — di atas anggaran karena butuh tindakan */
  var due = recPending().filter(function (p) { return p.r.mode !== 'auto'; });
  if (due.length) {
    root.appendChild(sechd('Jatuh tempo'));
    var dc = el('div', 'card');
    dc.id = 'due-card';
    dc.dataset.n = String(due.length);
    dc.style.padding = '4px 14px';
    due.forEach(function (p) {
      var r = p.r;
      var row = el('div', 'arow');
      row.dataset.due = r.id + ':' + p.ym;
      var av = el('div', 'av g');
      av.appendChild(icon('repeat'));
      row.appendChild(av);
      var body = el('div', 'body');
      body.appendChild(el('div', 'n1', r.name));
      body.appendChild(el('div', 'n2', sLabel(recDueDate(r, p.ym)) + ' · ' +
        catOf(r.cat).label + ' · ' + r.acct));
      row.appendChild(body);
      var right = el('div');
      right.style.cssText = 'flex:0 0 auto;text-align:right';
      right.appendChild(el('div', 'v', fmtRpSign(r.amt)));
      var btns = el('div');
      btns.style.cssText = 'display:flex;gap:6px;margin-top:6px';
      var ok_ = el('button', 'btn-sm');
      ok_.dataset.role = 'catat';
      ok_.textContent = 'Catat';
      ok_.addEventListener('click', function () {
        withUndo(r.name + ' dicatat', function () { recPost(r, p.ym); });
      });
      var sk = el('button', 'btn-sm plain');
      sk.dataset.role = 'lewati';
      sk.textContent = 'Lewati';
      sk.addEventListener('click', function () {
        withUndo(r.name + ' dilewati', function () { recSkip(r, p.ym); });
      });
      btns.appendChild(ok_);
      btns.appendChild(sk);
      right.appendChild(btns);
      row.appendChild(right);
      dc.appendChild(row);
    });
    root.appendChild(dc);
  }

  root.appendChild(secEdit('Anggaran', 'budget'));
  root.appendChild(UI.edit.budget ? budgetEdit() : budgetView());
  root.appendChild(secEdit('Tujuan', 'goals'));
  root.appendChild(UI.edit.goals ? goalEdit() : goalView());
}

/* Kepala seksi dengan tombol Atur ↔ Selesai. Keluar dari mode Atur menyimpan
   dan me-render ulang, jadi angka yang tampil selalu hasil hitung ulang. */
export function secEdit(title, key) {
  var s = el('div', 'sec');
  s.appendChild(el('h2', null, title));
  s.appendChild(el('span', 'spacer'));
  var on = UI.edit[key];
  var b = el('button', 'btn-sm' + (on ? '' : ' plain'));
  b.id = 'edit-' + key;
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on) b.appendChild(icon('check'));
  b.appendChild(el('span', null, on ? 'Selesai' : 'Atur'));
  b.addEventListener('click', function () {
    UI.edit[key] = !on;
    if (on) save();
    render();
  });
  s.appendChild(b);
  return s;
}

/* ---------- anggaran: tampilan ---------- */
export function budgetView() {
  var cats = budgetedCats(UI.ym), spend = catSpend(UI.ym);
  var bc = el('div', 'card');
  bc.id = 'budget-card';
  if (!cats.length) {
    var e0 = el('div', 'empty');
    e0.appendChild(el('span', 'ic', '◎'));
    e0.appendChild(el('div', null, 'Belum ada anggaran'));
    e0.appendChild(el('div', 'tiny mut', 'Ketuk Atur untuk menetapkan batas per kategori'));
    bc.appendChild(e0);
    return bc;
  }
  cats.sort(function (a, b) {
    return budgetPct(spend[b] || 0, budgetFor(b, UI.ym)) -
           budgetPct(spend[a] || 0, budgetFor(a, UI.ym));
  });
  for (var i = 0; i < cats.length; i++) {
    var k = cats[i], c = catOf(k), lim = budgetFor(k, UI.ym), used = spend[k] || 0;
    var pct = budgetPct(used, lim);
    /* Barisnya BISA DIKETUK. Kalau tidak, satu-satunya jalan mengubah anggaran
       adalah masuk mode Atur dulu — dan baris yang kelihatan bisa ditekan tapi
       diam saja itu bikin bingung. */
    var row = el('button', 'bud');
    row.type = 'button';
    row.dataset.cat = k;
    (function (kk) {
      row.addEventListener('click', function () { sheetBudget(kk); });
    })(k);
    row.dataset.used = String(used);
    row.dataset.limit = String(lim);
    var av = el('div', 'av');
    av.appendChild(icon(c.ic));
    row.appendChild(av);
    var body = el('div', 'body');
    var top = el('div', 'top');
    var nm = el('div', 'nm');
    nm.appendChild(document.createTextNode(c.label));
    if (budgetIsOverride(k, UI.ym)) nm.appendChild(el('span', 'pill', 'bulan ini'));
    top.appendChild(nm);
    top.appendChild(el('div', 'num', fmtRpShort(used) + ' / ' + fmtRpShort(lim)));
    body.appendChild(top);
    var tr = el('div', 'track');
    var fl = el('div', 'fill' + (pct > 1 ? ' over' : ''));
    fl.style.width = Math.min(100, pct * 100).toFixed(1) + '%';
    tr.appendChild(fl);
    body.appendChild(tr);
    if (pct > 1) body.appendChild(el('div', 'ovf', 'Lewat ' + fmtRp(used - lim)));
    row.appendChild(body);
    bc.appendChild(row);
  }
  return bc;
}

/* ---------- anggaran: mode Atur ----------
   Nilai ditulis ke DATA saat input kehilangan fokus (change), BUKAN saat
   mengetik — kalau tiap ketukan memicu render, kursor akan terlempar. */
export function budgetEdit() {
  var bc = el('div', 'card');
  bc.id = 'budget-card';
  bc.dataset.mode = 'edit';
  var cats = budgetedCats(UI.ym);

  cats.forEach(function (k) {
    var c = catOf(k);
    var r = el('div', 'ebar');
    r.dataset.cat = k;
    var av = el('div', 'av');
    av.appendChild(icon(c.ic));
    r.appendChild(av);

    var body = el('div', 'body');
    var nm = el('div', 'nm');
    nm.appendChild(document.createTextNode(c.label));
    var tog = el('button', 'pilltog');
    tog.dataset.role = 'override';
    tog.textContent = 'bulan ini';
    var isOv = budgetIsOverride(k, UI.ym);
    tog.setAttribute('aria-pressed', isOv ? 'true' : 'false');
    tog.addEventListener('click', function () {
      if (isOv) {
        delete DATA.budgetsMo[UI.ym][k];
      } else {
        if (!DATA.budgetsMo[UI.ym]) DATA.budgetsMo[UI.ym] = {};
        DATA.budgetsMo[UI.ym][k] = budgetFor(k, UI.ym);
      }
      save();
      render();
    });
    nm.appendChild(tog);
    body.appendChild(nm);
    body.appendChild(el('div', 'tiny mut', isOv ? 'khusus ' + ymLabel(UI.ym) : 'berlaku semua bulan'));
    r.appendChild(body);

    var inp = el('input', 'inp w-money');
    inp.dataset.role = 'limit';
    attachMoney(inp, budgetFor(k, UI.ym));
    inp.addEventListener('change', function () {
      var v = moneyVal(inp);
      if (budgetIsOverride(k, UI.ym)) DATA.budgetsMo[UI.ym][k] = v;
      else DATA.budgets[k] = v;
      save();
    });
    r.appendChild(inp);

    var del = el('button', 'iconbtn danger');
    del.dataset.role = 'del';
    del.setAttribute('aria-label', 'Hapus anggaran ' + c.label);
    del.appendChild(icon('trash'));
    del.addEventListener('click', function () {
      withUndo('Anggaran ' + c.label + ' dihapus', function () {
        delete DATA.budgets[k];
        for (var m in DATA.budgetsMo) delete DATA.budgetsMo[m][k];
      });
    });
    r.appendChild(del);
    bc.appendChild(r);
  });

  /* tambah anggaran: hanya kategori pengeluaran yang belum punya */
  var free = catsByKind('out').filter(function (c) { return cats.indexOf(c.k) < 0; });
  if (free.length) {
    var add = el('div', 'addrow');
    add.id = 'budget-add';
    add.appendChild(el('label', null, 'Tambah anggaran'));
    var g = el('div', 'catgrid');
    free.forEach(function (c) {
      var b = el('button', 'catchip');
      b.type = 'button';
      b.dataset.cat = c.k;
      b.appendChild(icon(c.ic));
      b.appendChild(el('span', null, c.label));
      b.addEventListener('click', function () {
        DATA.budgets[c.k] = 0;
        save();
        render();
      });
      g.appendChild(b);
    });
    add.appendChild(g);
    bc.appendChild(add);
  }
  return bc;
}

/* ---------- tujuan: tampilan ---------- */
export function goalView() {
  var gc = el('div', 'card');
  gc.id = 'goal-card';
  if (!DATA.goals.length) {
    var e1 = el('div', 'empty');
    e1.appendChild(el('span', 'ic', '○'));
    e1.appendChild(el('div', null, 'Belum ada tujuan'));
    e1.appendChild(el('div', 'tiny mut', 'Ketuk Atur untuk menambah'));
    gc.appendChild(e1);
    return gc;
  }
  for (var g = 0; g < DATA.goals.length; g++) {
    var go_ = DATA.goals[g];
    var p = go_.target > 0 ? go_.saved / go_.target : 0;
    var gr = el('button', 'goal');
    gr.type = 'button';
    gr.dataset.goal = go_.id;
    (function (id) {
      gr.addEventListener('click', function () { sheetGoal(id); });
    })(go_.id);
    gr.dataset.saved = String(go_.saved);
    gr.dataset.target = String(go_.target);
    var gt = el('div', 'top');
    gt.appendChild(el('div', 'nm', go_.name));
    gt.appendChild(el('div', 'pc', Math.round(p * 100) + '%'));
    gr.appendChild(gt);
    var gtr = el('div', 'track');
    var gfl = el('div', 'fill');
    gfl.style.width = Math.min(100, p * 100).toFixed(1) + '%';
    gtr.appendChild(gfl);
    gr.appendChild(gtr);
    gr.appendChild(el('div', 'num', fmtRp(go_.saved) + ' dari ' + fmtRp(go_.target)));
    gc.appendChild(gr);
  }
  return gc;
}

/* ---------- tujuan: mode Atur ---------- */
export function goalEdit() {
  var gc = el('div', 'card');
  gc.id = 'goal-card';
  gc.dataset.mode = 'edit';

  DATA.goals.forEach(function (go_) {
    var gr = el('div', 'goal');
    gr.dataset.goal = go_.id;
    var top = el('div', 'ebar');
    top.style.cssText = 'padding:0 0 2px;border:0';
    var nm = el('input', 'inp');
    nm.dataset.role = 'name';
    nm.type = 'text';
    nm.value = go_.name;
    nm.style.fontWeight = '600';
    nm.addEventListener('change', function () {
      go_.name = nm.value.trim() || 'Tanpa nama';
      save();
    });
    top.appendChild(nm);
    var del = el('button', 'iconbtn danger');
    del.dataset.role = 'del';
    del.setAttribute('aria-label', 'Hapus tujuan ' + go_.name);
    del.appendChild(icon('trash'));
    del.addEventListener('click', function () {
      withUndo('Tujuan "' + go_.name + '" dihapus', function () {
        DATA.goals = DATA.goals.filter(function (x) { return x.id !== go_.id; });
      });
    });
    top.appendChild(del);
    gr.appendChild(top);

    var row = el('div', 'ginp');
    [['saved', 'Terkumpul'], ['target', 'Target']].forEach(function (f) {
      var wrap = el('div');
      wrap.style.flex = '1';
      wrap.appendChild(el('div', 'tiny mut', f[1]));
      var inp = el('input', 'inp');
      inp.dataset.role = f[0];
      inp.style.marginTop = '4px';
      attachMoney(inp, go_[f[0]]);
      inp.addEventListener('change', function () {
        go_[f[0]] = moneyVal(inp);
        save();
      });
      wrap.appendChild(inp);
      row.appendChild(wrap);
    });
    gr.appendChild(row);
    gc.appendChild(gr);
  });

  var add = el('button', 'btn-sm');
  add.id = 'goal-add';
  add.style.cssText = 'margin-top:13px;width:100%;padding:11px';
  add.appendChild(icon('plus'));
  add.appendChild(el('span', null, 'Tambah tujuan'));
  add.addEventListener('click', function () {
    DATA.goals.push({ id: 'g' + (++DATA.seq), name: 'Tujuan baru', target: 0, saved: 0 });
    save();
    render();
  });
  gc.appendChild(add);
  return gc;
}
