import { TF_CAT } from './constants.js';

/* =====================================================================
   SET IKON — satu bahasa visual, dibuat sendiri (tanpa CDN, tanpa font ikon).
   Semua viewBox 0 0 24 24, garis saja, tebal & radius seragam lewat CSS .ic.
   Kunci ikon = kunci kategori supaya tak ada peta kedua yang bisa melenceng.
   ===================================================================== */
export var SVG = {
  /* kategori pengeluaran */
  makan:     '<path d="M3.6 10.6h16.8c0 4.4-3.8 7.9-8.4 7.9s-8.4-3.5-8.4-7.9Z"/>'
           + '<path d="M9.2 7.6c0-1.1 1.4-1.4 1.4-2.7M13.2 8c0-1.3 1.5-1.6 1.5-3"/>',
  transport: '<path d="M3.4 14.2 5 9.5A2.4 2.4 0 0 1 7.3 7.9h9.4a2.4 2.4 0 0 1 2.3 1.6l1.6 4.7v3.3H3.4Z"/>'
           + '<path d="M6.6 17.5v1.6M17.4 17.5v1.6M7.2 14.2h9.6"/>',
  tagihan:   '<path d="M6.4 3.6h11.2v16.8l-2.8-1.5-2.8 1.5-2.8-1.5-2.8 1.5Z"/>'
           + '<path d="M9.4 8.2h5.2M9.4 11.8h5.2M9.4 15h3"/>',
  belanja:   '<path d="M5.8 8.2h12.4l-1.1 11.6a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9Z"/>'
           + '<path d="M9.4 8.2V6.6a2.6 2.6 0 0 1 5.2 0v1.6"/>',
  hiburan:   '<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.4"/>'
           + '<path d="M10.4 9.6 15 12l-4.6 2.4Z"/><path d="M3.4 9.4h17.2"/>',
  kesehatan: '<path d="M12 19.4S5.2 15.2 5.2 10.8A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 6.8 2.6c0 4.4-6.8 8.6-6.8 8.6Z"/>'
           + '<path d="M8.4 12.2h2l1.1-2 1.4 3.4 1-1.4h1.7"/>',
  pendidikan:'<path d="M2.6 9.4 12 5.2l9.4 4.2L12 13.6Z"/>'
           + '<path d="M6.4 11.3v4.3c0 1.4 2.5 2.5 5.6 2.5s5.6-1.1 5.6-2.5v-4.3"/>'
           + '<path d="M20.4 10v4.2"/>',
  investasi: '<path d="M3.4 17.6 9 11.9l3.4 3.1 7-7.4"/>'
           + '<path d="M15.2 7.6h4.2v4.2"/><path d="M3.4 20.4h17.2"/>',
  lain:      '<path class="d" d="M7 12h.01M12 12h.01M17 12h.01"/>',
  /* kategori pemasukan */
  gaji:      '<rect x="3.2" y="6.6" width="17.6" height="10.8" rx="2.2"/>'
           + '<circle cx="12" cy="12" r="2.6"/><path d="M6.6 10v.01M17.4 14v.01"/>',
  bonus:     '<circle cx="12" cy="12" r="8.4"/><path d="M12 8.4v7.2M8.4 12h7.2"/>',
  /* transfer */
  transfer:  '<path d="M4 9.4h13.2M14.4 6.4l3 3-3 3"/><path d="M20 14.6H6.8M9.6 11.6l-3 3 3 3"/>',
  /* navigasi */
  nav_dasbor:    '<path d="M4 10.6 12 4.2l8 6.4V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/>'
               + '<path d="M9.6 20v-5.6h4.8V20"/>',
  nav_transaksi: '<path d="M4.6 7h14.8M4.6 12h14.8M4.6 17h9.4"/>',
  nav_akun:      '<rect x="3.2" y="6" width="17.6" height="12" rx="2.4"/>'
               + '<path d="M3.2 10.4h17.6M16.4 14.4h1.6"/>',
  nav_trading:   '<path d="M7.4 4.4v15.2M5 8.2h4.8v7H5z"/>'
               + '<path d="M16.6 7v12.6M14.2 10.4H19v5.6h-4.8z"/>',
  nav_lainnya:   '<path class="d" d="M6 12h.01M12 12h.01M18 12h.01"/>',
  /* rangka UI */
  brand:  '<path d="M3 8.4c3-2.4 6 2.4 9 0s6-2.4 9 0"/>'
        + '<path d="M3 12c3-2.4 6 2.4 9 0s6-2.4 9 0"/>'
        + '<path d="M3 15.6c3-2.4 6 2.4 9 0s6-2.4 9 0"/>',
  close:  '<path d="M7.2 7.2 16.8 16.8M16.8 7.2 7.2 16.8"/>',
  chev_l: '<path d="M14.4 6.4 8.8 12l5.6 5.6"/>',
  chev_r: '<path d="M9.6 6.4 15.2 12l-5.6 5.6"/>',
  arrow_r: '<path d="M4.5 12h14.6M14.4 7.2l4.8 4.8-4.8 4.8"/>',
  arrow_d: '<path d="M12 4.6v14.6M7.2 14.4 12 19.2l4.8-4.8"/>',
  /* ikon tambahan untuk kategori buatan sendiri */
  bangunan: '<path d="M4.6 20V5.2h9.6V20"/><path d="M4.6 9h9.6M4.6 13h9.6"/>'
          + '<path d="M14.2 20v-9.4h4.6V20"/><path d="M9.2 20v-3.4"/>',
  pulsa:    '<path d="M4.4 19.4h15.2"/>'
          + '<path d="M6.6 16.4v-2.6M11 16.4V9.6M15.4 16.4V6.4M19.4 16.4V4.6"/>',
  hadiah:   '<path d="M4.4 10.6h15.2v8.8H4.4z"/><path d="M12 10.6v8.8"/>'
          + '<path d="M12 10.6C10 10.6 8.4 9.8 8.4 8.4s2-2 3.6 2.2c1.6-4.2 3.6-3.6 3.6-2.2s-1.6 2.2-3.6 2.2Z"/>',
  olahraga: '<path d="M4.4 9.4v5.2M7 8v8M17 8v8M19.6 9.4v5.2M7 12h10"/>',
  /* kontrol */
  search: '<circle cx="10.8" cy="10.8" r="5.8"/><path d="M15.2 15.2 20 20"/>',
  trash:  '<path d="M4.8 7.2h14.4M9.4 7.2V5.4h5.2v1.8"/>'
        + '<path d="M6.6 7.2 7.6 19.4a1 1 0 0 0 1 .9h6.8a1 1 0 0 0 1-.9L18.4 7.2"/>'
        + '<path d="M10.4 10.8v6M13.6 10.8v6"/>',
  plus:   '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
  minus:  '<path d="M5.4 12h13.2"/>',
  check:  '<path d="M5 12.6 9.6 17 19 6.6"/>',
  repeat: '<path d="M4.4 10.4A7.6 7.6 0 0 1 18.6 8.6"/><path d="M18.8 4.6v4.2h-4.2"/>'
        + '<path d="M19.6 13.6A7.6 7.6 0 0 1 5.4 15.4"/><path d="M5.2 19.4v-4.2h4.2"/>',
  trade:  '<path d="M7 4.6v14.8M4.6 8h4.8v7.4H4.6z"/>'
        + '<path d="M17 4.6v14.8M14.6 10.6h4.8V17h-4.8z"/>',
  share:  '<path d="M12 15.4V4.2"/><path d="M8 8.2 12 4.2l4 4"/>'
        + '<path d="M5 14v4.4a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4V14"/>'
};

