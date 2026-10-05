import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, buildPrompt, checkModel, endpoint, normalizeModel, parseResults, pickModels, requestBody, safeModel } from '../src/features/aiShared.js';

var cats = [{ k: 'makan', label: 'Makan' }, { k: 'lain', label: 'Lain' }];
var items = [{ id: 'a', title: 'WARUNG', out: true }, { id: 'b', title: 'X', out: false }];
var wrap = (txt) => ({ candidates: [{ content: { parts: [{ text: txt }] } }] });

describe('permintaan ke Gemini', () => {
  it('jawaban dipaksa salah satu kunci kategori (enum)', () => {
    var e = requestBody(items, cats).generationConfig.responseSchema.items.properties.cat.enum;
    expect(e).toEqual(['makan', 'lain']);
  });
  it('prompt menandai teks transaksi sebagai data, bukan perintah', () => {
    expect(buildPrompt(items, cats)).toMatch(/DATA dari pihak luar/);
  });
  it('nama model tidak bisa menyelipkan path lain ke URL', () => {
    expect(safeModel('../../evil')).toBe(DEFAULT_MODEL);
    expect(safeModel('gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(endpoint('a/b')).toBe(endpoint(DEFAULT_MODEL));
  });
});

describe('validasi jawaban (jangan percaya model mentah-mentah)', () => {
  it('membuang id asing dan kategori di luar daftar', () => {
    var out = parseResults(wrap('[{"id":"a","cat":"makan"},{"id":"zzz","cat":"makan"},{"id":"b","cat":"HACK"}]'), items, cats);
    expect(out).toEqual([{ id: 'a', cat: 'makan' }]);
  });
  it('menerima jawaban berpagar ```json', () => {
    expect(parseResults(wrap('```json\n[{"id":"a","cat":"lain"}]\n```'), items, cats)).toHaveLength(1);
  });
  it('jawaban kosong atau bukan larik = tidak ada hasil, bukan error', () => {
    expect(parseResults({}, items, cats)).toEqual([]);
    expect(parseResults(wrap('{"id":"a","cat":"makan"}'), items, cats)).toEqual([]);
  });
});

describe('nama model', () => {
  it('merapikan hasil ketik: awalan models/, huruf besar, spasi', () => {
    expect(normalizeModel('models/Gemini-3.8-Flash')).toBe('gemini-3.8-flash');
    expect(normalizeModel('Gemini 3 Flash')).toBe('gemini-3-flash');
  });
  it('yang tidak valid DITOLAK dengan alasan, tidak diam-diam diganti bawaan', () => {
    var c = checkModel('gemini/../../x$');
    expect(c.ok).toBe(false);
    expect(c.why).toMatch(/tidak valid/);
  });
  it('kosong = pakai bawaan, dan bawaan tidak memakai nama model yang sudah dipensiunkan', () => {
    expect(checkModel('  ')).toEqual({ ok: true, model: '', why: '' });
    expect(DEFAULT_MODEL).toMatch(/latest/);
  });
  it('permintaan tidak mengirim parameter sampling yang sudah deprecated', () => {
    expect(JSON.stringify(requestBody(items, cats))).not.toMatch(/temperature|topP|topK/i);
  });
});

describe('daftar model dari Google', () => {
  var data = { models: [
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-3-pro-image-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/imagen-4', supportedGenerationMethods: ['predict'] }
  ] };
  it('hanya model teks yang bisa generateContent, alias latest dan Flash di depan', () => {
    expect(pickModels(data)).toEqual(['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  });
  it('respons kosong tidak melempar error', () => {
    expect(pickModels({})).toEqual([]);
  });
});
