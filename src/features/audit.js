import { ACCTS } from '../core/constants.js';
import { allItems, cpAll, cpDiff } from '../core/derived.js';
import { assetClass, targetTotal } from '../core/networth.js';
import { DATA, normTargets, sortDays } from '../core/store.js';
import { isAcct, isClassKey, isTf, tfLegs } from '../core/transfer.js';

/* =====================================================================
   AUDIT KONSISTENSI.

   Semua angka di Arus derived, jadi yang bisa rusak bukan hasil hitungannya
   melainkan CATATAN MENTAHNYA: hari tidak urut, id kembar, kategori yatim,
   kaki transfer menunjuk akun yang tidak ada. Audit ini memeriksa invarian
   itu satu per satu dan mengatakan apa yang ditemukannya.

   Yang bisa diperbaiki otomatis HANYA yang jelas benar caranya. Sisanya
   dilaporkan supaya kamu yang memutuskan — menebak perbaikan atas catatan
   uang lebih berbahaya daripada membiarkannya terlihat.
   ===================================================================== */
export function auditData(d) {
  d = d || DATA;
  var out = [], i, j;
  function add(level, code, msg, fix) {
    out.push({ level: level, code: code, msg: msg, fix: fix || null });
  }

  /* --- hari --- */
  var seq = d.days.map(function (x) { return x.s; });
  var sorted = seq.slice().sort(function (a, b) { return b - a; });
  if (String(seq) !== String(sorted))
    add('error', 'hari-urut', 'Daftar hari tidak urut menurun.', 'sort');
  var seen = {}, dup = [];
  for (i = 0; i < seq.length; i++) {
    if (seen[seq[i]]) dup.push(seq[i]);
    seen[seq[i]] = 1;
  }
  if (dup.length)
    add('error', 'hari-kembar', dup.length + ' tanggal muncul lebih dari sekali: ' +
      dup.slice(0, 4).join(', ') + '.', 'merge');
  var kosong = d.days.filter(function (x) { return !x.items.length; }).length;
  if (kosong) add('warn', 'hari-kosong', kosong + ' hari tanpa transaksi.', 'prune');
  var tglAneh = seq.filter(function (s) {
    var m = Math.floor(s / 100) % 100, dd = s % 100;
    return String(s).length !== 8 || m < 1 || m > 12 || dd < 1 || dd > 31;
  });
  if (tglAneh.length)
    add('error', 'tanggal-tak-sah', tglAneh.length + ' tanggal tidak masuk akal: ' +
      tglAneh.slice(0, 3).join(', ') + '.');

  /* --- item --- */
  var ids = {}, idDup = 0, maxId = 0, amtAneh = 0, catYatim = {};
  var catSet = {};
  for (i = 0; i < d.cats.length; i++) catSet[d.cats[i].k] = 1;
  var all = allItems(d);
  for (i = 0; i < all.length; i++) {
    var it = all[i].it;
    if (ids[it.id]) idDup++;
    ids[it.id] = 1;
    if (typeof it.id === 'number' && it.id > maxId) maxId = it.id;
    if (typeof it.amt !== 'number' || !isFinite(it.amt) || Math.round(it.amt) !== it.amt) amtAneh++;
    if (!catSet[it.cat]) catYatim[it.cat] = (catYatim[it.cat] || 0) + 1;
  }
  if (idDup) add('error', 'id-kembar', idDup + ' transaksi memakai id yang sama. ' +
    'Urungkan bisa mengenai item yang salah.', 'reid');
  if (amtAneh) add('error', 'nominal-tak-sah', amtAneh + ' transaksi bernominal bukan bilangan bulat.');
  var yatimKeys = Object.keys(catYatim);
  if (yatimKeys.length) {
    var n = 0;
    yatimKeys.forEach(function (k) { n += catYatim[k]; });
    add('error', 'kategori-yatim', n + ' transaksi menunjuk kategori yang sudah tidak ada (' +
      yatimKeys.slice(0, 3).join(', ') + ').', 'orphan');
  }
  if (typeof d.seq !== 'number' || d.seq < maxId)
    add('error', 'seq-mundur', 'Penghitung id (seq) lebih kecil dari id terbesar — ' +
      'id berikutnya akan bentrok.', 'seq');

  /* --- transfer --- */
  var kakiAneh = 0, contoh = '';
  for (i = 0; i < all.length; i++) {
    if (!isTf(all[i].it)) continue;
    var g = tfLegs(all[i].it);
    var okFrom = isAcct(g.from) || isClassKey(g.from);
    var okTo = isAcct(g.to) || isClassKey(g.to);
    if (!okFrom || !okTo) {
      kakiAneh++;
      if (!contoh) contoh = all[i].it.acct;
    }
  }
  if (kakiAneh)
    add('error', 'kaki-hantu', kakiAneh + ' transfer punya kaki yang tidak dikenali ' +
      '(mis. "' + contoh + '"). Uangnya hilang dari perhitungan saldo.');

  /* --- net worth --- */
  var tg = targetTotal(d);
  if (tg !== 100) add('error', 'target-bukan-100', 'Total target alokasi ' + tg + '%, bukan 100%.', 'targets');
  var cash = assetClass('cash', d);
  if (!cash) add('error', 'kas-hilang', 'Kelas Kas & Setara tidak ada.');
  else if (cash.rows) add('error', 'kas-manual', 'Kelas kas punya baris manual — nilainya harus derived.', 'cashrows');
  var rowIds = {}, rowDup = 0;
  d.networth.assets.forEach(function (c) {
    (c.rows || []).forEach(function (r) {
      if (rowIds[r.id]) rowDup++;
      rowIds[r.id] = 1;
    });
  });
  if (rowDup) add('warn', 'baris-aset-kembar', rowDup + ' baris aset memakai id yang sama.', 'reid-rows');
  if ((d.networth.liab || []).some(function (l) { return l.amt < 0; }))
    add('warn', 'utang-negatif', 'Ada utang bernilai negatif — seharusnya disimpan positif.', 'liab');

  /* --- jurnal trading --- */
  if (d.trades && d.trades.classK && !assetClass(d.trades.classK, d))
    add('error', 'jurnal-kelas-hantu', 'Jurnal menunjuk kelas aset yang sudah dihapus. ' +
      'PnL-nya tidak sampai ke net worth.', 'unlink');
  var trBad = (d.trades && d.trades.list || []).filter(function (t) {
    return !t.open && (typeof t.pnl !== 'number' || !isFinite(t.pnl));
  }).length;
  if (trBad) add('error', 'trade-pnl-tak-sah', trBad + ' trade tertutup tanpa PnL yang sah.');

  /* --- anggaran, tujuan, rutin --- */
  var budYatim = Object.keys(d.budgets).filter(function (k) { return !catSet[k]; });
  if (budYatim.length)
    add('warn', 'anggaran-yatim', budYatim.length + ' anggaran menunjuk kategori yang sudah tidak ada (' +
      budYatim.slice(0, 3).join(', ') + ').', 'budget');
  var goalDup = {}, gd = 0;
  (d.goals || []).forEach(function (g2) { if (goalDup[g2.id]) gd++; goalDup[g2.id] = 1; });
  if (gd) add('warn', 'tujuan-kembar', gd + ' tujuan memakai id yang sama.', 'reid-goals');
  var recBad = (d.recurring || []).filter(function (r) {
    return !catSet[r.cat] || ACCTS.indexOf(r.acct) < 0 || !(r.day >= 1 && r.day <= 31);
  }).length;
  if (recBad) add('warn', 'rutin-tak-sah', recBad + ' tagihan rutin menunjuk kategori/akun yang ' +
    'tidak ada, atau tanggalnya di luar 1–31.');

  /* --- titik periksa saldo: pembanding dari luar --- */
  var cpBad = cpAll(d).filter(function (c) { return cpDiff(c, d) !== 0; });
  if (cpBad.length) {
    var kurang = cpBad.filter(function (c) { return cpDiff(c, d) < 0; }).length;
    add('warn', 'saldo-tak-cocok', cpBad.length + ' titik periksa tidak cocok dengan ' +
      'saldo yang dicetak bank' + (kurang ? ' — ' + kurang + ' di antaranya catatan KURANG, ' +
      'kemungkinan ada bulan yang belum diimpor' : '') + '.');
  }
  var ruleYatim = Object.keys(d.catRules || {}).filter(function (t) { return !catSet[d.catRules[t]]; });
  if (ruleYatim.length)
    add('warn', 'aturan-kategori-yatim', ruleYatim.length + ' ingatan kategori menunjuk ' +
      'kategori yang sudah tidak ada.', 'catrule');

  /* --- staging --- */
  var stBad = (d.staging || []).filter(function (r) {
    return !r.sid || typeof r.amt !== 'number';
  }).length;
  if (stBad) add('warn', 'staging-rusak', stBad + ' baris impor tertunda berbentuk aneh.', 'staging');

  return out;
}

