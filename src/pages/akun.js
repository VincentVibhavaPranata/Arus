import { render } from '../app/render.js';
import { ACCTS, LIAB_ACCTS } from '../core/constants.js';
import { sLabel, todayS, ymM } from '../core/dates.js';
import { acctBalances, anchorAcct, cpAll, cpDiff } from '../core/derived.js';
import { BULAN_S, icon } from '../core/icons.js';
import { fmtRp, fmtRpShort, fmtRpSign, grp } from '../core/money.js';
import { acctDebts, adjTotal, allocPct, assetClass, assetsTotal, cashSeries, classRows, classTotal, contribCount, contribTotal, liabTotal, networthTotal, targetTotal } from '../core/networth.js';
import { DATA, normTargets, restore, save, snapshot, withUndo } from '../core/store.js';
import { tradePnl, tradesClosed } from '../features/trading.js';
import { secEdit } from './dasbor.js';
import { sechd } from './lainnya.js';
import { setNum } from '../ui/animate.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { UI, el, monogram } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ============================ RENDER: AKUN (ringkas v0.1) ============================ */
export function viewAkun(root) {
  /* --- hero: kekayaan bersih --- */
  var hero = el('div', 'hero');
  hero.appendChild(el('div', 'biglab', 'Kekayaan bersih'));
  var big = el('div', 'big');
  big.id = 'nw-total';
  hero.appendChild(big);
  setNum(big, networthTotal());
  var pair = el('div', 'pair');
  function cell(k, v, id, cls) {
    var d = el('div');
    d.appendChild(el('div', 'k', k));
    var s = el('div', 'v' + (cls ? ' ' + cls : ''));
    s.id = id;
    s.dataset.val = String(v);
    s.textContent = fmtRp(v);
    d.appendChild(s);
    return d;
  }
  pair.appendChild(cell('Aset', assetsTotal(), 'nw-assets', 'pos'));
  pair.appendChild(cell('Utang', liabTotal(), 'nw-liab', liabTotal() ? 'neg' : null));
  hero.appendChild(pair);
  root.appendChild(hero);

  /* --- donat alokasi vs target --- */
  root.appendChild(secEdit('Alokasi', 'alloc'));
  root.appendChild(allocCard());

  /* --- titik periksa saldo dari bank --- */
  if (cpAll().length) root.appendChild(checkpointCard());

  /* --- kartu per kelas aset --- */
  DATA.networth.assets.forEach(function (cls) { root.appendChild(classCard(cls)); });

  /* --- utang --- */
  root.appendChild(secEdit('Utang', 'liab'));
  root.appendChild(liabCard());

  /* --- tren kas --- */
  root.appendChild(sechd('Tren kas 6 bulan'));
  root.appendChild(cashTrendCard());
}

