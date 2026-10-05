/* Server kecil untuk AI kategori. Satu tugas: terima daftar transaksi, tanya
   Gemini, kembalikan kategori. API key tinggal di .env di server — TIDAK PERNAH
   dikirim ke browser.

   Pengaman yang sudah ada di sini:
   - nominal/tanggal/akun tidak pernah diterima; teks disamarkan lagi di server
     (jangan percaya klien) lewat src/features/redact.js
   - Gemini dipaksa menjawab hanya salah satu kunci kategori (enum), dan jawaban
     divalidasi lagi — teks transaksi yang berisi "perintah" tidak bisa membuat
     model melakukan hal lain
   - batas per IP per menit + batas harian total (melindungi kuota/biaya)
   - ALLOWED_ORIGIN opsional: tolak permintaan dari situs lain
   - isi transaksi tidak pernah di-log, hanya jumlah baris

   Jalankan:  npm run server        (port 8789, di-proxy oleh `npm run dev`)
   Tanpa dependency: cuma Node 18+ (fetch bawaan). */
import http from 'node:http';
import fs from 'node:fs';
import { DEFAULT_MODEL, endpoint, parseResults, requestBody, safeModel } from '../src/features/aiShared.js';
import { redact } from '../src/features/redact.js';

/* .env sederhana: KEY=VALUE per baris */
try {
  for (const line of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* tidak ada .env: pakai environment biasa */ }

const PORT      = Number(process.env.PORT || 8789);
const KEY       = process.env.GEMINI_API_KEY || '';
const MODEL     = safeModel(process.env.GEMINI_MODEL || DEFAULT_MODEL);
const ORIGINS   = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const PER_MIN   = Number(process.env.AI_RATE_PER_MIN || 20);   // permintaan / IP / menit
const PER_DAY   = Number(process.env.AI_DAILY_LIMIT || 300);   // permintaan total / hari
const TRUST_PROXY = process.env.TRUST_PROXY === '1';            // baca X-Forwarded-For
const MAX_ITEMS = 60;      // satu panggilan = maksimal 60 baris
const MAX_CATS  = 40;
const MAX_BODY  = 100_000; // byte

function json(res, code, obj, extra) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((ok, no) => {
    let n = 0, chunks = [];
    req.on('data', c => { n += c.length; if (n > MAX_BODY) { no(new Error('terlalu besar')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', no);
  });
}

export async function categorize(items, cats, fetchFn = fetch, key = KEY) {
  const r = await fetchFn(endpoint(MODEL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(requestBody(items, cats))
  });
  if (!r.ok) throw new Error('Gemini ' + r.status);
  return parseResults(await r.json(), items, cats);
}

/* Pembatas laju sederhana di memori (cukup untuk satu proses). */
export function makeLimiter({ perMin = PER_MIN, perDay = PER_DAY, now = () => Date.now() } = {}) {
  const hits = new Map(); let day = '', total = 0;
  return function check(ip) {
    const t = now(), d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) { day = d; total = 0; }
    if (total >= perDay) return 'harian';
    const arr = (hits.get(ip) || []).filter(x => t - x < 60_000);
    if (arr.length >= perMin) { hits.set(ip, arr); return 'menit'; }
    arr.push(t); hits.set(ip, arr); total++;
    return null;
  };
}

export function makeServer({ fetchFn = fetch, key = KEY, origins = ORIGINS, limiter = makeLimiter() } = {}) {
  return http.createServer(async (req, res) => {
    if (req.url !== '/api/categorize') return json(res, 404, { error: 'tidak ada' });
    if (req.method !== 'POST') return json(res, 405, { error: 'pakai POST' });
    if (origins.length && !origins.includes(req.headers.origin || '')) return json(res, 403, { error: 'origin tidak diizinkan' });
    if (!key) return json(res, 503, { error: 'GEMINI_API_KEY belum diisi di .env' });
    const ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
    const lim = limiter(ip);
    if (lim) return json(res, 429, { error: 'batas ' + lim + ' tercapai, coba lagi nanti' }, { 'retry-after': lim === 'menit' ? '60' : '3600' });
    try {
      const b = JSON.parse(await readBody(req));
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, MAX_ITEMS)
        .map(i => ({ id: String(i.id).slice(0, 40), title: redact(i.title), out: !!i.out }));   // nominal sengaja diabaikan
      const cats = (Array.isArray(b.categories) ? b.categories : []).slice(0, MAX_CATS)
        .map(c => ({ k: String(c.k).slice(0, 40), label: String(c.label || c.k).slice(0, 40) }));
      if (!items.length || !cats.length) return json(res, 400, { error: 'items/categories kosong' });
      const results = await categorize(items, cats, fetchFn, key);
      console.log(`categorize: ${items.length} baris -> ${results.length} hasil`);   // tanpa isi transaksi
      json(res, 200, { results });
    } catch (e) {
      json(res, 502, { error: String(e.message || e) });
    }
  });
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  makeServer().listen(PORT, '127.0.0.1', () =>
    console.log(`AI kategori siap di 127.0.0.1:${PORT} (model ${MODEL}${KEY ? '' : ' — KEY BELUM DIISI'})`));
}
