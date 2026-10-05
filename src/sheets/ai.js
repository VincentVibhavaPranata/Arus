import { render } from '../app/render.js';
import { icon } from '../core/icons.js';
import { aiClearKey, aiLoad, aiMode, aiSave, checkKey, maskKey } from '../features/aiConfig.js';
import { aiListModels, aiTest } from '../features/aiCategorize.js';
import { DEFAULT_MODEL, checkModel } from '../features/aiShared.js';
import { redact } from '../features/redact.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';

/* ==================== SHEET: KATEGORI AI ====================
   Izin yang jelas dan bisa dicabut, dengan API key milik pengguna sendiri.
   Contoh "sebelum -> sesudah" dihitung dari fungsi redact() yang SAMA dengan
   yang dipakai saat mengirim, jadi tidak bisa berbohong. */
var SAMPLE = 'TRSF E-BANKING BUDI SANTOSO 8012345678';

export function aiCardIcon(on) { return icon(on ? 'check' : 'close'); }

export function sheetAi() {
  openSheet('Kategori AI', function (bd) {
    bd.id = 'ai-body';
    build(bd);
  });
}

function card(bd, judul, isi) {
  var c = el('div', 'card');
  c.appendChild(el('div', null, judul));
  if (isi) {
    var t = el('div', 'tiny mut', isi);
    t.style.marginTop = '6px';
    c.appendChild(t);
  }
  bd.appendChild(c);
  return c;
}

