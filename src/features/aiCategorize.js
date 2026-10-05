import { catsByKind } from '../core/categories.js';
import { DATA, save } from '../core/store.js';
import { aiLoad, aiMode } from './aiConfig.js';
import { DEFAULT_MODEL, endpoint, listEndpoint, parseResults, pickModels, requestBody } from './aiShared.js';
import { isUnsure } from './categorize.js';
import { redact } from './redact.js';

/* Kategori lewat AI (Gemini). Aturan mainnya:
     1. Hanya jalan kalau pengguna menyalakannya DAN ada jalur yang siap
        (key sendiri, atau server kalau mode server hidup).
     2. Keputusanmu (catRules) dan daftar merchant selalu menang — AI hanya
        dipanggil untuk baris yang kedua-duanya tidak kenal.
     3. AI cuma boleh memilih dari kategorimu sendiri (termasuk yang kamu buat).
     4. Kalau gagal/lambat, impor jalan terus seperti biasa.
     5. Hasil AI tidak pernah mengubah baris yang sudah kamu ubah sendiri.
   Yang keluar dari perangkat: teks yang sudah disamarkan + arah masuk/keluar.
   Tanpa nominal, tanggal, saldo, atau nama akun. */

var BATCH = 40;

export function aiEnabled() { return aiLoad().on && aiMode() !== 'none'; }

function cats() {
  return catsByKind('out').concat(catsByKind('in')).map(function (c) { return { k: c.k, label: c.label }; });
}

/* Baris yang layak ditanyakan ke AI. */
export function needsAI(r) {
  /* r.desc = teks keterangan ASLI (bukan judul yang sudah dibersihkan, bukan baris CSV utuh).
     Tanpa itu, penyamaran tidak bisa mengenali pola transfer, jadi baris itu tidak dikirim. */
  return aiEnabled() && !r.tfAcct && !r.aiDone && !!r.desc && isUnsure(r.title, r.amt);
}

function explain(status, model) {
  if (status === 400) return 'API key ditolak atau permintaan salah';
  if (status === 401 || status === 403) return 'API key ditolak Google — pastikan disalin utuh dan masih aktif di AI Studio';
  if (status === 404) return 'model "' + (model || DEFAULT_MODEL) + '" tidak ditemukan atau sudah dipensiunkan — buka Lanjutan, klik "Cek model yang tersedia"';
  if (status === 429) return 'kuota habis, coba lagi nanti';
  if (status >= 500) return 'layanan Google sedang bermasalah';
  return 'HTTP ' + status;
}

async function ask(rows) {
  var cfg = aiLoad(), mode = aiMode(), cs = cats();
  var items = rows.map(function (r) { return { id: r.sid, title: redact(r.desc), out: r.amt < 0 }; });
  var ctl = new AbortController();
  var t = setTimeout(function () { ctl.abort(); }, 20000);
  try {
    var res;
    if (mode === 'key') {
      /* Langsung dari browser ke Google. Key lewat header, bukan URL. */
      res = await fetch(endpoint(cfg.model), {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
        body: JSON.stringify(requestBody(items, cs))
      });
      if (!res.ok) throw new Error(explain(res.status, cfg.model));
      return parseResults(await res.json(), items, cs);
    }
    res = await fetch('/api/categorize', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categories: cs, items: items })
    });
    if (!res.ok) {
      var msg = ''; try { msg = (await res.json()).error; } catch (e) {}
      throw new Error(msg || ('HTTP ' + res.status));
    }
    return (await res.json()).results || [];
  } catch (e) {
    /* fetch gagal sebelum ada jawaban: offline, diblokir, atau CORS */
    if (e && e.name === 'TypeError') throw new Error('browser tidak bisa menjangkau layanan AI (koneksi atau CORS)');
    throw e;
  } finally { clearTimeout(t); }
}

/* Uji koneksi dengan satu contoh tetap — tidak memakai catatan apa pun milikmu. */
export async function aiTest() {
  try {
    await ask([{ sid: 't1', title: 'INDOMARET', amt: -1 }]);
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: e.name === 'AbortError' ? 'terlalu lama menjawab' : e.message };
  }
}

/* Isi kategori baris staging. Mengembalikan { n, err } — n = jumlah baris yang
   benar-benar diisi AI. Tidak pernah melempar error. */
export async function aiFillStaging(rows) {
  var todo = rows.filter(needsAI), n = 0, err = '';
  for (var i = 0; i < todo.length; i += BATCH) {
    var chunk = todo.slice(i, i + BATCH);
    try {
      var out = await ask(chunk);
      var by = {}; out.forEach(function (o) { by[o.id] = o.cat; });
      for (var j = 0; j < chunk.length; j++) {
        var r = chunk[j], c = by[r.sid];
        r.aiDone = true;
        /* hanya kalau baris masih ada di staging dan belum diubah pengguna */
        if (!c || DATA.staging.indexOf(r) < 0 || r.catTouched) continue;
        if (r.cat !== c) { r.cat = c; r.aiCat = true; n++; }   // restage() menimpa r.hint, jadi pakai penanda sendiri
      }
    } catch (e) { err = e.name === 'AbortError' ? 'AI terlalu lama menjawab' : e.message; break; }
  }
  if (n) save();
  return { n: n, err: err };
}

/* Tanya Google model apa saja yang boleh dipakai key ini (lebih andal daripada menebak nama). */
export async function aiListModels() {
  var cfg = aiLoad();
  if (!cfg.key) return { ok: false, msg: 'Belum ada key' };
  var ctl = new AbortController();
  var t = setTimeout(function () { ctl.abort(); }, 15000);
  try {
    var res = await fetch(listEndpoint(), { headers: { 'x-goog-api-key': cfg.key }, signal: ctl.signal });
    if (!res.ok) return { ok: false, msg: explain(res.status, cfg.model) };
    var ids = pickModels(await res.json());
    return ids.length ? { ok: true, ids: ids }
      : { ok: false, msg: 'Tidak ada model Gemini teks yang tersedia untuk key ini' };
  } catch (e) {
    return { ok: false, msg: e.name === 'AbortError' ? 'terlalu lama menjawab'
      : e.name === 'TypeError' ? 'browser tidak bisa menjangkau layanan AI (koneksi atau CORS)' : e.message };
  } finally { clearTimeout(t); }
}
