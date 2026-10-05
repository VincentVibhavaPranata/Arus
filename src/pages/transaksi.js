import { render } from '../app/render.js';
import { catOf, ymRange } from '../core/categories.js';
import { TF_CAT } from '../core/constants.js';
import { sLabel, sWeekday, ymAdd, ymLabel } from '../core/dates.js';
import { dayTotal, monthDays } from '../core/derived.js';
import { icon } from '../core/icons.js';
import { fmtRp, fmtRpSign } from '../core/money.js';
import { DATA } from '../core/store.js';
import { isInvestFlow, isTf, tfKind, tfLabel } from '../core/transfer.js';
import { sheetTx } from '../sheets/tx.js';
import { UI, el } from '../ui/nav.js';

/* ============================ RENDER: TRANSAKSI ============================ */
/* Pencocokan satu tempat: judul, akun, label kategori, dan nominal mentah.
   Nominal ikut dicari supaya "137500" menemukan transaksinya. */
export function matchTx(it, q, fcat) {
  if (fcat && it.cat !== fcat) return false;
  if (!q) return true;
  var hay = ((it.title || '') + ' ' + (it.acct || '') + ' ' + catOf(it.cat).label + ' ' +
             Math.abs(it.amt)).toLowerCase();
  return hay.indexOf(q) >= 0;
}

/* Daftar hari TERSARING — derived, tidak pernah disimpan. */
export function txFiltered(scope, ym, q, fcat) {
  var src = scope === 'all' ? DATA.days : monthDays(ym);
  var out = [];
  for (var i = 0; i < src.length; i++) {
    var items = src[i].items.filter(function (it) { return matchTx(it, q, fcat); });
    if (items.length) out.push({ s: src[i].s, items: items });
  }
  return out;
}

export function txCount(list) {
  var n = 0;
  for (var i = 0; i < list.length; i++) n += list[i].items.length;
  return n;
}

export function isFiltering() { return !!(UI.q.trim() || UI.fcat); }

export function viewTransaksi(root) {
  var rg = ymRange();

  /* --- bar bulan --- */
  var bar = el('div', 'sec');
  var prev = el('button', 'mnav');
  prev.appendChild(icon('chev_l'));
  prev.id = 'tx-prev'; prev.setAttribute('aria-label', 'Bulan sebelumnya');
  prev.disabled = UI.scope === 'all' || UI.ym <= ymAdd(rg.min, -1);
  var next = el('button', 'mnav');
  next.appendChild(icon('chev_r'));
  next.id = 'tx-next'; next.setAttribute('aria-label', 'Bulan berikutnya');
  next.disabled = UI.scope === 'all' || UI.ym >= ymAdd(rg.max, 1);
  var h = el('h2', null, UI.scope === 'all' ? 'Semua bulan' : ymLabel(UI.ym));
  h.id = 'tx-month'; h.dataset.ym = String(UI.ym); h.dataset.scope = UI.scope;
  h.style.textTransform = 'none';
  h.style.fontSize = '14px';
  h.style.color = 'var(--txt)';
  prev.addEventListener('click', function () { UI.ym = ymAdd(UI.ym, -1); render(); });
  next.addEventListener('click', function () { UI.ym = ymAdd(UI.ym,  1); render(); });
  bar.appendChild(prev); bar.appendChild(h); bar.appendChild(el('span', 'spacer'));
  if (UI.scope === 'all') {
    var back = el('button', 'btn-sm plain', 'Per bulan');
    back.id = 'tx-scope-month';
    back.addEventListener('click', function () { UI.scope = 'month'; render(); });
    bar.appendChild(back);
  }
  bar.appendChild(next);
  root.appendChild(bar);

  /* --- kotak cari: render sekali, isi daftar diperbarui terpisah supaya
     fokus & posisi kursor tidak hilang setiap ketukan tombol --- */
  var sw = el('div', 'searchwrap');
  sw.appendChild(icon('search'));
  var q = el('input');
  q.id = 'tx-q';
  q.type = 'search';
  q.autocomplete = 'off';
  q.placeholder = 'Cari judul, akun, atau nominal';
  q.value = UI.q;
  q.addEventListener('input', function () {
    UI.q = q.value;
    renderTxList();
  });
  sw.appendChild(q);
  var qx = el('button', null, null);
  qx.id = 'tx-qx';
  qx.setAttribute('aria-label', 'Bersihkan pencarian');
  qx.appendChild(icon('close'));
  qx.hidden = !UI.q;
  qx.addEventListener('click', function () {
    UI.q = ''; UI.fcat = ''; UI.scope = 'month'; render();
  });
  sw.appendChild(qx);
  root.appendChild(sw);

  /* --- chip filter kategori: hanya kategori yang benar-benar dipakai --- */
  var pool = (UI.scope === 'all' ? DATA.days : monthDays(UI.ym));
  var used = {}, order = [];
  for (var i = 0; i < pool.length; i++)
    for (var j = 0; j < pool[i].items.length; j++) {
      var ck = pool[i].items[j].cat;
      if (!used[ck]) { used[ck] = 0; order.push(ck); }
      used[ck]++;
    }
  order.sort(function (a, b) { return used[b] - used[a]; });
  if (order.length > 1 || UI.fcat) {
    var fc = el('div', 'fchips');
    fc.id = 'tx-fchips';
    var all = el('button', 'fchip');
    all.dataset.cat = '';
    all.textContent = 'Semua';
    all.setAttribute('aria-pressed', UI.fcat ? 'false' : 'true');
    all.addEventListener('click', function () { UI.fcat = ''; render(); });
    fc.appendChild(all);
    order.forEach(function (ck) {
      var c = catOf(ck);
      var b = el('button', 'fchip');
      b.dataset.cat = ck;
      b.setAttribute('aria-pressed', UI.fcat === ck ? 'true' : 'false');
      b.appendChild(icon(ck === TF_CAT ? 'transfer' : c.ic));
      b.appendChild(el('span', null, c.label));
      b.addEventListener('click', function () {
        UI.fcat = (UI.fcat === ck ? '' : ck);
        render();
      });
      fc.appendChild(b);
    });
    root.appendChild(fc);
  }

  var list = el('div');
  list.id = 'tx-list';
  root.appendChild(list);
  renderTxList();
}