/* ---------- titik periksa saldo menurut bank ---------- */
export function checkpointCard() {
  var box = el('div');
  var hd = el('div', 'sec');
  hd.appendChild(el('h2', null, 'Cocok dengan bank'));
  box.appendChild(hd);

  var card = el('div', 'card');
  card.id = 'cp-card';
  card.style.padding = '4px 14px';
  var list = cpAll();
  card.dataset.n = String(list.length);
  var meleset = 0;

  list.forEach(function (cp) {
    var diff = cpDiff(cp);
    if (diff !== 0) meleset++;
    var r = el('div', 'arow');
    r.dataset.cp = cp.id;
    r.dataset.diff = String(diff);
    r.dataset.saldo = String(cp.saldo);
    var av = el('div', 'av' + (diff === 0 ? ' g' : ''));
    av.appendChild(icon(diff === 0 ? 'check' : 'close'));
    if (diff !== 0) av.style.color = 'var(--down)';
    r.appendChild(av);
    var body = el('div', 'body');
    body.appendChild(el('div', 'n1', cp.acct + ' · ' + sLabel(cp.s)));
    body.appendChild(el('div', 'n2', diff === 0
      ? 'cocok dengan ' + (cp.src || 'catatan bank')
      : (diff < 0 ? 'catatan kurang ' + fmtRp(-diff) : 'catatan kelebihan ' + fmtRp(diff))));
    r.appendChild(body);
    var right = el('div');
    right.style.cssText = 'flex:0 0 auto;text-align:right';
    right.appendChild(el('div', 'v', fmtRp(cp.saldo)));
    if (diff !== 0) {
      var b = el('button', 'btn-sm');
      b.dataset.role = 'anchor';
      b.style.marginTop = '6px';
      b.textContent = 'Selaraskan';
      b.addEventListener('click', function () {
        withUndo('Saldo awal ' + cp.acct + ' diselaraskan', function () { anchorAcct(cp); });
      });
      right.appendChild(b);
    }
    r.appendChild(right);
    card.appendChild(r);
  });

  var foot = el('div', 'tsum' + (meleset ? ' bad' : ''));
  foot.id = 'cp-summary';
  foot.dataset.meleset = String(meleset);
  foot.appendChild(el('span', null, meleset
    ? meleset + ' dari ' + list.length + ' titik tidak cocok'
    : 'Semua ' + list.length + ' titik cocok'));
  foot.appendChild(el('span', 'spacer'));
  var del = el('button', 'btn-sm plain');
  del.id = 'cp-clear';
  del.textContent = 'Buang';
  var armed = false;
  del.addEventListener('click', function () {
    if (!armed) { armed = true; del.dataset.armed = '1'; del.textContent = 'Yakin?'; return; }
    withUndo('Titik periksa dibuang', function () { DATA.checkpoints = []; });
  });
  foot.appendChild(del);
  card.appendChild(foot);

  var note = el('div', 'tiny mut');
  note.style.margin = '9px 2px 0';
  note.textContent = meleset
    ? 'Selisih biasanya berarti ada bulan yang belum kamu impor, atau baris ' +
      'impor yang belum dicatat. "Selaraskan" menggeser saldo awal akun supaya ' +
      'angka hari ini benar — tapi periksa dulu apakah memang ada yang kurang.'
    : 'Angka ini datang dari halaman terakhir e-statement, bukan dari hitungan ' +
      'Arus sendiri. Selama cocok, catatanmu lengkap.';
  box.appendChild(card);
  box.appendChild(note);
  return box;
}

/* ---------- donat + legenda + stepper target ---------- */
export function allocCard() {
  var card = el('div', 'card');
  card.id = 'alloc-card';
  if (UI.edit.alloc) card.dataset.mode = 'edit';
  var pct = allocPct(), tg = DATA.networth.targets;

  var wrap = el('div', 'donutwrap');
  var dn = el('div', 'donut');
  var R = 48, C = 2 * Math.PI * R, off = 0, seg = '';
  DATA.networth.assets.forEach(function (cls) {
    var p = pct[cls.k] || 0;
    if (p <= 0) return;
    var len = (p / 100) * C;
    seg += '<circle class="sg" data-k="' + cls.k + '" cx="66" cy="66" r="' + R +
           '" fill="none" stroke="' + cls.color + '" stroke-width="14"' +
           ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"' +
           ' stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
    off += len;
  });
  var hasAny = off > 0;
  var box = el('div');
  box.innerHTML = '<svg viewBox="0 0 132 132" aria-hidden="true">' +
    '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="14"/>' +
    seg + '</svg>';
  dn.appendChild(box.firstChild);
  var mid = el('div', 'mid');
  var mv = el('div', 'v', fmtRpShort(assetsTotal()));
  mv.id = 'alloc-mid';
  mid.appendChild(mv);
  mid.appendChild(el('div', 'l', 'total aset'));
  dn.appendChild(mid);
  wrap.appendChild(dn);

  var lg = el('div', 'legend');
  DATA.networth.assets.forEach(function (cls) {
    var p = pct[cls.k] || 0, t = tg[cls.k] || 0;
    var r = el('div', 'lgi' + (Math.abs(p - t) >= 10 ? ' off' : ''));
    r.dataset.k = cls.k;
    r.dataset.pct = p.toFixed(1);
    r.dataset.target = String(t);
    var sw = el('span', 'sw');
    sw.style.background = cls.color;
    r.appendChild(sw);
    r.appendChild(el('span', 'nm', cls.label));
    if (UI.edit.alloc) {
      r.appendChild(stepper(cls.k));
    } else {
      r.appendChild(el('span', 'pc', (hasAny ? Math.round(p) : 0) + '%'));
      r.appendChild(el('span', 'tg', '/ ' + t + '%'));
    }
    lg.appendChild(r);
  });
  wrap.appendChild(lg);
  card.appendChild(wrap);

  var sum = targetTotal();
  var ts = el('div', 'tsum' + (sum === 100 ? '' : ' bad'));
  ts.id = 'target-sum';
  ts.dataset.sum = String(sum);
  ts.appendChild(el('span', null, 'Total target'));
  ts.appendChild(el('span', 'spacer'));
  var b = el('b', null, sum + '%');
  ts.appendChild(b);
  card.appendChild(ts);

  if (UI.edit.alloc) {
    var note = el('div', 'tiny mut');
    note.style.marginTop = '10px';
    note.textContent = 'Menaikkan satu kelas otomatis mengambil dari kelas terbesar ' +
      'lainnya, jadi totalnya selalu 100%.';
    card.appendChild(note);
    card.appendChild(classManage());
  }
  return card;
}

