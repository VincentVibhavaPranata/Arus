/* Menyamarkan teks transaksi SEBELUM keluar dari perangkat. Dipakai dua kali:
   di browser (sebelum fetch) dan di server (jangan percaya klien).
   Yang dibuang: nomor panjang (rekening, telepon, kode referensi), email, dan
   nama penerima pada transfer. Yang tersisa cukup untuk menebak kategori
   ("INDOMARET", "GOJEK", "TRSF E-BANKING").

   Masukan yang BENAR adalah keterangan ASLI dari bank/dompet (mis. "SWITCHING DB TRANSFER KE
   014 BUDI SANTOSO"), bukan judul yang sudah dibersihkan ("BUDI SANTOSO") — setelah dibersihkan,
   penanda transfer hilang dan nama tidak bisa dikenali lagi.

   Batasan jujur: nama orang di luar pola transfer tidak bisa dikenali dengan aturan sederhana
   (mis. nama pemilik warung di QRIS). Makanya AI mati secara default dan dikirim hanya
   untuk baris yang tidak dikenal. */
var XFER_TOKEN = /^(trsf|ditransfer|transfer|tf|bi-?fast|switching|kliring|rtgs|skn|sknbi)$/i;
var KEEP_TOKEN = /^(e-?banking|m-?banking|cr|db|dr|kr|ke|dari|antar|bank|bca|rek|rekening|online|fast|transfer|trsf)$/i;

export function redact(title) {
  var t = String(title == null ? '' : title);
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
  t = t.replace(/\+?\d[\d\s().\/-]{4,}\d/g, function (m) {
    return m.replace(/\D/g, '').length >= 6 ? '[no]' : m;
  });
  t = t.replace(/\b[A-Za-z0-9]{14,}\b/g, '[ref]');
  t = t.replace(/\s+/g, ' ').trim();

  /* Transfer: simpan kata sampai penanda jenis + arah (CR/DB, E-BANKING, KE/DARI), buang sisanya
     — di situlah nama penerima berada. Penanda boleh muncul di mana saja ("SWITCHING DB TRANSFER KE …"). */
  var w = t.split(' '), k = -1, i;
  for (i = 0; i < w.length; i++) {
    if (XFER_TOKEN.test(w[i]) || (/^bi$/i.test(w[i]) && /^fast$/i.test(w[i + 1] || ''))) { k = i; break; }
  }
  if (k >= 0) {
    var end = k + 1;
    while (end < w.length && end - k <= 5 && KEEP_TOKEN.test(w[end])) end++;
    t = w.slice(0, end).join(' ') + ' [penerima]';
  }
  return t.slice(0, 80);
}
