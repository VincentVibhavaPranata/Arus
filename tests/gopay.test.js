import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makePages } from './fixtures/gopayPages.js';

var A, mod = {};
beforeAll(async () => {
  var html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body'), html.indexOf('<script')).replace(/^<body[^>]*>/, '');
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  window.scrollTo = () => {}; Element.prototype.scrollIntoView = () => {};
  await import('../src/main.js');
  A = window.Arus;
  mod.gopay = await import('../src/importers/gopayPdf.js');
  mod.store = await import('../src/core/store.js');
  mod.staging = await import('../src/features/staging.js');
  mod.derived = await import('../src/core/derived.js');
  mod.networth = await import('../src/core/networth.js');
  mod.nav = await import('../src/ui/nav.js');
  mod.tf = await import('../src/core/transfer.js');
});
beforeEach(() => {
  var d = mod.store.blankData(); d.onboarded = true; A.reset(d);   // bersih, tanpa data contoh
});

describe('mengenali e-statement GoPay', () => {
  it('format GoPay dikenali; halaman lain tidak', () => {
    expect(mod.gopay.isGoPayPdf(makePages())).toBe(true);
    expect(mod.gopay.isGoPayPdf([{ lines: [{ y: 1, cols: [{ x: 1, s: 'MUTASI REKENING' }], text: '' }] }])).toBe(false);
  });
});

describe('pemetaan baris', () => {
  it('Tabungan -> GoPay, GoPay Later -> akun Later, Coins dilewati', () => {
    var rows = mod.gopay.parseGoPayPdf(makePages());
    expect(rows.skipped.coins).toBe(2);
    expect(rows).toHaveLength(7);
    var by = (t) => rows.find(r => r.title.indexOf(t) === 0);
    expect(by('Warung Contoh Satu').acct).toBe('GoPay');
    expect(by('Toko Online Contoh').acct).toBe('GoPay Later');
    expect(by('Toko Online Contoh').amt).toBe(-60000);
  });
  it('pembayaran campuran dicatat penuh di metode non-Coins; judul 2 baris disambung', () => {
    var r = mod.gopay.parseGoPayPdf(makePages()).find(x => /Kedai Mix/.test(x.title));
    expect(r.title).toBe('Kedai Mix Pembayaran, Cabang Dua');
    expect(r.acct).toBe('GoPay Later');
    expect(r.amt).toBe(-40000);
    expect(r.raw).toBe('0420260929XXXX2222yyzzEEID');   // ID yang terpotong dua baris disambung
  });
  it('tanggal dan arah yang benar', () => {
    var r = mod.gopay.parseGoPayPdf(makePages()).find(x => x.title === 'Warung Contoh Satu');
    expect(r.s).toBe(20260930);
    expect(r.amt).toBeLessThan(0);
  });
  it('bunga = pemasukan, pajak atas bunga = pengeluaran', () => {
    var rows = mod.gopay.parseGoPayPdf(makePages());
    expect(rows.find(r => /Bunga/.test(r.title)).amt).toBe(20);
    expect(rows.find(r => r.title === 'Pajak atas bunga').amt).toBe(-4);
  });
  it('GoTagihan = pembayaran tagihan GoPay Later (transfer GoPay -> Later)', () => {
    var r = mod.gopay.parseGoPayPdf(makePages()).find(x => /GoTagihan/.test(x.title));
    expect(r.tfAcct).toBe(mod.tf.mkTfAcct('GoPay', 'GoPay Later'));
    expect(r.amt).toBe(-300000);
  });
});

describe('rekonsiliasi dengan total di header', () => {
  it('cocok: pemasukan persis, pengeluaran = total keluar - Coins yang dipakai', () => {
    var r = mod.gopay.parseGoPayPdf(makePages()).recon;
    expect(r.cocok).toBe(true);
    expect(r.pemasukan).toBe(100020);
    expect(r.pengeluaran - r.coinsUsed).toBe(424964);
  });
  it('tidak cocok kalau ada yang salah baca', () => {
    var r = mod.gopay.parseGoPayPdf(makePages({ totals: { pengeluaran: 'Rp999.999' } })).recon;
    expect(r.cocok).toBe(false);
    expect(r.selisih).toBeGreaterThan(0);
  });
});

