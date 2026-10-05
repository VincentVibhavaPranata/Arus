import { render } from '../app/render.js';
import { ACCTS, KEY, TF_CAT } from './constants.js';
import { dToS, sToD, todayS } from './dates.js';
import { findItem } from './derived.js';
import { CATS_DEFAULT, SVG } from './icons.js';
import { assetClass } from './networth.js';
import { mkTfAcct } from './transfer.js';
import { toast } from '../ui/toast.js';

/* ============================ STATE ============================ */
export var DATA = null;
export function setData(v) { DATA = v; }

/* v2: baris kelas aset bermakna PENYESUAIAN NILAI, bukan nilai penuh — nilai
   kelas = setoran bersih (derived) + penyesuaian. Migrasi tidak mengubah angka
   apa pun: data lama belum punya setoran, jadi Σ penyesuaian = total lama. */
export function blankData() {
  return {
    v: 2,
    seq: 0,
    days: [],
    cats: CATS_DEFAULT.map(function (c) { return { k:c.k, label:c.label, ic:c.ic, kind:c.kind }; }),
    budgets: {},        // default global   : { makan: 1200000 }
    budgetsMo: {},      // override / bulan : { 202607: { makan: 1500000 } }
    goals: [],
    /* Ingatan kategori per nama transaksi: { "warteg gra": "makan" }.
       Bukan agregat — ini KEPUTUSANMU yang disimpan supaya tidak ditanya
       berulang-ulang setiap impor. */
    catRules: {},
    /* Titik periksa saldo: saldo yang DIKATAKAN BANK pada suatu tanggal.
       Ini fakta dari luar, bukan hitungan kita sendiri, jadi menyimpannya
       tidak melanggar aturan "semua angka derived" — justru dia yang
       dipakai untuk memeriksa hitungan kita. */
    checkpoints: [],
    acctStart: { GoPay:0, BCA:0, OVO:0, Cash:0 },
    networth: {
      assets: [
        { k:'cash',   label:'Kas & Setara', color:'#8d7bff', derived:true },
        { k:'saham',  label:'Saham & Reksa Dana', color:'#4cc9ff', rows:[] },
        { k:'kripto', label:'Kripto',       color:'#e08bff', rows:[] },
        { k:'emas',   label:'Emas',         color:'#ffc56b', rows:[] }
      ],
      targets: { cash:20, saham:40, kripto:20, emas:20 },   // total WAJIB 100
      liab: []
    },
    recurring: [],
    /* classK = kelas aset yang menerima PnL terealisasi. null = jurnal murni. */
    trades: { classK: 'kripto', list: [] },
    staging: [],
    sync: { url:'', token:'', user:'', rev:0, lastAt:0 }
  };
}

/* --- DATA CONTOH: semua item ditandai demo:true supaya bisa dibersihkan
   sekaligus nanti. Tanggal RELATIF terhadap hari ini. --- */
