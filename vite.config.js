import { defineConfig } from 'vite';

/* Content-Security-Policy hanya untuk build produksi (dev butuh HMR). Tujuannya
   mempersempit risiko XSS, penting karena API key AI tersimpan di browser:
   skrip hanya boleh dari origin sendiri, jadi skrip suntikan tidak jalan.
   connect-src sengaja longgar (http/https) karena alamat server sinkronisasi
   diisi pengguna sendiri; kalau kamu tidak pakai sinkronisasi, persempit jadi
   'self' https://generativelanguage.googleapis.com. */
var CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http: https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

export default defineConfig({
  /* Untuk GitHub Pages: BASE_PATH=/nama-repo/ npm run build. Vercel/Netlify tidak perlu. */
  base: process.env.BASE_PATH || '/',
  test: { environment: 'jsdom', include: ['tests/**/*.test.js'], css: false },
  plugins: [{
    name: 'arus-csp',
    apply: 'build',
    transformIndexHtml: function (html) {
      return html.replace('<head>', '<head>\n  <meta http-equiv="Content-Security-Policy" content="' + CSP + '">');
    }
  }],
  server: {
    port: 5173,
    // Mode server (opsional, VITE_AI_SERVER=1): panggilan AI lewat server/index.js.
    proxy: { '/api/categorize': 'http://localhost:8789' }
  }
});
