import { catExists, catOf } from '../core/categories.js';
import { allItems } from '../core/derived.js';
import { DATA, withUndo } from '../core/store.js';
import { isTf } from '../core/transfer.js';
import { toast } from '../ui/toast.js';

/* Dugaan kategori dari keterangan. Sengaja konservatif: kalau tidak yakin
   jatuh ke 'lain' dan barisnya ditandai perlu dicek, bukan menebak. */
export var MERCHANTS = [
  [/indomaret|alfamart|alfamidi|superindo|hypermart|transmart|lawson|circle ?k/i, 'belanja'],
  [/tokopedia|shopee|lazada|blibli|bukalapak|tiktok ?shop/i, 'belanja'],
  [/gojek|gocar|goride|grab|maxim|indrive|transjakarta|kai |krl|mrt /i, 'transport'],
  [/pertamina|shell |vivo |spbu|bensin|pertamax|pertalite/i, 'transport'],
  [/gofood|grabfood|shopeefood|resto|warteg|warung|kopi|coffee|cafe|kfc|mcd|mcdonald|burger|bakso|sate|padang|pizza|starbucks|kenangan/i, 'makan'],
  [/indihome|telkom|pln |listrik|pdam|air |first ?media|biznet|myrepublic|xl |telkomsel|indosat|tri |smartfren|byu/i, 'tagihan'],
  [/biaya adm|adm bank|admin bank|biaya transfer|biaya bulanan/i, 'tagihan'],
  [/depot|nasi |ayam|geprek|soto|mie |bakmi|gado|martabak|roti|bakery|es teh|teh |kebab|sushi|chicken|bowl|ramen|boba|steak|seafood|dimsum|bubur/i, 'makan'],
  [/google play|play store|app store/i, 'hiburan'],
  [/netflix|spotify|disney|youtube|vidio|hbo|viu|iqiyi|steam|playstation|bioskop|cgv|xxi|cinepolis/i, 'hiburan'],
  [/apotek|kimia farma|guardian|watson|klinik|rumah sakit|rs |dokter|halodoc|bpjs/i, 'kesehatan'],
  [/bibit|bareksa|ajaib|stockbit|ipot|mirae|pluang|reksa ?dana|sekuritas/i, 'investasi'],
  [/gaji|salary|payroll|thr /i, 'gaji']
];

/* Kunci ingatan kategori: nama transaksi yang dinormalkan. */
export function titleKey(t) {
  return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/* Transaksi lain yang namanya sama. Dipakai untuk menawarkan perubahan massal. */
export function sameTitle(title, exceptId, d) {
  d = d || DATA;
  var k = titleKey(title);
  if (!k) return [];
  var out = [], all = allItems(d);
  for (var i = 0; i < all.length; i++) {
    var it = all[i].it;
    if (it.id === exceptId || isTf(it)) continue;
    if (titleKey(it.title) === k) out.push(it);
  }
  return out;
}

export function setCatRule(title, cat, d) {
  d = d || DATA;
  var k = titleKey(title);
  if (!k) return;
  if (!d.catRules) d.catRules = {};
  d.catRules[k] = cat;
}

/* Ubah kategori semua transaksi bernama sama. Mengembalikan jumlah yang benar
   BERUBAH, bukan yang diperiksa. */
export function recatSame(title, cat, exceptId, d) {
  d = d || DATA;
  var list = sameTitle(title, exceptId, d), n = 0;
  for (var i = 0; i < list.length; i++)
    if (list[i].cat !== cat) { list[i].cat = cat; n++; }
  return n;
}

/* Ingatanmu menang atas daftar merchant bawaan: kalau kamu sudah pernah
   memutuskan "ROCKY ROOS itu makan", impor berikutnya tidak menebak lagi. */
export function guessCat(title, amt) {
  var t = String(title || '');
  var rule = DATA && DATA.catRules && DATA.catRules[titleKey(t)];
  if (rule && catExists(rule)) return rule;
  for (var i = 0; i < MERCHANTS.length; i++)
    if (MERCHANTS[i][0].test(t)) return MERCHANTS[i][1];
  return amt >= 0 ? 'bonus' : 'lain';
}

/* Apakah kategori tebakan ini cuma jatuh ke bawaan (tidak ada aturan, tidak ada
   merchant yang cocok)? Hanya baris seperti ini yang layak ditanyakan ke AI. */
export function isUnsure(title, amt) {
  var t = String(title || '');
  var rule = DATA && DATA.catRules && DATA.catRules[titleKey(t)];
  if (rule && catExists(rule)) return false;
  for (var i = 0; i < MERCHANTS.length; i++)
    if (MERCHANTS[i][0].test(t)) return false;
  return true;
}
/* Tawarkan perubahan massal SETELAH satu transaksi diubah. Sengaja bertanya,
   bukan langsung mengubah belasan catatan diam-diam. */
export function offerRecat(title, cat, exceptId) {
  var lain = sameTitle(title, exceptId).filter(function (x) { return x.cat !== cat; });
  if (!lain.length) return;
  var label = catOf(cat).label;
  toast(lain.length + ' transaksi lain bernama "' + title + '"', {
    actionLabel: 'Jadikan ' + label,
    ms: 9000,
    action: function () {
      withUndo(lain.length + ' transaksi jadi ' + label + ' · diingat untuk impor berikutnya',
        function () {
          recatSame(title, cat, exceptId);
          setCatRule(title, cat);
        });
    }
  });
}
