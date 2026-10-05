import { describe, expect, it } from 'vitest';
import { redact } from '../src/features/redact.js';

describe('redact: yang HARUS dibuang sebelum teks keluar dari perangkat', () => {
  it('nama penerima transfer dan nomor rekening', () => {
    expect(redact('TRSF E-BANKING BUDI SANTOSO 8012345678')).toBe('TRSF E-BANKING [penerima]');
    expect(redact('TRSF E-BANKING DB 0210/FTSCY/WS95031 SITI AMINAH')).toBe('TRSF E-BANKING DB [penerima]');
    expect(redact('Transfer ke Andi Wijaya')).toBe('Transfer ke [penerima]');
    expect(redact('BI-FAST CR ANDI 081234567890')).toBe('BI-FAST CR [penerima]');
  });
  it('email, nomor panjang, dan kode referensi', () => {
    expect(redact('budi.santoso@gmail.com bayar kopi')).toBe('[email] bayar kopi');
    expect(redact('QRIS WARUNG PAK DE REF8F3A9C2B71D04E55')).toBe('QRIS WARUNG PAK DE [ref]');
    expect(redact('GOJEK 081234567890')).not.toMatch(/\d{6}/);
  });
});

describe('redact: penanda transfer boleh muncul di mana saja (bukan hanya di awal)', () => {
  it.each([
    ['SWITCHING DB TRANSFER KE 014 BUDI SANTOSO', 'SWITCHING DB TRANSFER KE [penerima]'],
    ['Ditransfer ke Rina Pratiwi', 'Ditransfer ke [penerima]'],
    ['BI FAST DB 123456789012 ANDI WIJAYA', 'BI FAST DB [penerima]'],
    ['KLIRING CR SITI AMINAH', 'KLIRING CR [penerima]']
  ])('%s', (input, expected) => {
    var out = redact(input);
    expect(out).toBe(expected);
    expect(out).not.toMatch(/BUDI|SANTOSO|Rina|Pratiwi|ANDI|WIJAYA|SITI|AMINAH|\d{6}/);
  });
});

describe('redact: yang HARUS tetap ada supaya kategori masih bisa ditebak', () => {
  it('nama merchant biasa tidak dirusak', () => {
    expect(redact('Kopi Kenangan')).toBe('Kopi Kenangan');
    expect(redact('INDOMARET SENAYAN 0302')).toBe('INDOMARET SENAYAN 0302');
    expect(redact('Tarik tunai ATM BCA')).toBe('Tarik tunai ATM BCA');
  });
  it('dipotong 80 karakter', () => {
    expect(redact('A '.repeat(100)).length).toBeLessThanOrEqual(80);
  });
});
