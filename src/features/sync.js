import { DATA, migrate, save, setData } from '../core/store.js';

/* =====================================================================
   SINKRONISASI.

   Satu dokumen JSON per user, dikunci optimis dengan nomor revisi.
   ATURAN KERAS: kalau server menolak dengan 409, klien TIDAK PERNAH
   menggabung sendiri. Dua versi ditampilkan dan KAMU yang memilih. Gabungan
   otomatis atas catatan uang adalah cara paling rapi untuk kehilangan
   transaksi tanpa sadar.

   Token disimpan di DATA.sync, tapi DIBUANG dari ekspor dan dari badan yang
   dikirim ke server — tak ada gunanya menyimpan kredensial di dalam cadangan.
   ===================================================================== */
export function syncCfg() {
  if (!DATA.sync) DATA.sync = { url: '', token: '', user: '', rev: 0, lastAt: 0 };
  return DATA.sync;
}

export function syncOn() {
  var s = syncCfg();
  return !!(s.url && s.token);
}

/* Dokumen yang dikirim ke server: DATA tanpa staging (itu keadaan kerja lokal)
   dan tanpa blok sync itu sendiri (token tidak boleh ikut naik). */
export function syncPayload(d) {
  d = d || DATA;
  var o = JSON.parse(JSON.stringify(d));
  delete o.sync;
  delete o.staging;
  return o;
}

export function syncUrl(pathX) {
  var base = String(syncCfg().url || '').replace(/\/+$/, '');
  return base + pathX;
}

export function syncFetch(pathX, opt) {
  opt = opt || {};
  var hdr = { 'content-type': 'application/json' };
  if (opt.auth !== false && syncCfg().token) hdr.authorization = 'Bearer ' + syncCfg().token;
  return fetch(syncUrl(pathX), {
    method: opt.method || 'GET',
    headers: hdr,
    body: opt.body ? JSON.stringify(opt.body) : undefined
  }).then(function (r) {
    return r.json()['catch'](function () { return {}; }).then(function (j) {
      return { status: r.status, ok: r.ok, body: j };
    });
  });
}

/* Kirim lokal -> server. Mengembalikan {ok} atau {conflict, rev, data}. */
export function syncPush(note) {
  var s = syncCfg();
  return syncFetch('/api/doc', {
    method: 'PUT', body: { rev: s.rev || 0, data: syncPayload(), note: note || null }
  }).then(function (r) {
    if (r.status === 409) {
      return { conflict: true, rev: r.body.rev, data: r.body.data, updated: r.body.updated };
    }
    if (!r.ok) throw new Error(r.body.error || 'Gagal mengirim (HTTP ' + r.status + ').');
    s.rev = r.body.rev;
    s.lastAt = Date.now();
    save();
    return { ok: true, rev: s.rev };
  });
}

/* Ambil server -> lokal. Dokumen server MENGGANTI lokal; pemanggil membungkus
   dengan withUndo supaya masih bisa dibatalkan. */
export function syncPull() {
  var s = syncCfg();
  return syncFetch('/api/doc').then(function (r) {
    if (!r.ok) throw new Error(r.body.error || 'Gagal mengambil (HTTP ' + r.status + ').');
    if (!r.body.data || !Array.isArray(r.body.data.days))
      throw new Error('Server belum punya dokumen yang sah.');
    return { rev: r.body.rev, data: r.body.data, updated: r.body.updated };
  });
}

/* Terapkan dokumen server ke lokal, pertahankan blok sync & staging lokal. */
export function syncApply(doc, rev) {
  var keepSync = JSON.parse(JSON.stringify(syncCfg()));
  var keepStaging = DATA.staging || [];
  var d = migrate(doc);
  d.sync = keepSync;
  d.sync.rev = rev;
  d.sync.lastAt = Date.now();
  d.staging = keepStaging;
  setData(d);
}