/* Stepper ±5%. Menjaga invarian total===100 SETIAP saat dengan memindahkan
   selisih dari/ke kelas terbesar lain — tidak pernah ada keadaan tak sah. */
export function stepper(k) {
  var tg = DATA.networth.targets;
  var others = Object.keys(tg).filter(function (x) { return x !== k; });
  var donor = others.slice().sort(function (a, b) { return tg[b] - tg[a]; })[0];
  var st = el('div', 'step');
  st.dataset.k = k;

  function mk(id, delta, enabled) {
    var b = el('button');
    b.dataset.role = id;
    b.setAttribute('aria-label', (delta > 0 ? 'Naikkan ' : 'Turunkan ') + k);
    b.appendChild(icon(delta > 0 ? 'plus' : 'minus'));
    b.disabled = !enabled;
    b.addEventListener('click', function () {
      var step = Math.min(5, delta > 0 ? tg[donor] : tg[k]);
      if (step <= 0) return;
      tg[k] += delta > 0 ? step : -step;
      tg[donor] += delta > 0 ? -step : step;
      normTargets();
      save();
      render();
    });
    return b;
  }
  st.appendChild(mk('minus', -5, tg[k] > 0 && !!donor));
  var v = el('span', 'v', (tg[k] || 0) + '%');
  v.dataset.role = 'val';
  st.appendChild(v);
  st.appendChild(mk('plus', 5, !!donor && tg[donor] > 0));
  return st;
}

/* Tambah / hapus kelas aset. Kas tidak boleh dihapus: nilainya derived dan
   jadi jangkar target 100%. */
