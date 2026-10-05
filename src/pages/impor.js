import { render } from '../app/render.js';
import { catOf } from '../core/categories.js';
import { sLabel } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { fmtRpSign } from '../core/money.js';
import { DATA, withUndo } from '../core/store.js';
import { tfLabel } from '../core/transfer.js';
import { commitStaging, restage, stagingStats } from '../features/staging.js';
import { pickFile, stageRows } from '../importers/index.js';
import { SAMPLE_BYBIT, SAMPLE_GOPAY, parseBybit, parseGoPay } from '../importers/simulasi.js';
import { sechd } from './lainnya.js';
import { sheetPaste, sheetStage } from '../sheets/importStage.js';
import { el, go } from '../ui/nav.js';
import { toast } from '../ui/toast.js';

/* ---------- layar Impor ---------- */
export function viewImpor(root) {
  var bar = el('div', 'backbar');
  var back = el('button', 'mnav');
  back.id = 'imp-back';
  back.setAttribute('aria-label', 'Kembali');
  back.appendChild(icon('chev_l'));
  back.addEventListener('click', function () { go('lainnya'); });
  bar.appendChild(back);
  bar.appendChild(el('h2', null, 'Impor'));
  root.appendChild(bar);

  if (DATA.staging.length) { root.appendChild(reviewBlock()); return; }

  root.appendChild(sechd('Transaksi'));
  root.appendChild(iopt('imp-paste', 'Tempel teks CSV',
    'Mutasi BCA (KlikBCA / myBCA) dikenali sendiri; format umum juga bisa'));
  root.appendChild(iopt('imp-file', 'Pilih berkas (PDF / CSV)',
    'e-statement BCA .pdf dibaca langsung di HP-mu, tidak diunggah ke mana pun'));
  root.appendChild(sechd('Portofolio'));
  root.appendChild(iopt('imp-folio', 'Impor nilai portofolio',
    'Perbarui nilai aset berdasarkan nama baris'));

  root.appendChild(sechd('Sumber simulasi'));
  var note = el('div', 'hint');
  note.style.textAlign = 'left';
  note.textContent = 'Belum ada sambungan API ke GoPay maupun Bybit. Dua tombol ' +
    'di bawah memasukkan DATA CONTOH berbentuk asli lewat parser yang sama — ' +
    'berguna untuk mencoba alurnya, bukan untuk menarik data sungguhan.';
  root.appendChild(note);
  root.appendChild(iopt('imp-gopay', 'GoPay', 'Riwayat transaksi contoh · 4 baris', true));
  root.appendChild(iopt('imp-bybit', 'Bybit', 'Setor & tarik contoh · kurs contoh', true));

  document.getElementById('imp-paste').addEventListener('click', sheetPaste);
  document.getElementById('imp-file').addEventListener('click', function () { pickFile(false); });
  document.getElementById('imp-folio').addEventListener('click', function () { pickFile(true); });
  document.getElementById('imp-gopay').addEventListener('click', function () {
    try { stageRows(parseGoPay(SAMPLE_GOPAY), 'data simulasi'); }
    catch (e) { toast('Gagal: ' + e.message); }
  });
  document.getElementById('imp-bybit').addEventListener('click', function () {
    try { stageRows(parseBybit(SAMPLE_BYBIT), 'data simulasi'); }
    catch (e) { toast('Gagal: ' + e.message, { ms: 6000 }); }
  });
}

export function iopt(id, t1, t2, sim) {
  var b = el('button', 'iopt');
  b.id = id;
  var av = el('div', 'av g');
  av.appendChild(icon('arrow_d'));
  b.appendChild(av);
  var body = el('div', 'body');
  body.appendChild(el('div', 't1', t1));
  body.appendChild(el('div', 't2', t2));
  b.appendChild(body);
  if (sim) b.appendChild(el('span', 'simbadge', 'simulasi'));
  else b.appendChild(icon('chev_r'));
  return b;
}

