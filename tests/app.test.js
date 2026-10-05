import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/* Smoke test: seluruh app dimuat di jsdom, lalu setiap halaman dan form dibuka.
   Menangkap hal paling sering rusak setelah refactor: impor yang salah, fungsi
   yang hilang, atau render yang melempar error. */
var A;
beforeAll(async () => {
  var html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body'), html.indexOf('<script')).replace(/^<body[^>]*>/, '');
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  await import('../src/main.js');
  A = window.Arus;
  var d = A.seedDemo(); d.onboarded = true; A.reset(d);
  document.getElementById('onboarding')?.remove();
});

describe('halaman', () => {
  it.each(['dasbor', 'transaksi', 'akun', 'lainnya', 'impor', 'trading'])('%s tampil', (tab) => {
    A.go(tab);
    expect(document.getElementById('main').children.length).toBeGreaterThan(0);
  });
  it('dasbor punya pita komposisi pengeluaran', () => {
    A.go('dasbor');
    expect(document.querySelectorAll('.ribbon i').length).toBeGreaterThan(0);
  });
});

describe('form dan dialog', () => {
  it.each(['sheetTx', 'sheetCats', 'sheetGoal', 'sheetRecurring', 'sheetBackup', 'sheetSync', 'sheetLock',
           'sheetAudit', 'sheetReset', 'sheetHistory', 'sheetPaste', 'sheetFolio', 'sheetTrade', 'sheetAcctStart', 'sheetAi'])(
    '%s terbuka tanpa error', (name) => {
      A.go('dasbor');
      expect(() => A[name]()).not.toThrow();
      A.closeSheet(true);
    });
});

describe('kategori AI: izin & kunci milik perangkat', () => {
  it('data tidak pernah membawa izin atau key AI', () => {
    localStorage.setItem('arus-ai-v1', JSON.stringify({ on: true, key: 'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q', model: '' }));
    expect(JSON.stringify(A.DATA)).not.toMatch(/AIza|"ai"/);
  });
  it('baris yang sudah dikenal aturan/merchant tidak dikirim ke AI', () => {
    expect(A.guessCat('INDOMARET POINT', -12000)).toBe('belanja');
  });
});