export function seedDemo() {
  var d = blankData();
  d.acctStart = { GoPay: 185000, BCA: 4200000, OVO: 50000, Cash: 320000 };
  d.budgets   = { makan: 1500000, transport: 500000, belanja: 800000, hiburan: 300000, tagihan: 900000 };
  d.goals = [
    { id: 'g1', name: 'Dana Darurat',  target: 30000000, saved: 8500000 },
    { id: 'g2', name: 'Laptop Baru',   target: 18000000, saved: 3200000 }
  ];
  /* Baris = penyesuaian nilai. 'Beli reksa dana' di bawah masuk sebagai SETORAN
     (transfer BCA → saham), jadi nilai berdirinya dikurangi sebesar itu supaya
     total kelas tetap Rp17.900.000 — setoran + penyesuaian, tanpa hitung ganda. */
  assetClass('saham', d).rows = [
    { id: 'a91', name: 'Reksa Dana Pasar Uang', sub: 'Bibit', amt: 5500000 },
    { id: 'a92', name: 'BBCA',                  sub: '12 lot', amt: 11400000 }
  ];
  assetClass('kripto', d).rows = [
    { id: 'a93', name: 'Bitcoin', sub: '0,014 BTC', amt: 9800000 }
  ];
  assetClass('emas', d).rows = [
    { id: 'a94', name: 'Antam', sub: '5 gram', amt: 7250000 }
  ];
  d.networth.liab = [
    { id: 'l91', name: 'Cicilan HP', amt: 1800000 }
  ];
  d.seq = 100;
  var T = todayS();
  /* Sebarannya dibiarkan wajar dan boleh menyeberang bulan. Kalau dipaksa masuk
     bulan berjalan semua, di tanggal 1 seluruh data menumpuk pada satu hari —
     terlihat palsu, dan pengelompokan per hari jadi tidak kelihatan. Dasbor
     yang sepi di awal bulan itu justru benar: memang belum ada pengeluaran. */
  function back(n) { var x = sToD(T); x.setDate(x.getDate() - n); return dToS(x); }
  var seed = [
    [0, 'makan',     'Kopi Kenangan',     'GoPay', -28000],
    [0, 'transport', 'Gojek ke kantor',   'GoPay', -32000],
    [1, 'makan',     'Warteg Bahari',     'Cash',  -25000],
    [1, TF_CAT,      'Top up GoPay',      mkTfAcct('BCA','GoPay'), -500000, true],
    [2, 'belanja',   'Indomaret',         'BCA',   -87500],
    [3, 'gaji',      'Gaji bulanan',      'BCA',   9500000],
    [3, 'tagihan',   'Internet IndiHome', 'BCA',   -395000],
    [4, 'pendidikan','Kursus bahasa',     'BCA',   -450000],
    [4, 'investasi', 'Beli reksa dana',   mkTfAcct('BCA','saham'), -1000000, true],
    [5, 'hiburan',   'Netflix',           'BCA',   -65000],
    [6, 'makan',     'Padang Sederhana',  'OVO',   -42000],
    [8, 'transport', 'Isi Pertamax',      'Cash',  -150000]
  ];
  for (var i = 0; i < seed.length; i++) {
    var r = seed[i];
    addItem({ s: back(r[0]), cat: r[1], title: r[2], acct: r[3], amt: r[4],
              transfer: r[5] === true, demo: true }, d);
  }
  return d;
}

export function load() {
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {}
  if (raw) {
    try {
      DATA = migrate(JSON.parse(raw));
      return false;                                   // bukan boot pertama
    } catch (e) { console.warn('DATA rusak, mulai baru', e); }
  }
  DATA = seedDemo();
  save();
  return true;                                        // boot pertama
}

