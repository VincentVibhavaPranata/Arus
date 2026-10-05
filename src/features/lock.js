import { LOCK_KEY } from '../core/constants.js';

/* =====================================================================
   KUNCI PIN.

   JUJUR SOAL APA INI: ini KUNCI LAYAR, bukan enkripsi. DATA tetap tersimpan
   apa adanya di localStorage. PIN menghalangi orang yang memegang HP-mu dan
   membuka app — tidak menghalangi siapa pun yang membuka devtools atau
   menyalin berkas profil browser. Kalimat itu ditulis juga di UI; kalau tidak,
   kunci ini justru memberi rasa aman palsu.

   Catatan kunci disimpan di key localStorage TERPISAH (arus-lock-v1), jadi
   secara struktur tak mungkin ikut terbawa ekspor atau sinkronisasi.
   ===================================================================== */
export var LOCK_ITER = 150000;

export var LOCK_FAIL_MAX = 5;

export var LOCK_COOLDOWN_MS = 30000;

export function lockLoad() {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); }
  catch (e) { return null; }
}

export function lockSave(o) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(o)); } catch (e) {}
}

export function lockClear() {
  try { localStorage.removeItem(LOCK_KEY); } catch (e) {}
}

export function lockEnabled() {
  var l = lockLoad();
  return !!(l && l.hash);
}

export function hasSubtle() {
  try { return !!(window.crypto && window.crypto.subtle && window.crypto.subtle.deriveBits); }
  catch (e) { return false; }
}

export function toHex(buf) {
  var a = new Uint8Array(buf), s = '';
  for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
  return s;
}

export function randHex(n) {
  var a = new Uint8Array(n);
  try {
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else throw 0;
  } catch (e) {
    for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return toHex(a.buffer || a);
}

/* Fallback saat crypto.subtle tidak ada (mis. konteks non-HTTPS lama).
   Jauh lebih lemah daripada PBKDF2 — makanya algonya dicatat dan ditampilkan
   apa adanya di layar pengaturan, bukan disembunyikan. */
export function simpleHash(str, iter) {
  var h1 = 0x811c9dc5, h2 = 0x1000193, i, c;
  for (var round = 0; round < iter; round++) {
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i) ^ (round & 0xff);
      h1 = (h1 ^ c) >>> 0;
      h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 + h1) >>> 0;
      h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
    }
    str = ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16));
  }
  return ('00000000' + (h1 >>> 0).toString(16)).slice(-8) +
         ('00000000' + (h2 >>> 0).toString(16)).slice(-8);
}

/* Selalu mengembalikan Promise supaya pemanggil punya satu jalur, apa pun
   algonya. */
export function lockDerive(pin, salt, algo, iter) {
  if (algo === 'pbkdf2') {
    if (!hasSubtle()) return Promise.reject(new Error(
      'PIN ini dibuat dengan PBKDF2, tapi lingkungan sekarang tidak mendukungnya.'));
    var enc = new TextEncoder();
    return window.crypto.subtle
      .importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (key) {
        return window.crypto.subtle.deriveBits({
          name: 'PBKDF2', salt: enc.encode(salt),
          iterations: iter || LOCK_ITER, hash: 'SHA-256'
        }, key, 256);
      })
      .then(toHex);
  }
  return Promise.resolve(simpleHash(pin + ':' + salt, Math.min(iter || 4000, 20000)));
}

/* Bandingkan seluruh panjang, tidak berhenti di perbedaan pertama. */
export function hashEq(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function lockSet(pin) {
  var algo = hasSubtle() ? 'pbkdf2' : 'simple';
  var iter = algo === 'pbkdf2' ? LOCK_ITER : 4000;
  var salt = randHex(16);
  return lockDerive(pin, salt, algo, iter).then(function (h) {
    lockSave({ v: 1, algo: algo, salt: salt, iter: iter, hash: h,
               len: String(pin).length, fails: 0, until: 0 });
    return algo;
  });
}

export function lockCooldownLeft(now) {
  var l = lockLoad();
  if (!l || !l.until) return 0;
  return Math.max(0, l.until - (now || Date.now()));
}

/* Hasil: {ok:true} | {ok:false, left:ms, fails:n} */
export function lockTry(pin, now) {
  now = now || Date.now();
  var l = lockLoad();
  if (!l || !l.hash) return Promise.resolve({ ok: true });
  var left = lockCooldownLeft(now);
  if (left > 0) return Promise.resolve({ ok: false, left: left, fails: l.fails || 0 });
  return lockDerive(pin, l.salt, l.algo, l.iter).then(function (h) {
    if (hashEq(h, l.hash)) {
      l.fails = 0; l.until = 0;
      lockSave(l);
      return { ok: true };
    }
    l.fails = (l.fails || 0) + 1;
    /* Cooldown IKUT TERSIMPAN — kalau cuma di memori, muat ulang halaman
       akan menghapusnya dan pembatasan jadi tak berarti. */
    if (l.fails >= LOCK_FAIL_MAX) { l.until = now + LOCK_COOLDOWN_MS; l.fails = 0; }
    lockSave(l);
    return { ok: false, left: lockCooldownLeft(now), fails: l.fails };
  });
}