describe('top up: dicocokkan dengan transfer BCA yang sudah ada', () => {
  var tfKey = () => mod.tf.mkTfAcct('BCA', 'GoPay');
  it('tanpa pasangan di catatan BCA: ditandai cek dan tidak tercentang (tidak dobel)', () => {
    var rows = mod.gopay.parseGoPayPdf(makePages());
    mod.staging.restage(rows);
    var t = rows.find(r => r.title === 'GoPay Tabungan top up');
    expect(t.tfAcct).toBe(tfKey());
    expect(t.state).toBe('check');
    expect(t.sel).toBe(false);
  });
  it('dengan pasangan BCA (selisih sehari): otomatis dianggap duplikat', () => {
    mod.store.addItem({ s: 20260928, cat: 'transfer', title: 'TOPUP GOPAY', acct: tfKey(), amt: -100000, transfer: true });
    var rows = mod.gopay.parseGoPayPdf(makePages());
    mod.staging.restage(rows);
    var t = rows.find(r => r.title === 'GoPay Tabungan top up');
    expect(t.state).toBe('dup');
    expect(t.sel).toBe(false);
  });
  it('pasangan di luar jendela 2 hari tidak dicocokkan', () => {
    mod.store.addItem({ s: 20260901, cat: 'transfer', title: 'TOPUP GOPAY', acct: tfKey(), amt: -100000, transfer: true });
    var rows = mod.gopay.parseGoPayPdf(makePages());
    mod.staging.restage(rows);
    expect(rows.find(r => r.title === 'GoPay Tabungan top up').state).toBe('check');
  });
});

describe('akibat ke saldo (alur lengkap: tinjau -> catat)', () => {
  it('belanja Tabungan mengurangi GoPay; belanja Later menambah utang, bukan mengurangi GoPay', () => {
    var rows = mod.gopay.parseGoPayPdf(makePages());
    var before = mod.derived.acctBalances();
    mod.store.DATA.staging = rows;
    mod.staging.restage(mod.store.DATA.staging);
    mod.store.DATA.staging.forEach(r => { r.sel = true; r.selAuto = false; });
    // top up tanpa pasangan ikut dicentang di tes ini; yang diuji adalah hitungan saldo
    mod.staging.commitStaging();
    var after = mod.derived.acctBalances();
    // GoPay: -25.000 (warung) -4 (pajak) +20 (bunga) -300.000 (bayar Later) +100.000 (top up, kaki tujuan)
    expect(after['GoPay'] - before['GoPay']).toBe(-25000 - 4 + 20 - 300000 + 100000);
    // Later: -40.000 -60.000 (belanja) +300.000 (bayar tagihan)
    expect(after['GoPay Later'] - before['GoPay Later']).toBe(-40000 - 60000 + 300000);
  });
});

describe('akun GoPay Later = utang, bukan kas', () => {
  it('saldo minus masuk ke Utang dan tidak ke Kas & Setara', () => {
    mod.store.DATA.acctStart['GoPay Later'] = -500000;
    expect(mod.networth.acctDebtTotal()).toBe(500000);
    expect(mod.networth.liabTotal()).toBe(500000);
    expect(mod.networth.classRows('cash').map(r => r.name)).not.toContain('GoPay Later');
  });
  it('kekayaan bersih sama seperti kalau dihitung sebagai saldo minus', () => {
    mod.store.DATA.acctStart['GoPay'] = 1000000;
    mod.store.DATA.acctStart['GoPay Later'] = -300000;
    expect(mod.networth.networthTotal()).toBe(700000);
  });
  it('saldo Later positif (kelebihan bayar) dihitung sebagai kas, bukan utang negatif', () => {
    mod.store.DATA.acctStart['GoPay Later'] = 50000;
    expect(mod.networth.liabTotal()).toBe(0);
    expect(mod.networth.classRows('cash').map(r => r.name)).toContain('GoPay Later');
  });
  it('monogram: GL untuk GoPay Later, tidak bentrok dengan GoPay', () => {
    expect(mod.nav.monogram('GoPay Later')).toBe('GL');
    expect(mod.nav.monogram('GoPay')).toBe('GP');
    expect(mod.nav.monogram('Kas & Setara')).toBe('KS');
    expect(mod.nav.monogram('BCA')).toBe('BC');
  });
  it('form saldo awal: utang awal diisi positif, disimpan sebagai saldo minus', () => {
    A.sheetAcctStart();
    var inp = document.querySelector('.arow[data-acct="GoPay Later"] input');
    inp.value = '1457346'; inp.dispatchEvent(new Event('input'));
    document.getElementById('start-save').click();
    expect(mod.store.DATA.acctStart['GoPay Later']).toBe(-1457346);
    expect(mod.networth.liabTotal()).toBe(1457346);
  });
});