export function classManage() {
  var wrap = el('div', 'addrow');
  wrap.id = 'class-manage';
  wrap.appendChild(el('label', null, 'Kelas aset'));
  DATA.networth.assets.forEach(function (cls) {
    var r = el('div', 'crow');
    r.dataset.k = cls.k;
    var sw = el('span', 'sw');
    sw.style.cssText = 'width:11px;height:11px;border-radius:3px;flex:0 0 11px;background:' + cls.color;
    r.appendChild(sw);
    var body = el('div', 'body');
    body.appendChild(el('div', 'nm', cls.label));
    body.appendChild(el('div', 'cnt', cls.k === 'cash'
      ? 'derived dari saldo akun · tak bisa dihapus'
      : classRows(cls.k).length + ' baris · ' + fmtRp(classTotal(cls.k))));
    r.appendChild(body);
    if (cls.k !== 'cash') {
      var del = el('button', 'iconbtn danger');
      del.dataset.role = 'del-class';
      del.setAttribute('aria-label', 'Hapus kelas ' + cls.label);
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
        withUndo('Kelas "' + cls.label + '" dihapus', function () {
          DATA.networth.assets = DATA.networth.assets.filter(function (x) { return x.k !== cls.k; });
          delete DATA.networth.targets[cls.k];
          normTargets();
        });
      });
      r.appendChild(del);
    }
    wrap.appendChild(r);
  });

  var np = el('div', 'newcat');
  np.id = 'class-new';
  np.appendChild(el('label', null, 'Kelas baru'));
  var nm = el('input', 'inp');
  nm.id = 'class-new-name';
  nm.type = 'text';
  nm.placeholder = 'mis. Properti, Obligasi';
  np.appendChild(nm);
  var err = el('div', 'err');
  err.id = 'class-new-err';
  err.hidden = true;
  err.style.margin = '10px 0 0';
  np.appendChild(err);
  var add = el('button', 'btn-sm');
  add.id = 'class-new-save';
  add.style.cssText = 'margin-top:11px;width:100%;padding:10px';
  add.textContent = 'Tambah kelas';
  add.addEventListener('click', function () {
    var name = nm.value.trim();
    if (!name) { err.textContent = 'Nama kelas belum diisi.'; err.hidden = false; return; }
    var k = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!k || assetClass(k)) {
      err.textContent = 'Nama itu tidak bisa dipakai atau sudah ada.';
      err.hidden = false;
      return;
    }
    if (ACCTS.some(function (a) { return a.toLowerCase() === k; })) {
      err.textContent = 'Nama itu bentrok dengan nama akun.';
      err.hidden = false;
      return;
    }
    var palette = ['#4cc9ff', '#8d7bff', '#ffc56b', '#6ff2b0', '#ff8fa3', '#7df0ff'];
    DATA.networth.assets.push({
      k: k, label: name, rows: [],
      color: palette[DATA.networth.assets.length % palette.length]
    });
    DATA.networth.targets[k] = 0;
    normTargets();
    save();
    render();
    toast('Kelas "' + name + '" ditambahkan');
  });
  np.appendChild(add);
  wrap.appendChild(np);
  return wrap;
}

