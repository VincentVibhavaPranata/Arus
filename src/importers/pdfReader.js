/* =====================================================================
   PEMBACA PDF — untuk e-statement BCA.

   Ditulis setelah membedah berkas e-statement sungguhan, bukan menebak.
   Yang harus ditangani berkas itu:
     - terenkripsi AES-256 (V5/R5) dengan sandi pengguna KOSONG
     - object stream (/ObjStm) + xref stream, jadi objeknya tidak kelihatan
       di berkas mentah
     - stream ter-FlateDecode
     - tiap potong teks dibungkus BT…ET sendiri, dan BT MERESET matriks teks
       (kalau Td ditumpuk tanpa reset, seluruh tata letak jadi kacau)
     - halaman A4 tegak, kolom dikenali dari koordinat x

   Berkasnya TIDAK PERNAH meninggalkan perangkat. Semua diproses di sini.
   ===================================================================== */
export function u8ToLatin1(u8) {
  var s = '', CH = 0x8000;
  for (var i = 0; i < u8.length; i += CH)
    s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return s;
}

export function latin1ToU8(s) {
  var a = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff;
  return a;
}

/* FlateDecode. DecompressionStream ada di Chrome modern; kalau tidak ada,
   katakan terus terang alih-alih diam-diam menghasilkan halaman kosong. */
export function pdfInflate(u8) {
  if (typeof DecompressionStream !== 'function')
    return Promise.reject(new Error('Peramban ini tidak bisa membuka kompresi PDF.'));
  var ds = new DecompressionStream('deflate');
  var w = ds.writable.getWriter();
  w.write(u8);
  w.close();
  var rd = ds.readable.getReader(), parts = [], total = 0;
  function pump() {
    return rd.read().then(function (r) {
      if (r.done) {
        var out = new Uint8Array(total), off = 0;
        for (var i = 0; i < parts.length; i++) { out.set(parts[i], off); off += parts[i].length; }
        return out;
      }
      parts.push(r.value);
      total += r.value.length;
      return pump();
    });
  }
  return pump();
}

/* Baca string literal PDF "( … )" sebagai BYTE, hormati escape oktal. */
export function pdfLitBytes(s, from) {
  var out = [], depth = 1, j = from;
  while (j < s.length) {
    var ch = s[j];
    if (ch === '\\') {
      var n = s[j + 1];
      var M = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
      if (n in M) { out.push(M[n]); j += 2; continue; }
      if (n >= '0' && n <= '7') {
        var o = '', k = j + 1;
        while (k < j + 4 && s[k] >= '0' && s[k] <= '7') { o += s[k]; k++; }
        out.push(parseInt(o, 8) & 0xff);
        j = k;
        continue;
      }
      j += 2;
      continue;
    }
    if (ch === '(') { depth++; out.push(40); j++; continue; }
    if (ch === ')') { depth--; if (!depth) break; out.push(41); j++; continue; }
    out.push(s.charCodeAt(j) & 0xff);
    j++;
  }
  return new Uint8Array(out);
}

export function pdfFindLit(s, key) {
  var i = s.indexOf(key);
  if (i < 0) return null;
  var j = s.indexOf('(', i);
  if (j < 0 || j > i + 12) return null;
  return pdfLitBytes(s, j + 1);
}

export function sha256(u8) {
  return window.crypto.subtle.digest('SHA-256', u8).then(function (b) { return new Uint8Array(b); });
}

export function cat() {
  var n = 0, i;
  for (i = 0; i < arguments.length; i++) n += arguments[i].length;
  var out = new Uint8Array(n), off = 0;
  for (i = 0; i < arguments.length; i++) { out.set(arguments[i], off); off += arguments[i].length; }
  return out;
}

/* AES-CBC tanpa padding lewat WebCrypto.
   Triknya: menambahkan satu blok E(K, IV=blok terakhir, pesan kosong) membuat
   hasil dekripsi punya padding PKCS#7 yang sah, sehingga subtle mau membukanya
   tanpa kita perlu menulis AES sendiri. */
