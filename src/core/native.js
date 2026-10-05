/* =====================================================================
   LINGKUNGAN NATIVE (APK Capacitor).

   Di dalam APK, berkas app SUDAH ada di perangkat, jadi beberapa hal harus
   berperilaku beda dari versi web:
     - service worker TIDAK didaftarkan; cache-nya justru bisa menyajikan isi
       basi setelah kamu memasang APK versi baru
     - a[download] diabaikan WebView Android, jadi ekspor berkas harus jatuh
       ke salin-teks alih-alih pura-pura berhasil
   ===================================================================== */
export function isNative() {
  try {
    if (window.Capacitor) {
      return typeof window.Capacitor.isNativePlatform === 'function'
        ? window.Capacitor.isNativePlatform() : true;
    }
  } catch (e) {}
  return false;
}
