/* Pengaturan AI = milik PERANGKAT ini, bukan milik data. Disimpan di key
   localStorage terpisah (seperti PIN), jadi tidak pernah ikut ekspor JSON,
   cadangan, atau sinkronisasi — pindah ke perangkat lain berarti mulai bersih
   dan AI mati. API key tidak pernah masuk ke DATA, URL, atau log. */
var AI_KEY = 'arus-ai-v1';

/* Mode server (proxy) hanya hidup kalau kamu menyalakannya saat build/dev:
   VITE_AI_SERVER=1 di .env. Untuk pengguna umum: pakai key sendiri. */
export var SERVER_MODE = !!(import.meta.env && import.meta.env.VITE_AI_SERVER === '1');

export function aiLoad() {
  var o = null;
  try { o = JSON.parse(localStorage.getItem(AI_KEY) || 'null'); } catch (e) {}
  o = o || {};
  return {
    on: !!o.on,
    key: typeof o.key === 'string' ? o.key : '',
    /* 'gemini-2.5-flash' dulu bawaan app dan ikut tersimpan lewat bug; modelnya kini bisa 404.
       Anggap itu 'belum memilih' supaya bawaan baru (alias -latest) yang dipakai. */
    model: typeof o.model === 'string' && o.model !== 'gemini-2.5-flash' ? o.model : ''
  };
}
export function aiSave(patch) {
  var c = aiLoad(), k;
  for (k in patch) c[k] = patch[k];
  try { localStorage.setItem(AI_KEY, JSON.stringify(c)); return true; } catch (e) { return false; }
}
/* Menghapus key sekaligus mematikan AI: izin selalu ikut hilang bersama kuncinya. */
export function aiClearKey() { aiSave({ key: '', on: false }); }

export function aiMode() { return aiLoad().key ? 'key' : (SERVER_MODE ? 'server' : 'none'); }
export function maskKey(k) { return k ? '••••' + String(k).slice(-4) : ''; }

/* Memeriksa key hasil tempel. SENGAJA longgar soal bentuk: Google sudah mengganti
   format key (AI Studio kini menerbitkan key berawalan "AQ." yang mengandung titik,
   sebelumnya "AIza..."), dan format key bukan kontrak — validasi yang sebenarnya
   adalah tombol "Tes koneksi". Di sini cuma menangkap salah tempel yang jelas.
   Mengembalikan { ok, key, why }; key sudah dirapikan (spasi/kutip pinggir dibuang). */
export function checkKey(raw) {
  var k = String(raw == null ? '' : raw).trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!k) return { ok: false, key: '', why: 'Tempel key-nya dulu.' };
  if (/\s/.test(k)) return { ok: false, key: k, why: 'Ada spasi atau baris baru di tengah. Salin hanya key-nya, tanpa teks lain.' };
  if (!/^[A-Za-z0-9._~-]+$/.test(k)) return { ok: false, key: k, why: 'Ada karakter yang tidak lazim di key. Salin ulang dari AI Studio.' };
  if (k.length < 20) return { ok: false, key: k, why: 'Key terlalu pendek, kelihatannya terpotong. Salin ulang seluruhnya.' };
  if (k.length > 300) return { ok: false, key: k, why: 'Terlalu panjang untuk sebuah API key. Pastikan yang disalin hanya key-nya.' };
  return { ok: true, key: k, why: '' };
}