export function aesCbcNoPad(keyBytes, iv, data) {
  var subtle = window.crypto.subtle;
  return subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt', 'decrypt'])
    .then(function (key) {
      var lastBlock = data.length >= 16 ? data.subarray(data.length - 16) : iv;
      return subtle.encrypt({ name: 'AES-CBC', iv: lastBlock }, key, new Uint8Array(0))
        .then(function (pad) {
          return subtle.decrypt({ name: 'AES-CBC', iv: iv }, key,
            cat(data, new Uint8Array(pad)));
        })
        .then(function (b) { return new Uint8Array(b); });
    });
}

export function aesCbcPadded(keyBytes, iv, data) {
  return window.crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt'])
    .then(function (key) {
      return window.crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, data);
    })
    .then(function (b) { return new Uint8Array(b); });
}

/* Siapkan pembuka enkripsi. Mendukung /V 5 (AESV3, R5 & R6) — itu yang dipakai
   e-statement BCA. Skema lama (RC4 / AES-128) DITOLAK dengan pesan jelas,
   bukan gagal diam-diam. */
export function pdfCrypto(s, pass) {
  if (s.indexOf('/Encrypt') < 0) return Promise.resolve(null);
  var ei = s.indexOf('/Filter/Standard');
  if (ei < 0) ei = s.indexOf('/Filter /Standard');
  if (ei < 0) return Promise.reject(new Error('PDF terenkripsi dengan cara yang tidak dikenali.'));
  var head = s.slice(Math.max(0, ei - 1400), ei + 1400);
  var V = (head.match(/\/V\s+(\d+)/) || [])[1];
  var Rv = (head.match(/\/R\s+(\d+)/) || [])[1];
  if (String(V) !== '5')
    return Promise.reject(new Error(
      'PDF ini memakai enkripsi lama (V' + V + ') yang belum didukung. ' +
      'Buka di pembaca PDF lalu simpan/cetak ulang tanpa sandi.'));
  var U = pdfFindLit(head, '/U'), UE = pdfFindLit(head, '/UE');
  if (!U || U.length < 48 || !UE)
    return Promise.reject(new Error('Data enkripsi PDF tidak lengkap.'));
  var pw = latin1ToU8(String(pass == null ? '' : pass));
  var vsalt = U.subarray(32, 40), ksalt = U.subarray(40, 48);

  /* R5 = SHA-256 sekali. R6 = algoritma 2.B yang berulang. */
  function hash2B(input, salt) {
    if (String(Rv) === '5') return sha256(cat(input, salt));
    return sha256(cat(input, salt)).then(function (k0) {
      var i = 0;
      function round(K) {
        var K1parts = [];
        for (var n = 0; n < 64; n++) K1parts.push(cat(input, K));
        var K1 = cat.apply(null, K1parts);
        return window.crypto.subtle
          .importKey('raw', K.subarray(0, 16), 'AES-CBC', false, ['encrypt'])
          .then(function (key) {
            return window.crypto.subtle.encrypt(
              { name: 'AES-CBC', iv: K.subarray(16, 32) }, key, K1);
          })
          .then(function (E) {
            var e = new Uint8Array(E).subarray(0, K1.length);   /* buang blok padding */
            var mod = 0;
            for (var q = 0; q < 16; q++) mod += e[q];
            mod %= 3;
            var algo = mod === 0 ? 'SHA-256' : mod === 1 ? 'SHA-384' : 'SHA-512';
            return window.crypto.subtle.digest(algo, e).then(function (h) {
              var K2 = new Uint8Array(h);
              i++;
              if (i < 64 || e[e.length - 1] > i - 32) return round(K2);
              return K2.subarray(0, 32);
            });
          });
      }
      return round(k0);
    });
  }
  return hash2B(pw, vsalt).then(function (chk) {
    for (var i = 0; i < 32; i++)
      if (chk[i] !== U[i])
        return Promise.reject(new Error('Sandi PDF salah.'));
    return hash2B(pw, ksalt).then(function (ik) {
      return aesCbcNoPad(ik, new Uint8Array(16), UE).then(function (fileKey) {
        var key = fileKey.subarray(0, 32);
        return {
          decrypt: function (bytes) {
            if (bytes.length <= 16) return Promise.resolve(new Uint8Array(0));
            return aesCbcPadded(key, bytes.subarray(0, 16), bytes.subarray(16));
          }
        };
      });
    });
  });
}