/* Perbaikan HANYA untuk hal yang jelas satu-satunya cara benarnya. */
export function auditFix(codes, d) {
  d = d || DATA;
  var did = [];
  function has(c) { return codes.indexOf(c) >= 0; }

  if (has('hari-kembar')) {
    var byS = {};
    d.days.forEach(function (x) {
      if (!byS[x.s]) byS[x.s] = { s: x.s, items: [] };
      byS[x.s].items = byS[x.s].items.concat(x.items);
    });
    d.days = Object.keys(byS).map(function (k) { return byS[k]; });
    did.push('hari-kembar');
  }
  if (has('hari-kosong')) {
    d.days = d.days.filter(function (x) { return x.items.length; });
    did.push('hari-kosong');
  }
  if (has('hari-urut') || did.length) { sortDays(d); did.push('hari-urut'); }
  if (has('id-kembar') || has('seq-mundur')) {
    var next = 0, all = allItems(d);
    for (var i = 0; i < all.length; i++) if (all[i].it.id > next) next = all[i].it.id;
    var seenId = {};
    for (i = 0; i < all.length; i++) {
      var it = all[i].it;
      if (seenId[it.id]) it.id = ++next;
      seenId[it.id] = 1;
    }
    if (typeof d.seq !== 'number' || d.seq < next) d.seq = next;
    did.push('id-kembar', 'seq-mundur');
  }
  if (has('kategori-yatim')) {
    var catSet = {};
    d.cats.forEach(function (c) { catSet[c.k] = 1; });
    allItems(d).forEach(function (x) { if (!catSet[x.it.cat]) x.it.cat = 'lain'; });
    did.push('kategori-yatim');
  }
  if (has('target-bukan-100')) { normTargets(d); did.push('target-bukan-100'); }
  if (has('kas-manual')) { delete assetClass('cash', d).rows; did.push('kas-manual'); }
  if (has('jurnal-kelas-hantu')) { d.trades.classK = null; did.push('jurnal-kelas-hantu'); }
  if (has('anggaran-yatim')) {
    var cs = {};
    d.cats.forEach(function (c) { cs[c.k] = 1; });
    Object.keys(d.budgets).forEach(function (k) { if (!cs[k]) delete d.budgets[k]; });
    Object.keys(d.budgetsMo || {}).forEach(function (m) {
      Object.keys(d.budgetsMo[m]).forEach(function (k) { if (!cs[k]) delete d.budgetsMo[m][k]; });
    });
    did.push('anggaran-yatim');
  }
  if (has('utang-negatif')) {
    (d.networth.liab || []).forEach(function (l) { l.amt = Math.abs(l.amt); });
    did.push('utang-negatif');
  }
  if (has('baris-aset-kembar') || has('tujuan-kembar')) {
    var used = {};
    d.networth.assets.forEach(function (c) {
      (c.rows || []).forEach(function (r) {
        if (used[r.id]) r.id = 'a' + (++d.seq);
        used[r.id] = 1;
      });
    });
    var ug = {};
    (d.goals || []).forEach(function (g2) {
      if (ug[g2.id]) g2.id = 'g' + (++d.seq);
      ug[g2.id] = 1;
    });
    did.push('baris-aset-kembar', 'tujuan-kembar');
  }
  if (has('aturan-kategori-yatim')) {
    var cs2 = {};
    d.cats.forEach(function (c) { cs2[c.k] = 1; });
    Object.keys(d.catRules || {}).forEach(function (t) {
      if (!cs2[d.catRules[t]]) delete d.catRules[t];
    });
    did.push('aturan-kategori-yatim');
  }
  if (has('staging-rusak')) {
    d.staging = (d.staging || []).filter(function (r) { return r.sid && typeof r.amt === 'number'; });
    did.push('staging-rusak');
  }
  return did;
}
