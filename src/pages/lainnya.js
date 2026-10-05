import { icon } from '../core/icons.js';
import { fmtRpSign } from '../core/money.js';
import { DATA } from '../core/store.js';
import { auditData } from '../features/audit.js';
import { lockEnabled, lockLoad } from '../features/lock.js';
import { recPending } from '../features/recurring.js';
import { syncCfg, syncOn } from '../features/sync.js';
import { tradeStats } from '../features/trading.js';
import { sheetAudit } from '../sheets/audit.js';
import { sheetBackup } from '../sheets/backup.js';
import { sheetCats } from '../sheets/cats.js';
import { sheetLock } from '../sheets/lock.js';
import { sheetRecurring } from '../sheets/recurring.js';
import { sheetReset } from '../sheets/reset.js';
import { aiLoad, aiMode } from '../features/aiConfig.js';
import { aiCardIcon, sheetAi } from '../sheets/ai.js';
import { sheetSync } from '../sheets/sync.js';
import { el, go } from '../ui/nav.js';

export function viewLainnya(root) {
  root.appendChild(sechd('Pengaturan'));
  var kc = el('button', 'card');
  kc.id = 'more-cats';
  kc.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var kav = el('div', 'av g');
  kav.appendChild(icon('lain'));
  kc.appendChild(kav);
  var kb = el('div');
  kb.style.flex = '1';
  kb.appendChild(el('div', null, 'Kelola kategori'));
  kb.appendChild(el('div', 'tiny mut', DATA.cats.length + ' kategori · ubah nama atau hapus'));
  kc.appendChild(kb);
  kc.appendChild(icon('chev_r'));
  kc.addEventListener('click', sheetCats);
  root.appendChild(kc);

  var ic = el('button', 'card');
  ic.id = 'more-impor';
  ic.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var iav = el('div', 'av g');
  iav.appendChild(icon('arrow_d'));
  ic.appendChild(iav);
  var ib = el('div');
  ib.style.flex = '1';
  ib.appendChild(el('div', null, 'Impor'));
  ib.appendChild(el('div', 'tiny mut', DATA.staging.length
    ? DATA.staging.length + ' baris menunggu ditinjau'
    : 'CSV transaksi & nilai portofolio'));
  ic.appendChild(ib);
  ic.appendChild(icon('chev_r'));
  ic.addEventListener('click', function () { go('impor'); });
  root.appendChild(ic);

  var rc = el('button', 'card');
  rc.id = 'more-rec';
  rc.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var rav = el('div', 'av g');
  rav.appendChild(icon('repeat'));
  rc.appendChild(rav);
  var rb = el('div');
  rb.style.flex = '1';
  rb.appendChild(el('div', null, 'Rutin bulanan'));
  var pend = recPending().length;
  rb.appendChild(el('div', 'tiny mut', DATA.recurring.length
    ? DATA.recurring.length + ' tagihan' + (pend ? ' · ' + pend + ' jatuh tempo' : '')
    : 'Template tagihan yang berulang'));
  rc.appendChild(rb);
  rc.appendChild(icon('chev_r'));
  rc.addEventListener('click', sheetRecurring);
  root.appendChild(rc);

  var tc = el('button', 'card');
  tc.id = 'more-trading';
  tc.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var tav = el('div', 'av g');
  tav.appendChild(icon('trade'));
  tc.appendChild(tav);
  var tb = el('div');
  tb.style.flex = '1';
  tb.appendChild(el('div', null, 'Jurnal trading'));
  var ts = tradeStats();
  tb.appendChild(el('div', 'tiny mut', ts.n || ts.nOpen
    ? ts.n + ' tutup · ' + ts.nOpen + ' terbuka · ' + fmtRpSign(ts.net)
    : 'Catat trade, statistik dihitung sendiri'));
  tc.appendChild(tb);
  tc.appendChild(icon('chev_r'));
  tc.addEventListener('click', function () { go('trading'); });
  root.appendChild(tc);

  var bc = el('button', 'card');
  bc.id = 'more-backup';
  bc.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var bav = el('div', 'av g');
  bav.appendChild(icon('share'));
  bc.appendChild(bav);
  var bb = el('div');
  bb.style.flex = '1';
  bb.appendChild(el('div', null, 'Ekspor & impor'));
  bb.appendChild(el('div', 'tiny mut', 'Cadangan JSON, ekspor CSV untuk Excel'));
  bc.appendChild(bb);
  bc.appendChild(icon('chev_r'));
  bc.addEventListener('click', sheetBackup);
  root.appendChild(bc);

  var kl = el('button', 'card');
  kl.id = 'more-lock';
  kl.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var klav = el('div', 'av' + (lockEnabled() ? ' g' : ''));
  klav.appendChild(icon(lockEnabled() ? 'check' : 'close'));
  kl.appendChild(klav);
  var klb = el('div');
  klb.style.flex = '1';
  klb.appendChild(el('div', null, 'Kunci PIN'));
  klb.appendChild(el('div', 'tiny mut', lockEnabled()
    ? 'Aktif · ' + (lockLoad().algo === 'pbkdf2' ? 'PBKDF2' : 'hash sederhana')
    : 'Mati · kunci layar, bukan enkripsi'));
  kl.appendChild(klb);
  kl.appendChild(icon('chev_r'));
  kl.addEventListener('click', sheetLock);
  root.appendChild(kl);

  var sc = el('button', 'card');
  sc.id = 'more-sync';
  sc.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var scav = el('div', 'av' + (syncOn() ? ' g' : ''));
  scav.appendChild(icon('repeat'));
  sc.appendChild(scav);
  var scb = el('div');
  scb.style.flex = '1';
  scb.appendChild(el('div', null, 'Sinkronisasi'));
  scb.appendChild(el('div', 'tiny mut', syncOn()
    ? syncCfg().user + ' · revisi ' + (syncCfg().rev || 0)
    : 'Mati · servermu sendiri, opsional'));
  sc.appendChild(scb);
  sc.appendChild(icon('chev_r'));
  sc.addEventListener('click', sheetSync);
  root.appendChild(sc);

  var aiM = aiMode(), aiOn = aiLoad().on && aiM !== 'none';
  var ak = el('button', 'card');
  ak.id = 'more-ai';
  ak.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var akav = el('div', 'av' + (aiOn ? ' g' : ''));
  akav.appendChild(aiCardIcon(aiOn));
  ak.appendChild(akav);
  var akb = el('div');
  akb.style.flex = '1';
  akb.appendChild(el('div', null, 'Kategori AI'));
  akb.appendChild(el('div', 'tiny mut', aiOn
    ? 'Aktif · ' + (aiM === 'key' ? 'key-mu sendiri' : 'lewat server') + ' · teks disamarkan sebelum dikirim'
    : aiM === 'none' ? 'Mati · perlu API key Gemini-mu sendiri'
    : 'Mati · tebak kategori baris yang tak dikenal'));
  ak.appendChild(akb);
  ak.appendChild(icon('chev_r'));
  ak.addEventListener('click', sheetAi);
  root.appendChild(ak);

  var ac = el('button', 'card');
  ac.id = 'more-audit';
  ac.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var acav = el('div', 'av' + (auditData().length ? '' : ' g'));
  acav.appendChild(icon(auditData().length ? 'lain' : 'check'));
  ac.appendChild(acav);
  var acb = el('div');
  acb.style.flex = '1';
  acb.appendChild(el('div', null, 'Audit konsistensi'));
  var nAudit = auditData().length;
  acb.appendChild(el('div', 'tiny mut', nAudit
    ? nAudit + ' hal perlu dilihat'
    : 'Semua invarian terpenuhi'));
  ac.appendChild(acb);
  ac.appendChild(icon('chev_r'));
  ac.addEventListener('click', sheetAudit);
  root.appendChild(ac);

  var rs = el('button', 'card');
  rs.id = 'more-reset';
  rs.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left';
  var rsav = el('div', 'av');
  rsav.style.color = 'var(--down)';
  rsav.appendChild(icon('trash'));
  rs.appendChild(rsav);
  var rsb = el('div');
  rsb.style.flex = '1';
  rsb.appendChild(el('div', null, 'Mulai ulang'));
  rsb.appendChild(el('div', 'tiny mut', 'Hapus semua catatan, mulai dari nol atau data contoh'));
  rs.appendChild(rsb);
  rs.appendChild(icon('chev_r'));
  rs.addEventListener('click', sheetReset);
  root.appendChild(rs);

  var c = el('div', 'card');
  c.style.textAlign = 'center';
  c.appendChild(el('div', 'tiny mut', 'Arus v0.11 · data tersimpan di perangkat ini (localStorage)'));
  root.appendChild(c);
}

export function sechd(t) {
  var s = el('div', 'sec');
  s.appendChild(el('h2', null, t));
  return s;
}

export function soon(title, body) {
  var d = el('div', 'soon');
  d.appendChild(el('b', null, title));
  d.appendChild(el('div', 'tiny', body));
  return d;
}