/* ---------- kartu satu kelas aset ---------- */
export function classCard(cls) {
  var box = el('div');
  var isCash = cls.k === 'cash';
  var editing = UI.edit['cls:' + cls.k] === true;

  var hd = el('div', 'clshd');
  hd.dataset.k = cls.k;
  var sw = el('span', 'sw');
  sw.style.background = cls.color;
  hd.appendChild(sw);
  hd.appendChild(el('span', 'nm', cls.label));
  hd.appendChild(el('span', 'spacer'));
  var tt = el('span', 'tt', fmtRp(classTotal(cls.k)));
  tt.dataset.total = String(classTotal(cls.k));
  hd.appendChild(tt);
  var btn = el('button', 'btn-sm' + (editing ? '' : ' plain'));
  btn.id = (isCash ? 'set-start' : 'edit-cls-' + cls.k);
  if (editing) btn.appendChild(icon('check'));
  btn.appendChild(el('span', null, isCash ? 'Atur saldo awal' : (editing ? 'Selesai' : 'Atur aset')));
  btn.addEventListener('click', function () {
    if (isCash) { sheetAcctStart(); return; }
    UI.edit['cls:' + cls.k] = !editing;
    if (editing) save();
    render();
  });
  hd.appendChild(btn);
  box.appendChild(hd);

  var card = el('div', 'card');
  card.dataset.cls = cls.k;
  card.style.padding = '4px 14px';
  if (editing) card.dataset.mode = 'edit';
  var rows = classRows(cls.k);

  /* Baris SETORAN BERSIH: derived dari transaksi, tidak bisa diedit di sini.
     Kalau angkanya salah, yang salah adalah transaksinya — perbaiki di sana. */
  if (!isCash) {
    var contrib = contribTotal(cls.k), cn = contribCount(cls.k);
    if (cn > 0) {
      var cr = el('div', 'arow');
      cr.dataset.contrib = String(contrib);
      var cav = el('div', 'av g');
      cav.appendChild(icon('arrow_d'));
      cr.appendChild(cav);
      var cb = el('div', 'body');
      cb.appendChild(el('div', 'n1', 'Setoran bersih'));
      cb.appendChild(el('div', 'n2', 'dari ' + cn + ' transaksi · derived'));
      cr.appendChild(cb);
      cr.appendChild(el('div', 'v', fmtRp(contrib)));
      card.appendChild(cr);
    }
    /* Hasil trading juga derived — sumbernya jurnal, bukan angka yang diketik. */
    if (DATA.trades.classK === cls.k && tradesClosed().length) {
      var pnl = tradePnl(cls.k);
      var tr2 = el('div', 'arow');
      tr2.dataset.pnl = String(pnl);
      var tav = el('div', 'av g');
      tav.appendChild(icon('trade'));
      tr2.appendChild(tav);
      var tb = el('div', 'body');
      tb.appendChild(el('div', 'n1', 'Hasil trading'));
      tb.appendChild(el('div', 'n2', tradesClosed().length + ' trade tertutup · derived'));
      tr2.appendChild(tb);
      tr2.appendChild(el('div', 'v' + (pnl >= 0 ? ' pos' : ' neg'), fmtRpSign(pnl)));
      card.appendChild(tr2);
    }
  }

  if (!rows.length && !editing && (isCash || contribCount(cls.k) === 0)) {
    var e = el('div', 'empty');
    e.style.padding = '22px 10px';
    e.appendChild(el('div', null, 'Belum ada isi'));
    e.appendChild(el('div', 'tiny mut', 'Ketuk "Atur aset" untuk menambah'));
    card.appendChild(e);
  }

  rows.forEach(function (rw) {
    var r = el('div', 'arow');
    r.dataset.row = String(rw.id);
    r.dataset.amt = String(rw.amt);
    var av = el('div', 'av' + (isCash ? ' g' : ''), monogram(rw.name));
    r.appendChild(av);
    if (editing) {
      var inm = el('input', 'inp nm');
      inm.dataset.role = 'name';
      inm.type = 'text';
      inm.value = rw.name;
      inm.addEventListener('change', function () {
        rw.name = inm.value.trim() || 'Tanpa nama';
        save();
      });
      r.appendChild(inm);
      var iv = el('input', 'inp');
      iv.dataset.role = 'amt';
      attachMoney(iv, rw.amt);
      iv.addEventListener('change', function () { rw.amt = moneyVal(iv); save(); });
      r.appendChild(iv);
      var del = el('button', 'iconbtn danger');
      del.dataset.role = 'del-row';
      del.setAttribute('aria-label', 'Hapus ' + rw.name);
      del.appendChild(icon('trash'));
      del.addEventListener('click', function () {
        withUndo(rw.name + ' dihapus', function () {
          cls.rows = cls.rows.filter(function (x) { return x.id !== rw.id; });
        });
      });
      r.appendChild(del);
    } else {
      var body = el('div', 'body');
      body.appendChild(el('div', 'n1', rw.name));
      if (rw.sub) body.appendChild(el('div', 'n2', rw.sub));
      r.appendChild(body);
      r.appendChild(el('div', 'v', fmtRp(rw.amt)));
    }
    card.appendChild(r);
  });

  if (editing) {
    /* Selaraskan: kamu tahu nilai pasarnya, app yang menghitung selisihnya.
       Tanpa ini kamu harus mengurangi setoran secara manual di kepala. */
    var sync = el('div', 'addrow');
    sync.id = 'sync-' + cls.k;
    sync.appendChild(el('label', null, 'Selaraskan ke nilai pasar'));
    var sr = el('div', 'arow');
    sr.style.borderBottom = '0';
    var si = el('input', 'inp');
    si.dataset.role = 'sync-val';
    si.placeholder = 'Nilai sekarang';
    attachMoney(si, classTotal(cls.k));
    sr.appendChild(si);
    var sb = el('button', 'btn-sm');
    sb.dataset.role = 'sync';
    sb.style.flex = '0 0 auto';
    sb.textContent = 'Selaraskan';
    sb.addEventListener('click', function () {
      var want = moneyVal(si), have = classTotal(cls.k), diff = want - have;
      if (diff === 0) { toast('Sudah sesuai'); return; }
      withUndo('Diselaraskan ke ' + fmtRp(want), function () {
        var r0 = null;
        for (var i = 0; i < cls.rows.length; i++)
          if (cls.rows[i].name === 'Selisih nilai pasar') r0 = cls.rows[i];
        if (!r0) {
          r0 = { id: 'a' + (++DATA.seq), name: 'Selisih nilai pasar', sub: '', amt: 0 };
          cls.rows.push(r0);
        }
        r0.amt += diff;
        r0.sub = 'per ' + sLabel(todayS());
        if (r0.amt === 0) cls.rows = cls.rows.filter(function (x) { return x !== r0; });
      });
    });
    sr.appendChild(sb);
    sync.appendChild(sr);
    var hint = el('div', 'tiny mut');
    hint.style.marginTop = '7px';
    hint.textContent = 'Setoran Rp' + grp(contribTotal(cls.k)) + ' + penyesuaian Rp' +
      grp(adjTotal(cls.k)) + ' = ' + fmtRp(classTotal(cls.k));
    sync.appendChild(hint);
    card.appendChild(sync);

    var addw = el('div', 'addrow');
    addw.id = 'add-row-' + cls.k;
    addw.appendChild(el('label', null, 'Tambah penyesuaian nilai'));
    var ar = el('div', 'arow');
    ar.style.borderBottom = '0';
    var an = el('input', 'inp nm');
    an.dataset.role = 'new-name';
    an.type = 'text';
    an.placeholder = 'Nama';
    ar.appendChild(an);
    var aa = el('input', 'inp');
    aa.dataset.role = 'new-amt';
    aa.placeholder = 'Rp0';
    attachMoney(aa, 0);
    ar.appendChild(aa);
    var ab = el('button', 'iconbtn');
    ab.dataset.role = 'add-row';
    ab.setAttribute('aria-label', 'Tambah baris');
    ab.appendChild(icon('plus'));
    ab.addEventListener('click', function () {
      var nm2 = an.value.trim();
      if (!nm2) { toast('Nama aset belum diisi'); return; }
      cls.rows.push({ id: 'a' + (++DATA.seq), name: nm2, sub: '', amt: moneyVal(aa) });
      save();
      render();
      toast(nm2 + ' ditambahkan');
    });
    ar.appendChild(ab);
    addw.appendChild(ar);
    card.appendChild(addw);
  }
  box.appendChild(card);
  return box;
}

