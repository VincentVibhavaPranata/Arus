import { render } from '../app/render.js';
import { sLabel } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { fmtRp, fmtRpSign } from '../core/money.js';
import { assetClass } from '../core/networth.js';
import { DATA, save } from '../core/store.js';
import { fmtPF, fmtR, tradeStats, tradesClosed, tradesOpen } from '../features/trading.js';
import { sechd } from './lainnya.js';
import { sheetClose, sheetTrade } from '../sheets/trade.js';
import { setNum } from '../ui/animate.js';
import { el, go, monogram } from '../ui/nav.js';

/* ==================== LAYAR: JURNAL TRADING ==================== */
export function viewTrading(root) {
  var bar = el('div', 'backbar');
  var back = el('button', 'mnav');
  back.id = 'trd-back';
  back.setAttribute('aria-label', 'Kembali');
  back.appendChild(icon('chev_l'));
  back.addEventListener('click', function () { go('lainnya'); });
  bar.appendChild(back);
  bar.appendChild(el('h2', null, 'Jurnal trading'));
  var add = el('button', 'btn-sm');
  add.id = 'trd-add';
  add.appendChild(icon('plus'));
  add.appendChild(el('span', null, 'Trade'));
  add.addEventListener('click', function () { sheetTrade(); });
  bar.appendChild(add);
  root.appendChild(bar);

  var st = tradeStats();

  /* --- hero --- */
  var hero = el('div', 'hero');
  hero.appendChild(el('div', 'biglab', 'Hasil bersih terealisasi'));
  var big = el('div', 'big' + (st.net >= 0 ? ' pos' : ' neg'));
  big.id = 'trd-net';
  hero.appendChild(big);
  setNum(big, st.net, fmtRpSign);
  var pair = el('div', 'pair');
  function cell(k, txt, id, val) {
    var d = el('div');
    d.appendChild(el('div', 'k', k));
    var s = el('div', 'v');
    s.id = id;
    if (val != null) s.dataset.val = String(val);
    s.textContent = txt;
    d.appendChild(s);
    return d;
  }
  pair.appendChild(cell('Total R', fmtR(st.nR ? st.sumR : null), 'trd-sumr',
    st.nR ? st.sumR.toFixed(4) : ''));
  pair.appendChild(cell('Win rate', st.winRate == null ? '—' :
    Math.round(st.winRate * 100) + '%', 'trd-wr',
    st.winRate == null ? '' : st.winRate.toFixed(4)));
  hero.appendChild(pair);
  root.appendChild(hero);

  /* --- statistik --- */
  var stats = el('div', 'stats');
  stats.id = 'trd-stats';
  [['auto', fmtPF(st.profitFactor), 'Profit factor', 'trd-pf',
    st.profitFactor == null ? '' : String(st.profitFactor)],
   ['check', fmtR(st.expectancyR), 'Expectancy', 'trd-exp',
    st.expectancyR == null ? '' : st.expectancyR.toFixed(4)],
   ['dup', String(st.n), 'Trade tutup', 'trd-n', String(st.n)]
  ].forEach(function (x) {
    var d = el('div', x[0]);
    var n = el('div', 'n', x[1]);
    n.id = x[3];
    n.dataset.val = x[4];
    d.appendChild(n);
    d.appendChild(el('div', 'l', x[2]));
    stats.appendChild(d);
  });
  root.appendChild(stats);

  if (st.n > 0) {
    var line = el('div', 'tsum');
    line.id = 'trd-detail';
    line.appendChild(el('span', null, st.wins + ' menang · ' + st.losses + ' kalah' +
      (st.flat ? ' · ' + st.flat + ' impas' : '')));
    line.appendChild(el('span', 'spacer'));
    line.appendChild(el('b', null, 'rata-rata ' + fmtRpSign(Math.round(st.expectancyRp))));
    root.appendChild(line);
  }
  /* Kejujuran: trade tanpa risiko tercatat TIDAK punya R. Katakan, jangan
     diam-diam dihitung nol. */
  if (st.noRisk > 0) {
    var warn = el('div', 'hint');
    warn.id = 'trd-norisk';
    warn.dataset.n = String(st.noRisk);
    warn.style.textAlign = 'left';
    warn.textContent = st.noRisk + ' trade tanpa nilai risiko tercatat, jadi tidak ' +
      'ikut dihitung di Total R dan Expectancy. Net Rp tetap memasukkannya.';
    root.appendChild(warn);
  }

  /* --- posisi terbuka --- */
  var op = tradesOpen();
  root.appendChild(sechd('Posisi terbuka' + (op.length ? ' · ' + op.length : '')));
  var oc = el('div', 'card');
  oc.id = 'trd-open';
  oc.dataset.n = String(op.length);
  oc.style.padding = '4px 14px';
  if (!op.length) {
    var e0 = el('div', 'empty');
    e0.style.padding = '20px 10px';
    e0.appendChild(el('div', null, 'Tidak ada posisi terbuka'));
    oc.appendChild(e0);
  }
  op.forEach(function (t) { oc.appendChild(tradeRow(t, true)); });
  if (op.length) {
    var rl = el('div', 'tsum');
    rl.appendChild(el('span', null, 'Risiko terpasang'));
    rl.appendChild(el('span', 'spacer'));
    var rb = el('b', null, fmtRp(st.riskOpen));
    rb.id = 'trd-riskopen';
    rb.dataset.val = String(st.riskOpen);
    rl.appendChild(rb);
    oc.appendChild(rl);
  }
  root.appendChild(oc);

  /* --- riwayat --- */
  var cl = tradesClosed().slice().sort(function (a, b) { return (b.dOut || 0) - (a.dOut || 0); });
  root.appendChild(sechd('Riwayat' + (cl.length ? ' · ' + cl.length : '')));
  var cc = el('div', 'card');
  cc.id = 'trd-closed';
  cc.dataset.n = String(cl.length);
  cc.style.padding = '4px 14px';
  if (!cl.length) {
    var e1 = el('div', 'empty');
    e1.style.padding = '20px 10px';
    e1.appendChild(el('div', null, 'Belum ada trade tertutup'));
    cc.appendChild(e1);
  }
  cl.forEach(function (t) { cc.appendChild(tradeRow(t, false)); });
  root.appendChild(cc);

  /* --- kelas penerima PnL --- */
  root.appendChild(sechd('Hasil masuk ke'));
  var lc = el('div', 'card');
  lc.id = 'trd-link';
  lc.dataset.classk = DATA.trades.classK || '';
  var lg = el('div', 'catgrid');
  var opts = DATA.networth.assets.filter(function (c) { return c.k !== 'cash'; });
  var none = el('button', 'catchip');
  none.type = 'button';
  none.dataset.cls = '';
  none.setAttribute('aria-pressed', DATA.trades.classK ? 'false' : 'true');
  none.appendChild(icon('close'));
  none.appendChild(el('span', null, 'Tidak ada'));
  none.addEventListener('click', function () {
    DATA.trades.classK = null;
    save();
    render();
  });
  lg.appendChild(none);
  opts.forEach(function (c) {
    var b = el('button', 'catchip');
    b.type = 'button';
    b.dataset.cls = c.k;
    b.setAttribute('aria-pressed', DATA.trades.classK === c.k ? 'true' : 'false');
    b.appendChild(el('span', 'mono', monogram(c.label)));
    b.appendChild(el('span', null, c.label));
    b.addEventListener('click', function () {
      DATA.trades.classK = c.k;
      save();
      render();
    });
    lg.appendChild(b);
  });
  lc.appendChild(lg);
  var ln = el('div', 'tiny mut');
  ln.style.marginTop = '11px';
  ln.textContent = DATA.trades.classK
    ? 'PnL trade tertutup otomatis menambah nilai kelas "' +
      assetClass(DATA.trades.classK).label + '" di layar Akun. Setoran modal ' +
      'dicatat terpisah sebagai transfer, jadi tidak terhitung dua kali.'
    : 'Jurnal berdiri sendiri — PnL tidak menyentuh net worth. Nilai aset ' +
      'kripto kamu urus manual di layar Akun.';
  lc.appendChild(ln);
  root.appendChild(lc);
}

