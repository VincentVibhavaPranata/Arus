import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/* Bukti yang bisa dijalankan: apa pun yang diimpor, yang keluar ke Google tidak memuat nama,
   nomor, nominal, atau tanggal. fetch di-tiru dan isi request-nya diperiksa mentah-mentah. */
var A, mod = {}, sent;
var KEY = 'AQ.Ab8RN6K1x2y3z4A5b6C7d8E9f0G1h2I3j4K5l6M7n8O9p0Q';

beforeAll(async () => {
  var html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body'), html.indexOf('<script')).replace(/^<body[^>]*>/, '');
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  window.scrollTo = () => {}; Element.prototype.scrollIntoView = () => {};
  await import('../src/main.js');
  A = window.Arus;
  mod.ai = await import('../src/features/aiCategorize.js');
  mod.staging = await import('../src/features/staging.js');
  mod.store = await import('../src/core/store.js');
});
beforeEach(() => {
  var d = mod.store.blankData(); d.onboarded = true; A.reset(d);
  localStorage.setItem('arus-ai-v1', JSON.stringify({ on: true, key: KEY, model: '' }));
  sent = [];
  globalThis.fetch = vi.fn(async (url, opt) => {
    sent.push({ url: String(url), body: String(opt && opt.body || '') });
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }) };
  });
});

function stage(csv) {
  A.DATA.staging = [];
  A.handleImportText(csv, false, 'BCA');
  return A.DATA.staging;
}

describe('impor BCA: judul dibersihkan, tapi AI hanya menerima keterangan asli yang DISAMARKAN', () => {
  var csv = 'Tanggal,Keterangan,Jumlah\n' +
    '02/10/2026,TRSF E-BANKING DB 0210/FTSCY/WS95031 SITI AMINAH 1234567890,-1500000\n' +
    '02/10/2026,SWITCHING DB TRANSFER KE 014 BUDI SANTOSO,-250000\n' +
    '02/10/2026,TOKO KELONTONG MAJU JAYA,-48000\n';

  it('baris impor membawa keterangan asli (desc), terpisah dari baris CSV utuh (raw) yang memuat nominal', () => {
    var r = stage(csv).find(x => /SITI/.test(x.desc));
    expect(r.desc).toMatch(/TRSF E-BANKING/);
    expect(r.desc).not.toMatch(/1500000|02\/10\/2026/);       // desc hanya teks keterangan
  });

  it('jalur PDF: judul dibersihkan jadi NAMA SAJA — yang dikirim tetap keterangan asli yang disamarkan', async () => {
    var { cleanBCADesc } = await import('../src/importers/bca.js');
    var ket = 'TRSF E-BANKING DB 0210/FTSCY/WS95031 SITI AMINAH';
    var r = mod.staging.mkStageRow({ src: 'bca-pdf', s: 20261002, title: cleanBCADesc(ket), raw: ket, desc: ket, amt: -150000, acct: 'BCA' });
    expect(r.title).toMatch(/SITI/);                 // inilah yang dulu bocor: tinggal nama, penanda transfer hilang
    expect(r.title).not.toMatch(/TRSF/);
    A.DATA.staging = [r];
    await mod.ai.aiFillStaging([r]);
    var all = sent.map(x => x.body).join('\n');
    expect(sent.length).toBe(1);
    expect(all).not.toMatch(/SITI|AMINAH|FTSCY|150000/);
    expect(all).toContain('TRSF E-BANKING DB [penerima]');
  });

  it('isi request ke Google tidak memuat nama, nomor rekening, nominal, atau tanggal', async () => {
    var rows = stage(csv);
    var out = await mod.ai.aiFillStaging(rows);
    var all = sent.map(s => s.url + ' ' + s.body).join('\n');
    expect(sent.length).toBeGreaterThan(0);
    expect(all).not.toMatch(/SITI|AMINAH|BUDI|SANTOSO|1234567890|FTSCY|WS95031/);   // nama & nomor
    expect(all).not.toMatch(/1500000|250000|48000|1\.500\.000/);                    // nominal
    expect(all).not.toMatch(/2026-10|02\/10\/2026|20261002/);                       // tanggal
    expect(all).toContain('[penerima]');                                            // transfer disamarkan
    expect(all).toContain('TOKO KELONTONG MAJU JAYA');                              // merchant biasa tetap terbaca
  });

  it('key dikirim lewat header, tidak muncul di URL maupun isi', async () => {
    await mod.ai.aiFillStaging(stage(csv));
    var calls = globalThis.fetch.mock.calls;
    expect(calls[0][1].headers['x-goog-api-key']).toBe(KEY);
    expect(sent[0].url).not.toContain(KEY);
    expect(sent[0].body).not.toContain(KEY);
  });
});

describe('pagar pengaman', () => {
  it('baris tanpa keterangan asli (mis. sisa impor versi lama) TIDAK dikirim sama sekali', async () => {
    var r = mod.staging.mkStageRow({ src: 'x', s: 20261002, title: 'SITI AMINAH', amt: -1000, acct: 'BCA' });
    A.DATA.staging = [r];
    await mod.ai.aiFillStaging([r]);
    expect(sent).toHaveLength(0);
  });
  it('AI mati = tidak ada satu pun request keluar saat impor', async () => {
    localStorage.setItem('arus-ai-v1', JSON.stringify({ on: false, key: KEY, model: '' }));
    await mod.ai.aiFillStaging(stage('Tanggal,Keterangan,Jumlah\n02/10/2026,TOKO XYZ,-1000\n'));
    expect(sent).toHaveLength(0);
  });
  it('nomor rekening di header e-statement tidak lagi dibaca atau disimpan', () => {
    var src = fs.readFileSync(path.resolve(process.cwd(), 'src/importers/bcaPdf.js'), 'utf8');
    expect(src).not.toMatch(/noRek/);
  });
});