/* ---------- utang ---------- */
export function liabCard() {
  var card = el('div', 'card');
  card.id = 'liab-card';
  card.style.padding = '4px 14px';
  var editing = UI.edit.liab;
  if (editing) card.dataset.mode = 'edit';
  var list = DATA.networth.liab;

  var auto = acctDebts();   // utang dari akun utang (GoPay Later): otomatis, tidak bisa diedit di sini
  if (!list.length && !auto.length && !editing) {
    var e = el('div', 'empty');
    e.style.padding = '22px 10px';
    e.appendChild(el('div', null, 'Tidak ada utang'));
    card.appendChild(e);
  }
  list.forEach(function (lb) {
    var r = el('div', 'arow');
    r.dataset.liab = String(lb.id);
    r.dataset.amt = String(lb.amt);
    r.appendChild(el('div', 'av', monogram(lb.name)));
    if (editing) {
      var inm = el('input', 'inp nm');
      inm.dataset.role = 'name';
      inm.type = 'text';
      inm.value = lb.name;
      inm.addEventListener('change', function () {
        lb.name = inm.value.trim() || 'Tanpa nama';
        save();
      });
      r.appendChild(inm);
      var iv = el('input', 'inp');
      iv.dataset.role = 'amt';
      attachMoney(iv, lb.amt);
      iv.addEventListener('change', function () { lb.amt = Math.abs(moneyVal(iv)); save(); });
      r.appendChild(iv);
      var del = el('button', 'iconbtn danger');
      del.dataset.role = 'del-liab';
      del.setAttribute('aria-label', 'Hapus ' + lb.name);
      del.appendChild(icon('trash'));
      del.addEventListener('click', function () {
        withUndo(lb.name + ' dihapus', function () {
          DATA.networth.liab = DATA.networth.liab.filter(function (x) { return x.id !== lb.id; });
        });
      });
      r.appendChild(del);
    } else {
      var body = el('div', 'body');
      body.appendChild(el('div', 'n1', lb.name));
      r.appendChild(body);
      var v = el('div', 'v neg', '-' + fmtRp(lb.amt));
      r.appendChild(v);
    }
    card.appendChild(r);
  });
  auto.forEach(function (x) {
    var r = el('div', 'arow');
    r.dataset.acctDebt = x.name;
    r.appendChild(el('div', 'av', monogram(x.name)));
    var body = el('div', 'body');
    body.appendChild(el('div', 'n1', x.name));
    body.appendChild(el('div', 'n2', 'otomatis dari transaksi'));
    r.appendChild(body);
    r.appendChild(el('div', 'v neg', '-' + fmtRp(x.amt)));
    card.appendChild(r);
  });

  if (editing) {
    var addw = el('div', 'addrow');
    addw.id = 'add-liab';
    addw.appendChild(el('label', null, 'Tambah utang'));
    var ar = el('div', 'arow');
    ar.style.borderBottom = '0';
    var an = el('input', 'inp nm');
    an.dataset.role = 'new-name';
    an.type = 'text';
    an.placeholder = 'Nama';
    ar.appendChild(an);
    var aa = el('input', 'inp');
    aa.dataset.role = 'new-amt';
    aa.placeholder = 'Rp0';
    attachMoney(aa, 0);
    ar.appendChild(aa);
    var ab = el('button', 'iconbtn');
    ab.dataset.role = 'add-liab';
    ab.setAttribute('aria-label', 'Tambah utang');
    ab.appendChild(icon('plus'));
    ab.addEventListener('click', function () {
      var nm2 = an.value.trim();
      if (!nm2) { toast('Nama utang belum diisi'); return; }
      DATA.networth.liab.push({ id: 'l' + (++DATA.seq), name: nm2, amt: Math.abs(moneyVal(aa)) });
      save();
      render();
    });
    ar.appendChild(ab);
    addw.appendChild(ar);
    card.appendChild(addw);
  }
  return card;
}