/* Hanya bagian daftar. Dipanggil tiap ketukan di kotak cari. */
export function renderTxList() {
  var host = document.getElementById('tx-list');
  if (!host) return;
  host.innerHTML = '';
  var q = UI.q.trim().toLowerCase();
  var days = txFiltered(UI.scope, UI.ym, q, UI.fcat);
  var n = txCount(days);

  if (isFiltering()) {
    var rl = el('div', 'resline');
    rl.id = 'tx-result';
    rl.dataset.n = String(n);
    rl.appendChild(el('span', null, n + ' hasil' + (UI.scope === 'all' ? ' · semua bulan' : '')));
    rl.appendChild(el('span', 'spacer'));
    var clr = el('button', 'btn-sm plain', 'Bersihkan');
    clr.id = 'tx-clear';
    clr.addEventListener('click', function () {
      UI.q = ''; UI.fcat = ''; UI.scope = 'month'; render();
    });
    rl.appendChild(clr);
    host.appendChild(rl);
  }

  if (!n) {
    var e = el('div', 'empty');
    e.id = 'tx-empty';
    e.appendChild(el('span', 'ic', '—'));
    e.appendChild(el('div', null, isFiltering()
      ? 'Tidak ada yang cocok'
      : 'Belum ada transaksi di ' + ymLabel(UI.ym)));
    e.appendChild(el('div', 'tiny mut', isFiltering()
      ? 'Coba kata lain atau ganti filter'
      : 'Ketuk + untuk mencatat'));
    host.appendChild(e);
  }

  /* Ada hasil di bulan lain? Tawarkan, jangan diam-diam menyembunyikan. */
  if (UI.scope === 'month' && isFiltering()) {
    var elsewhere = txCount(txFiltered('all', 0, q, UI.fcat)) - n;
    if (elsewhere > 0) {
      var hint = el('div', 'hint');
      hint.id = 'tx-hint';
      hint.dataset.n = String(elsewhere);
      hint.appendChild(el('div', null, elsewhere + ' hasil lain di luar ' + ymLabel(UI.ym)));
      var b = el('button', null, 'Cari di semua bulan');
      b.id = 'tx-scope-all';
      b.addEventListener('click', function () { UI.scope = 'all'; render(); });
      hint.appendChild(b);
      host.appendChild(hint);
    }
  }

  var k = 0;
  for (var i = 0; i < days.length; i++) {
    var day = days[i];
    var hd = el('div', 'dayhd');
    hd.dataset.s = String(day.s);
    hd.appendChild(el('div', 'd', sLabel(day.s)));
    hd.appendChild(el('div', 'w', sWeekday(day.s)));
    /* saat menyaring, total hari dihitung dari baris yang TAMPIL — kalau tidak,
       angkanya tidak cocok dengan apa yang dilihat mata */
    var dt = dayTotal(day);
    hd.appendChild(el('div', 't', dt === 0 ? '—' : fmtRpSign(dt)));
    host.appendChild(hd);

    var box = el('div', 'txs');
    for (var j = 0; j < day.items.length; j++) {
      box.appendChild(txRow(day.items[j], day.s, q ? -1 : k++));
    }
    host.appendChild(box);
  }
}

export function txRow(it, s, stagger) {
  var c = catOf(it.cat), tf = isTf(it), inv = isInvestFlow(it);
  var row = el('button', 'tx' + (stagger >= 0 ? ' stg' : ''));
  row.dataset.id = String(it.id);
  row.dataset.cat = it.cat;
  row.dataset.amt = String(it.amt);
  row.dataset.s = String(s);
  if (tf) row.dataset.tf = tfKind(it);
  if (stagger >= 0) row.style.animationDelay = Math.min(stagger, 14) * 22 + 'ms';
  var av = el('div', 'av' + (tf ? ' g' : ''));
  av.appendChild(icon(inv ? (c.ic || 'investasi') : tf ? 'transfer' : c.ic));
  row.appendChild(av);
  var body = el('div', 'body');
  body.appendChild(el('div', 't1', it.title || c.label));
  /* kaki ditampilkan sebagai LABEL kelas, bukan kunci slug-nya */
  body.appendChild(el('div', 't2', (tf ? tfLabel(it) : c.label + ' · ' + it.acct)));
  row.appendChild(body);
  var amt = el('div', 'amt' + (tf ? ' tf' : it.amt >= 0 ? ' pos' : ''));
  amt.textContent = tf ? fmtRp(Math.abs(it.amt)) : fmtRpSign(it.amt);
  row.appendChild(amt);
  row.addEventListener('click', function () { sheetTx(it.id); });
  return row;
}