export function migrate(d) {
  var b = blankData(), k;
  for (k in b) if (!(k in d)) d[k] = b[k];
  /* Warna kelas aset tersimpan di data. Palet lama (emas) diganti palet baru
     supaya data lama ikut tampil serasi. Warna pilihan sendiri tidak disentuh. */
  /* Izin & key AI milik perangkat (arus-ai-v1), bukan data: buang salinan yang
     mungkin terbawa dari cadangan/sinkronisasi supaya izin tidak ikut pindah. */
  delete d.ai;
  var LEGACY = { '#d4af37': '#8d7bff', '#5aa2ff': '#4cc9ff', '#a77bff': '#e08bff', '#e8c34a': '#ffc56b' };
  if (d.networth && d.networth.assets)
    d.networth.assets.forEach(function (a) { if (a && LEGACY[a.color]) a.color = LEGACY[a.color]; });
  if (!d.budgetsMo) d.budgetsMo = {};
  if (!d.cats || !d.cats.length) d.cats = b.cats;
  /* Kategori bawaan yang BARU (mis. pendidikan, investasi) harus masuk ke DATA
     lama juga — kalau tidak, user yang sudah pakai app tak akan pernah melihat
     kategori baru. Objek yang sudah ada dipakai ulang supaya label/ikon hasil
     ubahan user tidak ditimpa. Urutan: bawaan sesuai urutan kanonik, kategori
     buatan user menyusul. `catsRemoved` menghormati penghapusan (dipakai v0.2). */
  var canon = {}, seen = {}, ordered = [], gone = d.catsRemoved || [];
  for (var q = 0; q < CATS_DEFAULT.length; q++) canon[CATS_DEFAULT[q].k] = 1;
  for (var q = 0; q < d.cats.length; q++) seen[d.cats[q].k] = d.cats[q];
  for (var q = 0; q < CATS_DEFAULT.length; q++) {
    var cd = CATS_DEFAULT[q];
    if (!seen[cd.k] && gone.indexOf(cd.k) >= 0) continue;      // sengaja dihapus user
    ordered.push(seen[cd.k] || { k:cd.k, label:cd.label, ic:cd.ic, kind:cd.kind });
  }
  for (var q = 0; q < d.cats.length; q++) if (!canon[d.cats[q].k]) ordered.push(d.cats[q]);
  d.cats = ordered;
  /* migrasi emoji -> set ikon SVG (DATA lama menyimpan c.icon) */
  for (var ci = 0; ci < d.cats.length; ci++) {
    var c = d.cats[ci];
    if (!c.ic || !SVG[c.ic]) c.ic = SVG[c.k] ? c.k : 'lain';
    delete c.icon;
  }
  for (var i = 0; i < ACCTS.length; i++)
    if (typeof d.acctStart[ACCTS[i]] !== 'number') d.acctStart[ACCTS[i]] = 0;

  /* --- net worth: rapikan bentuk supaya render tak perlu memeriksa apa pun --- */
  var nw = d.networth;
  if (!nw.assets || !nw.assets.length) nw.assets = b.networth.assets;
  if (!nw.liab) nw.liab = [];
  if (!nw.targets) nw.targets = {};
  delete nw.series;                      /* tren = derived, jangan disimpan */
  for (var a = 0; a < nw.assets.length; a++) {
    var cls = nw.assets[a];
    if (cls.k === 'cash') {              /* kas TIDAK boleh punya baris manual */
      delete cls.rows;
      cls.derived = true;
    } else {
      if (!cls.rows) cls.rows = [];
      for (var r = 0; r < cls.rows.length; r++) {
        var rw = cls.rows[r];
        if (rw.id == null) rw.id = 'a' + (++d.seq);
        delete rw.av;                    /* monogram = derived dari nama */
        rw.amt = Math.round(rw.amt || 0);
      }
    }
    if (typeof nw.targets[cls.k] !== 'number') nw.targets[cls.k] = 0;
  }
  for (var t in nw.targets)              /* buang target kelas yang sudah hilang */
    if (!nw.assets.some(function (x) { return x.k === t; })) delete nw.targets[t];
  for (var l = 0; l < nw.liab.length; l++) {
    if (nw.liab[l].id == null) nw.liab[l].id = 'l' + (++d.seq);
    nw.liab[l].amt = Math.abs(Math.round(nw.liab[l].amt || 0));
  }
  normTargets(d);
  /* Kunci kelas TIDAK boleh bentrok dengan nama akun — kalau bentrok, kaki
     transfer 'BCA → bca' jadi ambigu dan uang bisa terhitung dua kali. */
  for (var z = nw.assets.length - 1; z >= 0; z--) {
    var kk = nw.assets[z].k;
    if (kk === 'cash') continue;
    for (var q2 = 0; q2 < ACCTS.length; q2++) {
      if (ACCTS[q2].toLowerCase() === String(kk).toLowerCase()) {
        nw.assets[z].k = kk + '-aset';
        delete nw.targets[kk];
        nw.targets[kk + '-aset'] = 0;
        normTargets(d);
        break;
      }
    }
  }
  if (!d.catRules || typeof d.catRules !== 'object') d.catRules = {};
  if (!Array.isArray(d.checkpoints)) d.checkpoints = [];
  for (var cp = d.checkpoints.length - 1; cp >= 0; cp--) {
    var c2 = d.checkpoints[cp];
    if (!c2 || ACCTS.indexOf(c2.acct) < 0 || typeof c2.s !== 'number' ||
        typeof c2.saldo !== 'number') { d.checkpoints.splice(cp, 1); continue; }
    if (c2.id == null) c2.id = 'c' + (++d.seq);
    c2.saldo = Math.round(c2.saldo);
  }
  /* jurnal trading: bentuk lama {list:[]} tanpa classK */
  if (!d.trades || typeof d.trades !== 'object') d.trades = { classK: null, list: [] };
  if (!Array.isArray(d.trades.list)) d.trades.list = [];
  if (!('classK' in d.trades))
    d.trades.classK = assetClass('kripto', d) ? 'kripto' : null;
  /* kelas penerima yang sudah dihapus tidak boleh jadi penerima hantu */
  if (d.trades.classK && !assetClass(d.trades.classK, d)) d.trades.classK = null;
  for (var tz = 0; tz < d.trades.list.length; tz++) {
    var tr = d.trades.list[tz];
    if (tr.id == null) tr.id = 't' + (++d.seq);
    tr.risk = Math.abs(Math.round(tr.risk || 0));
    tr.pnl = Math.round(tr.pnl || 0);
    tr.open = !!tr.open;
    tr.dir = tr.dir === 'SHORT' ? 'SHORT' : 'LONG';
  }

  d.v = 2;
  sortDays(d);
  return d;
}