function build(bd) {
  bd.innerHTML = '';
  var cfg = aiLoad(), mode = aiMode();

  var note = el('div', 'hint');
  note.style.textAlign = 'left';
  note.textContent = 'Saat impor, baris yang tidak dikenali aturanmu atau daftar merchant bisa ' +
    'ditebak kategorinya oleh Google Gemini. Fitur ini MATI sampai kamu menyalakannya, ' +
    'dan hasilnya selalu kamu periksa dulu di layar Tinjau.';
  bd.appendChild(note);

  /* ---- koneksi: API key sendiri ---- */
  var kc = card(bd, 'API key Gemini-mu',
    mode === 'key' ? 'Tersimpan di browser ini · ' + maskKey(cfg.key) + ' · panggilan langsung dari browser ke Google'
    : mode === 'server' ? 'Belum ada key — sementara lewat server Arus (mode pribadi)'
    : 'Belum ada key. Buat di aistudio.google.com/apikey lalu tempel di sini.');
  kc.id = 'ai-conn';
  kc.dataset.mode = mode;

  var status = el('div', 'tiny');
  status.id = 'ai-status';
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin-top:8px;min-height:1em';

  if (mode === 'key') {
    var row = el('div', 'row2');
    row.style.marginTop = '12px';
    var test = el('button', 'btn ghost');
    test.id = 'ai-test';
    test.textContent = 'Tes koneksi';
    test.addEventListener('click', async function () {
      test.disabled = true;
      status.style.color = 'var(--mut)';
      status.textContent = 'Menguji dengan satu contoh tetap (tanpa catatanmu)…';
      var r = await aiTest();
      test.disabled = false;
      status.style.color = r.ok ? 'var(--up)' : 'var(--down)';
      status.textContent = r.ok ? 'Tersambung. Key berfungsi.' : 'Gagal: ' + r.msg;
      if (!r.ok && /model/i.test(r.msg)) adv.open = true;   // masalah model: langsung tunjukkan jalan keluarnya
    });
    var del = el('button', 'btn ghost');
    del.id = 'ai-del';
    del.style.cssText = 'color:var(--down);border-color:rgba(255,123,143,.35)';
    del.textContent = 'Hapus key';
    del.addEventListener('click', function () {
      aiClearKey();
      render();
      toast('Key dihapus, kategori AI dimatikan');
      build(bd);
    });
    row.appendChild(test);
    row.appendChild(del);
    kc.appendChild(row);
  } else {
    var fld = el('div', 'fld');
    fld.style.margin = '12px 0 0';
    var inp = el('input', 'inp');
    inp.id = 'ai-key';
    inp.type = 'password';
    inp.placeholder = 'Tempel API key (AQ.… atau AIza…)';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.setAttribute('autocapitalize', 'off');
    fld.appendChild(inp);
    kc.appendChild(fld);
    var save = el('button', 'btn');
    save.id = 'ai-save';
    save.style.marginTop = '10px';
    save.textContent = 'Simpan key';
    save.addEventListener('click', function () {
      var chk = checkKey(inp.value);
      if (!chk.ok) {
        status.style.color = 'var(--down)';
        status.textContent = chk.why;
        return;
      }
      if (!aiSave({ key: chk.key })) {
        status.style.color = 'var(--down)';
        status.textContent = 'Browser menolak menyimpan (penyimpanan penuh atau diblokir).';
        return;
      }
      render();
      build(bd);
      var s2 = bd.querySelector('#ai-status');
      if (s2) { s2.style.color = 'var(--up)'; s2.textContent = 'Tersimpan. Coba "Tes koneksi" dulu.'; }
    });
    kc.appendChild(save);
  }
  kc.appendChild(status);

  var adv = el('details');
  adv.style.marginTop = '12px';
  var sum = el('summary', 'tiny mut', 'Lanjutan: model');
  sum.style.cursor = 'pointer';
  adv.appendChild(sum);
  var mi = el('input', 'inp');
  mi.id = 'ai-model';
  mi.placeholder = DEFAULT_MODEL;
  mi.value = cfg.model;
  mi.autocomplete = 'off';
  mi.spellcheck = false;
  mi.style.marginTop = '8px';
  var mstat = el('div', 'tiny');
  mstat.id = 'ai-model-status';
  mstat.setAttribute('role', 'status');
  mstat.style.cssText = 'margin-top:6px';
  mstat.className = 'tiny mut';
  mstat.textContent = cfg.model ? 'Model dipakai: ' + cfg.model
    : 'Kosong = ' + DEFAULT_MODEL + ' (otomatis model Flash terbaru).';
  mi.addEventListener('change', function () {
    var c = checkModel(mi.value);
    if (!c.ok) {
      mstat.style.color = 'var(--down)';
      mstat.textContent = c.why;        // tidak mengubah apa pun yang tersimpan
      return;
    }
    aiSave({ model: c.model });
    mi.value = c.model;
    mstat.style.color = 'var(--up)';
    mstat.textContent = c.model ? 'Model dipakai: ' + c.model : 'Kembali ke bawaan: ' + DEFAULT_MODEL;
  });
  adv.appendChild(mi);
  adv.appendChild(mstat);
  if (mode === 'key') {
    var chips = el('div');
    chips.id = 'ai-model-list';
    chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px';
    var lm = el('button', 'btn ghost');
    lm.id = 'ai-models';
    lm.style.cssText = 'margin-top:10px;padding:11px';
    lm.textContent = 'Cek model yang tersedia';
    lm.addEventListener('click', async function () {
      lm.disabled = true;
      mstat.style.color = 'var(--mut)';
      mstat.textContent = 'Menanyakan ke Google…';
      var r = await aiListModels();
      lm.disabled = false;
      chips.innerHTML = '';
      if (!r.ok) { mstat.style.color = 'var(--down)'; mstat.textContent = 'Gagal: ' + r.msg; return; }
      mstat.style.color = 'var(--mut)';
      mstat.textContent = 'Pilih salah satu (yang teratas paling disarankan):';
      r.ids.forEach(function (id) {
        var chip = el('button', 'fchip');
        chip.textContent = id;
        chip.setAttribute('aria-pressed', String(aiLoad().model === id));
        chip.addEventListener('click', function () {
          aiSave({ model: id });
          mi.value = id;
          chips.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === chip)); });
          mstat.style.color = 'var(--up)';
          mstat.textContent = 'Model dipakai: ' + id + '. Klik "Tes koneksi" untuk mencoba.';
        });
        chips.appendChild(chip);
      });
    });
    adv.appendChild(lm);
    adv.appendChild(chips);
  }
  kc.appendChild(adv);

  /* ---- apa yang dikirim ---- */
  card(bd, 'Yang dikirim',
    'Teks keterangan ASLI dari bank, sudah disamarkan, plus arahnya (masuk/keluar), dan daftar nama kategorimu ' +
    '(jadi jangan beri kategori nama orang). Hanya untuk baris yang tidak dikenali.');
  card(bd, 'Yang TIDAK dikirim',
    'Nominal, tanggal, saldo, nama akun, nomor rekening atau telepon, email, dan nama penerima transfer.');
  var ex = card(bd, 'Contoh nyata', 'Di catatanmu: ' + SAMPLE);
  var b = el('div', 'tiny', 'Yang dikirim: ' + redact(SAMPLE));
  b.style.marginTop = '3px';
  ex.appendChild(b);

  card(bd, 'Perlu tahu',
    'Key tersimpan HANYA di browser ini. Tidak ikut ekspor, cadangan, atau sinkronisasi, tapi siapa pun ' +
    'yang memakai browser ini bisa memakainya, jadi jangan simpan di perangkat bersama. ' +
    'Pasang batas anggaran untuk key itu di Google. Teks diproses oleh Google: di paket gratis Gemini, ' +
    'Google boleh menyimpan dan meninjau isinya untuk memperbaiki produknya; paket berbayar tidak dipakai ' +
    'untuk itu. Nama orang di luar pola transfer tidak selalu bisa disamarkan.');

  /* ---- izin ---- */
  var on = cfg.on && mode !== 'none';
  var btn = el('button', on ? 'btn ghost' : 'btn');
  btn.id = 'ai-toggle';
  btn.style.marginTop = '4px';
  if (on) btn.style.cssText += ';color:var(--down);border-color:rgba(255,123,143,.35)';
  btn.textContent = on ? 'Matikan kategori AI' : 'Nyalakan kategori AI';
  if (!on && mode === 'none') {
    btn.disabled = true;
    btn.style.opacity = '.45';
    btn.textContent = 'Simpan API key dulu';
  }
  btn.addEventListener('click', function () {
    aiSave({ on: !on });
    closeSheet();
    render();
    toast(on ? 'Kategori AI dimatikan' : 'Kategori AI dinyalakan');
  });
  bd.appendChild(btn);
}