/* Pindai objek langsung dari berkas. Lebih tahan banting daripada mengikuti
   xref: berkas dengan xref rusak pun tetap terbaca. */
export function pdfScanObjects(s, bytes) {
  var objs = {}, re = /(\d+)\s+0\s+obj/g, m;
  while ((m = re.exec(s))) {
    var num = +m[1], hs = m.index + m[0].length;
    var si = s.indexOf('stream', hs), eo = s.indexOf('endobj', hs);
    if (si < 0 || (eo >= 0 && si > eo)) { objs[num] = { dict: s.slice(hs, eo < 0 ? hs + 900 : eo) }; continue; }
    var dict = s.slice(hs, si), lm = dict.match(/\/Length\s+(\d+)/);
    var ds = si + 6;
    if (s[ds] === '\r') ds++;
    if (s[ds] === '\n') ds++;
    var len = lm ? +lm[1] : Math.max(0, s.indexOf('endstream', ds) - ds);
    objs[num] = { dict: dict, raw: bytes.subarray(ds, ds + len) };
  }
  return objs;
}

/* Buka isi stream: dekripsi (kalau perlu) lalu inflate. */
export function pdfStream(o, crypt) {
  if (!o.raw) return Promise.resolve(null);
  var isXref = /\/Type\s*\/XRef/.test(o.dict);      /* xref stream tak pernah dienkripsi */
  var step = (crypt && !isXref) ? crypt.decrypt(o.raw) : Promise.resolve(o.raw);
  return step.then(function (b) {
    if (/FlateDecode/.test(o.dict)) return pdfInflate(b);
    return b;
  })['catch'](function () { return null; });
}

/* Susun daftar item teks berposisi dari sebuah content stream. */
export function pdfTextItems(t) {
  var out = [], x = 0, y = 0, lx = 0, ly = 0, tl = 0;
  var RE = /\bBT\b|(-?[\d.]+)\s+(-?[\d.]+)\s+(Td|TD)\b|(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm\b|\bT\*|(-?[\d.]+)\s+TL\b|\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\][]|\\.)*)\]\s*TJ/g;
  var m;
  function unesc(v) {
    return v.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, function (a, b) {
      var M = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      return b in M ? M[b] : String.fromCharCode(parseInt(b, 8));
    });
  }
  while ((m = RE.exec(t))) {
    if (m[0] === 'BT') { x = y = lx = ly = 0; continue; }   /* BT MERESET — ini kuncinya */
    if (m[3]) { lx += +m[1]; ly += +m[2]; x = lx; y = ly; if (m[3] === 'TD') tl = -(+m[2]); continue; }
    if (m[4] !== undefined) { lx = +m[8]; ly = +m[9]; x = lx; y = ly; continue; }
    if (m[0] === 'T*') { ly -= tl; x = lx; y = ly; continue; }
    if (m[10] !== undefined) { tl = +m[10]; continue; }
    if (m[11] !== undefined) { out.push({ x: x, y: y, s: unesc(m[11]) }); continue; }
    if (m[12] !== undefined) {
      var acc = '', r2 = /\(((?:[^()\\]|\\.)*)\)/g, q;
      while ((q = r2.exec(m[12]))) acc += unesc(q[1]);
      out.push({ x: x, y: y, s: acc });
    }
  }
  return out;
}

