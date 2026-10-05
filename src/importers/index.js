import { render } from '../app/render.js';
import { ymLabel } from '../core/dates.js';
import { addCheckpoint } from '../core/derived.js';
import { fmtRp } from '../core/money.js';
import { DATA, save } from '../core/store.js';
import { aiFillStaging, needsAI } from '../features/aiCategorize.js';
import { restage } from '../features/staging.js';
import { detectSource, parseBCA } from './bca.js';
import { parseBCAPdf } from './bcaPdf.js';
import { isGoPayPdf, parseGoPayPdf } from './gopayPdf.js';
import { parseTxCSV } from './csvTx.js';
import { pdfLines } from './pdfReader.js';
import { sheetFolio } from '../sheets/folio.js';
import { sheetPdfPass } from '../sheets/pdfPass.js';
import { UI } from '../ui/nav.js';
import { toast } from '../ui/toast.js';

/* ---------- pemilih berkas ---------- */
export function pickFile(isFolio) {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = isFolio ? '.csv,.tsv,.txt,text/csv,text/plain'
                       : '.pdf,.csv,.tsv,.txt,application/pdf,text/csv,text/plain';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', function () {
    var f = inp.files && inp.files[0];
    document.body.removeChild(inp);
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      toast('Berkas Excel belum didukung — simpan sebagai CSV dulu', { ms: 6000 });
      return;
    }
    if (!isFolio && /\.pdf$/i.test(f.name)) {
      var fb = new FileReader();
      fb.onload = function () { handleImportPDF(new Uint8Array(fb.result), 'BCA'); };
      fb.onerror = function () { toast('Gagal membaca berkas'); };
      fb.readAsArrayBuffer(f);
      return;
    }
    var fr = new FileReader();
    fr.onload = function () { handleImportText(String(fr.result || ''), isFolio, 'BCA'); };
    fr.onerror = function () { toast('Gagal membaca berkas'); };
    fr.readAsText(f);
  });
  inp.click();
}

/* Alur PDF: baca -> (minta sandi kalau perlu) -> parse -> staging.
   Berkasnya tidak pernah dikirim ke mana pun. */
export function handleImportPDF(bytes, acct, pass) {
  toast('Membaca PDF…', { ms: 2500 });
  pdfLines(bytes, pass || '')
    .then(function (pages) {
      /* E-statement GoPay punya format sendiri (kolom Metode pembayaran, Coins, GoPay Later). */
      if (isGoPayPdf(pages)) {
        var g = parseGoPayPdf(pages), gr = g.recon;
        if (!g.length) { toast('Tidak ada transaksi rupiah yang terbaca dari PDF GoPay ini', { ms: 7000 }); return; }
        stageRows(g, g.skipped.coins ? g.skipped.coins + ' baris Coins dilewati' : '');
        if (gr.cocok === true) {
          toast('Cocok dengan total GoPay · pemasukan ' + fmtRp(gr.pemasukan) + ' · pengeluaran ' + fmtRp(gr.pengeluaran) +
                ' (' + fmtRp(gr.pengeluaran - gr.coinsUsed) + ' setelah Coins ' + fmtRp(gr.coinsUsed) + ')', { ms: 9000 });
        } else if (gr.cocok === false) {
          toast('TIDAK cocok dengan total GoPay · selisih ' + fmtRp(gr.selisih) + ' · periksa baris sebelum mencatat', { ms: 10000 });
        }
        return;
      }
      var rows = parseBCAPdf(pages, acct || 'BCA');
      var r = rows.recon;
      stageRows(rows);
      /* Saldo akhir yang dicetak bank disimpan sebagai TITIK PERIKSA bertanggal.
         Nanti dipakai untuk memastikan catatan kita tidak kurang sebulan pun. */
      if (r && r.saldoAkhir != null && !isNaN(r.saldoAkhir) && rows.length) {
        var akhir = rows[rows.length - 1].s;
        for (var q = 0; q < rows.length; q++) if (rows[q].s > akhir) akhir = rows[q].s;
        addCheckpoint(acct || 'BCA', akhir, r.saldoAkhir,
          'e-statement ' + ymLabel(r.ym));
        save();
        render();
      }
      if (r && r.cocok === true) {
        toast('Rekonsiliasi cocok · saldo akhir ' + fmtRp(Math.round(r.saldoAkhir)), { ms: 6000 });
      } else if (r && r.cocok === false) {
        toast('Rekonsiliasi TIDAK cocok · selisih ' + fmtRp(Math.round(r.selisih)) +
              ' · periksa baris sebelum mencatat', { ms: 9000 });
      }
    })['catch'](function (e) {
      if (/Sandi PDF salah|Data enkripsi/i.test(e.message) && pass == null) {
        sheetPdfPass(bytes, acct);
        return;
      }
      toast('Gagal membaca PDF: ' + e.message, { ms: 8000 });
    });
}

/* Satu pintu masuk dari teks apa pun — file, tempel, papan klip, atau tes.
   Dialek dideteksi di sini; parser khusus dipakai kalau cocok, kalau tidak
   jatuh ke parser CSV umum. */
export function parseImport(text, acct) {
  var kind = detectSource(text);
  if (kind === 'klikbca' || kind === 'mybca') return parseBCA(text, acct || 'BCA');
  return parseTxCSV(text, acct || 'BCA');
}

export function stageRows(rows, note) {
  /* Tandai rombongan impor. Dua berkas berbeda tidak boleh dianggap satu
     berkas, dan satu berkas yang diimpor dua kali harus ketahuan. */
  var batch = 'b' + (++DATA.seq);
  for (var i = 0; i < rows.length; i++) rows[i].batch = batch;
  DATA.staging = DATA.staging.concat(rows);
  restage(DATA.staging);
  save();
  UI.tab = 'impor';
  render();
  var extra = '';
  if (rows.skipped && rows.skipped.pend) extra = ' · ' + rows.skipped.pend + ' baris PEND dilewati';
  toast(rows.length + ' baris siap ditinjau' + extra + (note ? ' · ' + note : ''), { ms: 5000 });
  /* Susulan, tanpa menahan layar Tinjau: baris yang tak dikenal ditanyakan ke AI. */
  if (rows.some(needsAI)) {
    aiFillStaging(rows).then(function (r) {
      if (r.n) { if (UI.tab === 'impor') render(); toast('AI mengkategorikan ' + r.n + ' baris — periksa dulu', { ms: 5000 }); }
      else if (r.err) toast('AI kategori tidak jalan (' + r.err + ') — pakai kategori bawaan', { ms: 5000 });
    });
  }
}

export function handleImportText(text, isFolio, acct) {
  if (isFolio) { sheetFolio(text); return; }
  var rows;
  try {
    rows = parseImport(text, acct || 'BCA');
  } catch (e) {
    toast('Gagal: ' + e.message, { ms: 6000 });
    return;
  }
  stageRows(rows);
}