/* Total target WAJIB 100%. Selisih apa pun dibebankan ke kas — kelas yang
   selalu ada — supaya keadaan tak sah tidak pernah tersimpan. */
export function normTargets(d) {
  d = d || DATA;
  var tg = d.networth.targets, keys = Object.keys(tg), sum = 0, i;
  if (!keys.length) return;
  for (i = 0; i < keys.length; i++) {
    tg[keys[i]] = Math.max(0, Math.round(tg[keys[i]]));
    sum += tg[keys[i]];
  }
  if (sum === 100) return;
  var anchor = tg.cash != null ? 'cash' : keys[0];
  tg[anchor] = Math.max(0, tg[anchor] + (100 - sum));
  /* kalau kas tak cukup menyerap, potong dari kelas terbesar lain */
  sum = 0;
  for (i = 0; i < keys.length; i++) sum += tg[keys[i]];
  var guard = 0;
  while (sum !== 100 && guard++ < 40) {
    var big = keys.slice().sort(function (x, y) { return tg[y] - tg[x]; })[0];
    tg[big] = Math.max(0, tg[big] + (100 - sum));
    sum = 0;
    for (i = 0; i < keys.length; i++) sum += tg[keys[i]];
  }
}

export function save() {
  /* Mode tertanam (halaman konverter): skrip ini dipakai sebagai pustaka
     parser saja. Jangan menulis apa pun ke penyimpanan pengunjung. */
  if (window.ARUS_EMBED) return;
  try { localStorage.setItem(KEY, JSON.stringify(DATA)); }
  catch (e) { toast('Gagal menyimpan: penyimpanan penuh'); }
}

export function snapshot() { return JSON.stringify(DATA); }

export function restore(snap) { DATA = JSON.parse(snap); save(); render(); }

/* --- invarian: days sort DESC by s, dijaga di satu tempat --- */
export function sortDays(d) {
  d = d || DATA;
  d.days.sort(function (a, b) { return b.s - a.s; });
  return d;
}

export function dayOf(s, d, create) {
  d = d || DATA;
  for (var i = 0; i < d.days.length; i++) if (d.days[i].s === s) return d.days[i];
  if (!create) return null;
  var nd = { s: s, items: [] };
  d.days.push(nd);
  sortDays(d);
  return nd;
}

export function addItem(o, d) {
  d = d || DATA;
  var it = { id: ++d.seq, cat: o.cat, title: o.title, acct: o.acct, amt: o.amt };
  if (o.transfer) it.transfer = true;
  if (o.demo)     it.demo = true;
  dayOf(o.s, d, true).items.unshift(it);              // terbaru di depan
  return it;
}

/* Hapus item; hari yang jadi kosong ikut dibuang supaya tidak ada hari hantu. */
export function removeItem(id, d) {
  d = d || DATA;
  var f = findItem(id, d);
  if (!f) return null;
  f.day.items.splice(f.ii, 1);
  if (!f.day.items.length) d.days.splice(f.di, 1);
  return f.it;
}

/* Ubah item. id DIPERTAHANKAN meski tanggal pindah hari — kalau id berubah,
   Urungkan dan referensi lain akan menunjuk item yang salah. */
export function updateItem(id, o, d) {
  d = d || DATA;
  var f = findItem(id, d);
  if (!f) return null;
  var wasDemo = f.it.demo === true;
  removeItem(id, d);
  var it = { id: id, cat: o.cat, title: o.title, acct: o.acct, amt: o.amt };
  if (o.transfer) it.transfer = true;
  if (wasDemo)    it.demo = true;
  dayOf(o.s, d, true).items.unshift(it);
  return it;
}

/* Semua aksi destruktif lewat sini: snapshot dulu, toast beraksi sesudah.
   Satu jalur berarti tidak ada aksi hapus yang lupa dipasangi Urungkan. */
export function withUndo(msg, fn) {
  var snap = snapshot();
  fn();
  save();
  render();
  toast(msg, {
    actionLabel: 'Urungkan',
    action: function () { restore(snap); toast('Dibatalkan'); }
  });
}