/* ---------- tren kas: derived per bulan, bukan snapshot tersimpan ---------- */
export function cashTrendCard() {
  var card = el('div', 'card');
  card.id = 'trend-card';
  var ser = cashSeries(6);
  card.dataset.series = ser.map(function (p) { return p.ym + ':' + p.v; }).join(',');

  var W = 340, H = 76, PAD = 4;
  var vals = ser.map(function (p) { return p.v; });
  var lo = Math.min.apply(null, vals.concat([0]));
  var hi = Math.max.apply(null, vals.concat([0]));
  if (hi === lo) hi = lo + 1;
  var x = function (i) { return PAD + (i * (W - PAD * 2)) / Math.max(1, ser.length - 1); };
  var y = function (v) { return H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2); };

  var pts = ser.map(function (p, i) { return x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); });
  var body = '<path class="ar" d="M' + pts.join(' L') + ' L' + x(ser.length - 1).toFixed(1) +
             ' ' + (H - PAD) + ' L' + x(0).toFixed(1) + ' ' + (H - PAD) + ' Z"/>' +
             '<path class="ln" d="M' + pts.join(' L') + '"/>';
  if (lo < 0 && hi > 0) body += '<line class="zr" x1="0" y1="' + y(0).toFixed(1) +
                                '" x2="' + W + '" y2="' + y(0).toFixed(1) + '"/>';
  ser.forEach(function (p, i) {
    if (i !== ser.length - 1) return;
    body += '<circle class="dt" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="3.2"/>';
  });
  var holder = el('div');
  holder.innerHTML = '<svg class="spark" viewBox="0 0 ' + W + ' ' + H +
    '" preserveAspectRatio="none" aria-hidden="true">' + body + '</svg>';
  card.appendChild(holder.firstChild);

  var labs = el('div', 'sparklab');
  ser.forEach(function (p) {
    labs.appendChild(el('span', null, BULAN_S[ymM(p.ym) - 1]));
  });
  card.appendChild(labs);

  var last = ser[ser.length - 1].v, first = ser[0].v, dif = last - first;
  var foot = el('div', 'tsum');
  foot.appendChild(el('span', null, BULAN_S[ymM(ser[0].ym) - 1] + ' → sekarang'));
  foot.appendChild(el('span', 'spacer'));
  var bb = el('b', null, fmtRpSign(dif));
  bb.id = 'trend-delta';
  bb.dataset.val = String(dif);
  if (dif < 0) bb.style.color = 'var(--down)';
  foot.appendChild(bb);
  card.appendChild(foot);

  var note = el('div', 'tiny mut');
  note.style.marginTop = '9px';
  note.textContent = 'Hanya kas & setara — dihitung ulang dari catatan transaksi. ' +
    'Kelas aset manual belum punya riwayat bulanan.';
  card.appendChild(note);
  return card;
}