/* Ikon yang bisa dipilih user untuk kategori buatan sendiri. Sengaja dibatasi
   ke ikon bertema kategori — ikon rangka UI (chevron, trash) tidak masuk. */
export var PICKABLE_ICONS = ['makan', 'transport', 'tagihan', 'belanja', 'hiburan',
  'kesehatan', 'pendidikan', 'investasi', 'bangunan', 'pulsa', 'hadiah',
  'olahraga', 'gaji', 'bonus', 'lain'];

/* icon('makan') -> <svg class="ic"> siap dipasang. Dipakai di SEMUA layar. */
export function icon(name, extra) {
  var body = SVG[name] || SVG.lain;
  var wrap = document.createElement('div');
  wrap.innerHTML = '<svg viewBox="0 0 24 24" class="ic' + (extra ? ' ' + extra : '') +
                   '" aria-hidden="true" focusable="false">' + body + '</svg>';
  var svg = wrap.firstChild;
  svg.dataset.ic = name;
  /* titik-titik dipertebal supaya benar-benar terlihat sebagai dot */
  var d = svg.querySelector('.d');
  if (d) d.setAttribute('stroke-width', '2.6');
  return svg;
}

export var CATS_DEFAULT = [
  { k:'makan',     label:'Makan & Minum',  ic:'makan',     kind:'out' },
  { k:'transport', label:'Transportasi',   ic:'transport', kind:'out' },
  { k:'tagihan',   label:'Tagihan',        ic:'tagihan',   kind:'out' },
  { k:'belanja',   label:'Belanja',        ic:'belanja',   kind:'out' },
  { k:'hiburan',   label:'Hiburan',        ic:'hiburan',   kind:'out' },
  { k:'kesehatan', label:'Kesehatan',      ic:'kesehatan', kind:'out' },
  { k:'pendidikan',label:'Pendidikan',     ic:'pendidikan',kind:'out' },
  { k:'investasi', label:'Investasi',      ic:'investasi', kind:'out' },
  { k:'lain',      label:'Lain-lain',      ic:'lain',      kind:'out' },
  { k:'gaji',      label:'Gaji',           ic:'gaji',      kind:'in'  },
  { k:'bonus',     label:'Pemasukan Lain', ic:'bonus',     kind:'in'  },
  { k:TF_CAT,      label:'Transfer',       ic:'transfer',  kind:'tf'  }
];

export var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
             'Agustus','September','Oktober','November','Desember'];

export var BULAN_S = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export var HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