/* PDF -> daftar baris per halaman, tiap baris membawa kolom berkoordinat. */
export function pdfLines(bytes, pass) {
  var s = u8ToLatin1(bytes);
  if (s.slice(0, 5) !== '%PDF-') return Promise.reject(new Error('Ini bukan berkas PDF.'));
  return pdfCrypto(s, pass).then(function (crypt) {
    var objs = pdfScanObjects(s, bytes);
    var nums = Object.keys(objs);
    /* buka object stream dulu supaya objek di dalamnya ikut terbaca */
    return nums.reduce(function (p, n) {
      return p.then(function () {
        if (!objs[n].raw || !/ObjStm/.test(objs[n].dict)) return;
        return pdfStream(objs[n], crypt).then(function (d) {
          if (!d) return;
          var t = u8ToLatin1(d);
          var N = +(objs[n].dict.match(/\/N\s+(\d+)/) || [])[1];
          var F = +(objs[n].dict.match(/\/First\s+(\d+)/) || [])[1];
          if (!N || !F) return;
          var h = t.slice(0, F).trim().split(/\s+/).map(Number);
          for (var i = 0; i < N; i++) {
            var num = h[i * 2], off = h[i * 2 + 1];
            var nx = i + 1 < N ? h[(i + 1) * 2 + 1] : t.length - F;
            if (!objs[num]) objs[num] = { dict: t.slice(F + off, F + nx) };
          }
        });
      });
    }, Promise.resolve()).then(function () {
      /* urutan halaman dari pohon halaman; kalau gagal, urut nomor objek */
      var order = [];
      var cat0 = null;
      for (var k in objs) if (/\/Type\s*\/Catalog/.test(objs[k].dict)) cat0 = objs[k].dict;
      var pagesRef = cat0 && cat0.match(/\/Pages\s+(\d+)\s+0\s+R/);
      if (pagesRef && objs[pagesRef[1]]) {
        var kids = (objs[pagesRef[1]].dict.match(/\/Kids\s*\[([^\]]*)\]/) || [])[1] || '';
        kids.replace(/(\d+)\s+0\s+R/g, function (a, num) {
          var pd = objs[num] && objs[num].dict;
          if (!pd) return a;
          var cs = (pd.match(/\/Contents\s*\[([^\]]*)\]/) || [])[1];
          if (cs) {
            var list = [];
            cs.replace(/(\d+)\s+0\s+R/g, function (b, c) { list.push(c); return b; });
            order.push(list);
          } else {
            var one = pd.match(/\/Contents\s+(\d+)\s+0\s+R/);
            if (one) order.push([one[1]]);
          }
          return a;
        });
      }
      if (!order.length) {
        var solo = [];
        Object.keys(objs).sort(function (a, b) { return a - b; }).forEach(function (n) {
          if (objs[n].raw) solo.push(n);
        });
        order = solo.map(function (n) { return [n]; });
      }
      var pages = [];
      return order.reduce(function (p, list) {
        return p.then(function () {
          return list.reduce(function (q, n) {
            return q.then(function (acc) {
              return pdfStream(objs[n] || {}, crypt).then(function (d) {
                return acc + (d ? u8ToLatin1(d) : '');
              });
            });
          }, Promise.resolve('')).then(function (txt) {
            if (!/\bBT\b/.test(txt)) return;
            var its = pdfTextItems(txt), rows = {};
            for (var i = 0; i < its.length; i++) {
              if (!its[i].s.trim()) continue;
              var key = String(Math.round(its[i].y * 2) / 2);
              (rows[key] = rows[key] || []).push(its[i]);
            }
            var lines = Object.keys(rows)
              .sort(function (a, b) { return b - a; })
              .map(function (yk) {
                var v = rows[yk].sort(function (a, b) { return a.x - b.x; });
                return {
                  y: +yk,
                  cols: v.map(function (c) { return { x: Math.round(c.x), s: c.s.trim() }; })
                        .filter(function (c) { return c.s; }),
                  text: v.map(function (c) { return c.s; }).join(' ').replace(/\s+/g, ' ').trim()
                };
              })
              .filter(function (l) { return l.cols.length; });
            pages.push({ lines: lines });
          });
        });
      }, Promise.resolve()).then(function () {
        if (!pages.length) throw new Error('Tidak ada teks yang bisa dibaca dari PDF ini.');
        return pages;
      });
    });
  });
}
