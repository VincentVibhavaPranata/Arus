import { DATA } from '../core/store.js';

/* =====================================================================
   JURNAL TRADING — catatan mentah saja; SEMUA statistik derived.
   Yang disimpan cuma fakta per trade: pair, arah, risiko, PnL, tanggal.
   ΣR, win-rate, profit factor, expectancy dihitung ulang tiap render.
   ===================================================================== */
export function tradesClosed(d) {
  d = d || DATA;
  return (d.trades.list || []).filter(function (t) { return !t.open; });
}

export function tradesOpen(d) {
  d = d || DATA;
  return (d.trades.list || []).filter(function (t) { return !!t.open; });
}

/* R = PnL dibagi risiko yang dipertaruhkan. Trade tanpa risiko tercatat TIDAK
   punya R — dikeluarkan dari statistik R dan JUMLAHNYA DILAPORKAN, bukan
   diam-diam dianggap nol. */
export function tradeStats(d) {
  d = d || DATA;
  var cl = tradesClosed(d);
  var st = {
    n: cl.length, nOpen: tradesOpen(d).length,
    net: 0, sumR: 0, nR: 0, noRisk: 0,
    wins: 0, losses: 0, flat: 0,
    grossWin: 0, grossLoss: 0,
    winRate: null, profitFactor: null, expectancyR: null, expectancyRp: null,
    riskOpen: 0
  };
  for (var i = 0; i < cl.length; i++) {
    var t = cl[i], p = Math.round(t.pnl || 0);
    st.net += p;
    if (p > 0) { st.wins++; st.grossWin += p; }
    else if (p < 0) { st.losses++; st.grossLoss += -p; }
    else st.flat++;
    var risk = Math.abs(Math.round(t.risk || 0));
    if (risk > 0) { st.sumR += p / risk; st.nR++; }
    else st.noRisk++;
  }
  var op = tradesOpen(d);
  for (i = 0; i < op.length; i++) st.riskOpen += Math.abs(Math.round(op[i].risk || 0));

  if (st.n > 0) {
    st.winRate = st.wins / st.n;
    st.expectancyRp = st.net / st.n;
  }
  if (st.nR > 0) st.expectancyR = st.sumR / st.nR;
  /* Profit factor: tanpa rugi sama sekali nilainya tak hingga — ditandai
     null + flag, bukan dipaksa jadi angka yang menyesatkan. */
  if (st.grossLoss > 0) st.profitFactor = st.grossWin / st.grossLoss;
  else if (st.grossWin > 0) st.profitFactor = Infinity;
  return st;
}

/* PnL terealisasi yang masuk ke sebuah kelas aset. Hanya kelas yang ditunjuk
   trades.classK yang menerimanya; kalau null, jurnal berdiri sendiri. */
export function tradePnl(k, d) {
  d = d || DATA;
  if (!d.trades || d.trades.classK !== k) return 0;
  var cl = tradesClosed(d), t = 0;
  for (var i = 0; i < cl.length; i++) t += Math.round(cl[i].pnl || 0);
  return t;
}

export function fmtR(v) {
  if (v == null || isNaN(v)) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(2) + 'R';
}

export function fmtPF(v) {
  if (v == null) return '—';
  if (v === Infinity) return '∞';
  return v.toFixed(2);
}