/* ---------- sheet: saldo awal per akun ---------- */
export function sheetAcctStart() {
  openSheet('Saldo awal akun', function (bd) {
    bd.id = 'start-body';
    var note = el('div', 'tiny mut');
    note.style.margin = '0 0 14px';
    note.textContent = 'Saldo sebelum transaksi pertama dicatat. Saldo berjalan ' +
      'dihitung dari sini + semua transaksi, jadi mengubahnya menggeser seluruh riwayat.';
    bd.appendChild(note);

    var inputs = {};
    ACCTS.forEach(function (a) {
      var r = el('div', 'arow');
      r.dataset.acct = a;
      r.appendChild(el('div', 'av g', monogram(a)));
      var body = el('div', 'body');
      var isL = LIAB_ACCTS.indexOf(a) >= 0;
      body.appendChild(el('div', 'n1', isL ? a + ' · utang awal' : a));
      body.appendChild(el('div', 'n2', isL ? 'utang kini ' + fmtRp(Math.max(0, -acctBalances()[a]))
                                           : 'kini ' + fmtRp(acctBalances()[a])));
      r.appendChild(body);
      var iv = el('input', 'inp');
      iv.dataset.role = 'start';
      attachMoney(iv, isL ? -(DATA.acctStart[a] || 0) : (DATA.acctStart[a] || 0));
      inputs[a] = iv;
      r.appendChild(iv);
      bd.appendChild(r);
    });

    var b = el('button', 'btn');
    b.id = 'start-save';
    b.textContent = 'Simpan saldo awal';
    b.style.marginTop = '16px';
    b.addEventListener('click', function () {
      var snap = snapshot();
      ACCTS.forEach(function (a) {
        var v = moneyVal(inputs[a]);
        DATA.acctStart[a] = LIAB_ACCTS.indexOf(a) >= 0 ? -Math.abs(v) : v;   // utang disimpan sebagai saldo minus
      });
      save();
      closeSheet();
      render();
      toast('Saldo awal disimpan', {
        actionLabel: 'Urungkan',
        action: function () { restore(snap); toast('Dibatalkan'); }
      });
    });
    bd.appendChild(b);
  });
}
