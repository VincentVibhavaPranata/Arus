import { describe, expect, it } from 'vitest';
import { aiLoad, aiSave, checkKey, maskKey } from '../src/features/aiConfig.js';

describe('checkKey: menangkap salah tempel, tanpa menolak format key baru', () => {
  it('menerima key baru berawalan AQ. (mengandung titik)', () => {
    expect(checkKey('AQ.Ab8RN6K1x2y3z4A5b6C7d8E9f0G1h2I3j4K5l6M7n8O9p0Q').ok).toBe(true);
  });
  it('menerima key lama berawalan AIza', () => {
    expect(checkKey('AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q').ok).toBe(true);
  });
  it('merapikan spasi, baris baru, dan kutip di pinggir', () => {
    var r = checkKey('  "AQ.Ab8RN6K1x2y3z4A5b6C7d8E9f0G1h2"\n');
    expect(r.ok).toBe(true);
    expect(r.key).toBe('AQ.Ab8RN6K1x2y3z4A5b6C7d8E9f0G1h2');
  });
  it('menolak yang jelas salah, dengan alasan yang bisa dipahami', () => {
    expect(checkKey('').why).toMatch(/dulu/);
    expect(checkKey('pendek').why).toMatch(/pendek/);
    expect(checkKey('API key: AQ.Ab8RN6K1x2y3z4A5b6C7d8E9f0G1h2').why).toMatch(/spasi/);
    expect(checkKey('AQ.Ab8RN6K1x2y3z4A5b6C7d8E9f0G1h2$%^').why).toMatch(/karakter/);
  });
  it('key yang ditampilkan ulang hanya 4 karakter terakhir', () => {
    expect(maskKey('AQ.Ab8RN6K1x2y3z4A5b6C7d8E9f0G1h2')).toBe('••••G1h2');
  });
});

describe('pengaturan model tersimpan', () => {
  it('model lama yang dulu jadi bawaan dianggap "belum memilih"', () => {
    localStorage.setItem('arus-ai-v1', JSON.stringify({ on: true, key: 'x'.repeat(30), model: 'gemini-2.5-flash' }));
    expect(aiLoad().model).toBe('');
  });
  it('pilihan model sendiri dipertahankan', () => {
    aiSave({ model: 'gemini-3.8-flash' });
    expect(aiLoad().model).toBe('gemini-3.8-flash');
  });
});