export function tradeRow(t, isOpen) {
  var row = el('div', 'arow');
  row.dataset.trade = t.id;
  row.dataset.pnl = String(t.pnl || 0);
  row.dataset.risk = String(t.risk || 0);
  var av = el('div', 'av' + (isOpen ? ' g' : ''));
  av.appendChild(icon('trade'));
  row.appendChild(av);

  var body = el('button', 'body');
  body.dataset.role = 'open';
  body.style.cssText = 'text-align:left;background:none';
  var t1 = el('div', 'n1');
  t1.appendChild(document.createTextNode(t.pair || '—'));
  var dirPill = el('span', 'pill', t.dir);
  dirPill.style.color = t.dir === 'LONG' ? 'var(--up)' : 'var(--down)';
  dirPill.style.borderColor = t.dir === 'LONG' ? 'rgba(111,242,176,.4)' : 'rgba(255,123,143,.4)';
  t1.appendChild(dirPill);
  body.appendChild(t1);
  var sub = isOpen
    ? 'buka ' + (t.dIn ? sLabel(t.dIn) : '—') + ' · risiko ' + fmtRp(t.risk)
    : (t.dOut ? sLabel(t.dOut) : '—') + ' · risiko ' + fmtRp(t.risk) +
      (t.risk > 0 ? ' · ' + fmtR(t.pnl / t.risk) : ' · R tak terhitung');
  body.appendChild(el('div', 'n2', sub));
  if (t.note) body.appendChild(el('div', 'n2', t.note));
  body.addEventListener('click', function () { sheetTrade(t.id); });
  row.appendChild(body);

  var right = el('div');
  right.style.cssText = 'flex:0 0 auto;text-align:right';
  if (isOpen) {
    var b = el('button', 'btn-sm');
    b.dataset.role = 'tutup';
    b.textContent = 'Tutup';
    b.addEventListener('click', function () { sheetClose(t.id); });
    right.appendChild(b);
  } else {
    right.appendChild(el('div', 'v' + ((t.pnl || 0) >= 0 ? ' pos' : ' neg'),
      fmtRpSign(t.pnl || 0)));
  }
  row.appendChild(right);
  return row;
}