/* ---------- blok Tinjau ---------- */
export function reviewBlock() {
  var wrap = el('div');
  wrap.id = 'review';
  var rows = DATA.staging;
  restage(rows);
  var st = stagingStats(rows);
  wrap.dataset.total = String(st.total);
  wrap.dataset.auto = String(st.auto);
  wrap.dataset.check = String(st.check);
  wrap.dataset.dup = String(st.dup);
  wrap.dataset.sel = String(st.sel);

  var stats = el('div', 'stats');
  [['auto', st.auto, 'Siap'], ['check', st.check, 'Perlu dicek'], ['dup', st.dup, 'Duplikat']]
    .forEach(function (x) {
      var d = el('div', x[0]);
      d.appendChild(el('div', 'n', String(x[1])));
      d.appendChild(el('div', 'l', x[2]));
      stats.appendChild(d);
    });
  wrap.appendChild(stats);

  var tools = el('div', 'resline');
  tools.appendChild(el('span', null, st.sel + ' dari ' + st.total + ' dipilih'));
  tools.appendChild(el('span', 'spacer'));
  var selAll = el('button', 'btn-sm plain', 'Pilih siap');
  selAll.id = 'rev-sel-auto';
  selAll.addEventListener('click', function () {
    rows.forEach(function (r) { r.sel = r.state === 'auto'; r.selAuto = false; });
    render();
  });
  tools.appendChild(selAll);
  var selNone = el('button', 'btn-sm plain', 'Kosongkan');
  selNone.id = 'rev-sel-none';
  selNone.addEventListener('click', function () {
    rows.forEach(function (r) { r.sel = false; r.selAuto = false; });
    render();
  });
  tools.appendChild(selNone);
  wrap.appendChild(tools);

  var card = el('div', 'card');
  card.id = 'rev-list';
  card.style.padding = '0';
  rows.forEach(function (r) { card.appendChild(stageRow(r)); });
  wrap.appendChild(card);

  var barw = el('div', 'commitbar');
  var commit = el('button', 'btn');
  commit.id = 'rev-commit';
  commit.disabled = st.sel === 0;
  commit.textContent = st.sel ? 'Catat ' + st.sel + ' transaksi · ' + fmtRpSign(st.selAmt)
                              : 'Pilih baris dulu';
  commit.addEventListener('click', function () {
    var n = st.sel;
    withUndo('Dicatat ' + n + ' transaksi', function () { commitStaging(); });
  });
  barw.appendChild(commit);
  var drop = el('button', 'btn ghost');
  drop.id = 'rev-drop';
  drop.style.marginTop = '9px';
  drop.textContent = 'Buang sisa impor';
  var armed = false;
  drop.addEventListener('click', function () {
    if (!armed) { armed = true; drop.dataset.armed = '1'; drop.textContent = 'Ketuk lagi untuk membuang'; return; }
    withUndo('Impor dibuang', function () { DATA.staging = []; });
  });
  barw.appendChild(drop);
  wrap.appendChild(barw);
  return wrap;
}

export function stageRow(r) {
  var row = el('div', 'srow' + (r.state === 'dup' ? ' dup' : ''));
  row.dataset.sid = r.sid;
  row.dataset.state = r.state;
  row.dataset.amt = String(isNaN(r.amt) ? '' : r.amt);
  row.dataset.s = String(r.s);
  row.dataset.sel = r.sel ? '1' : '0';

  var cb = el('button', 'cbx');
  cb.dataset.role = 'sel';
  cb.setAttribute('role', 'checkbox');
  cb.setAttribute('aria-checked', r.sel ? 'true' : 'false');
  cb.appendChild(icon('check'));
  cb.disabled = r.state === 'dup';
  cb.addEventListener('click', function () {
    r.sel = !r.sel;
    r.selAuto = false;                 // pilihan user menang atas aturan otomatis
    render();
  });
  row.appendChild(cb);

  var body = el('button', 'body');
  body.dataset.role = 'open';
  body.style.cssText = 'text-align:left;background:none';
  body.appendChild(el('div', 't1', r.title));
  var c = catOf(r.cat);
  body.appendChild(el('div', 't2',
    (r.s ? sLabel(r.s) : 'Tanggal? ' + (r.dateS || '—')) + ' · ' +
    (r.tfAcct ? tfLabel({ acct: r.tfAcct, transfer: true }) : c.label + ' · ' + r.acct)));
  if (r.hint) body.appendChild(el('div', 'hint', r.hint));
  if (r.aiCat && !r.catTouched) body.appendChild(el('div', 'hint ai', 'Kategori disarankan AI — periksa dulu'));
  body.addEventListener('click', function () { sheetStage(r.sid); });
  row.appendChild(body);

  var right = el('div', 'right');
  var a = el('div', 'amt' + (isNaN(r.amt) ? '' : r.amt >= 0 ? ' pos' : ''));
  a.textContent = isNaN(r.amt) ? '—' : fmtRpSign(r.amt);
  right.appendChild(a);
  right.appendChild(el('div', 'sbadge ' + r.state,
    r.state === 'auto' ? 'siap' : r.state === 'check' ? 'cek' : 'dup'));
  row.appendChild(right);
  return row;
}
