/* Halaman palsu bentuk keluaran pdfLines() untuk e-statement GoPay. Tata letak (kolom x, baris
   kedua = jam + sambungan ID, metode campuran di baris terpisah yang sedikit lebih tinggi/rendah)
   meniru berkas asli. SEMUA data di sini fiktif — berkas asli berisi data pribadi dan tidak
   boleh ada di repo. */
var L = (y, cols) => ({ y, cols: cols.map(([x, s]) => ({ x, s })), text: cols.map(c => c[1]).join(' ') });

function record(base, r) {
  var out = [];
  var first = [[21, r.date], [95, r.title[0]], [267, r.id[0]]];
  var mixed = r.methods.length > 1;
  if (!mixed) first.push([396, r.methods[0]]);
  if (r.amt) first.push([r.amt.length > 6 ? 535 : 565, r.amt]);
  out.push(L(base, first));
  if (mixed) {
    out.push(L(base - 1.5, [[406, r.methods[0]]]));
    out.push(L(base - 14.5, [[381, r.methods[1]]]));
  }
  var second = [[21, r.time], [267, r.id[1]]];
  if (r.title[1]) second.push([95, r.title[1]]);
  out.push(L(base - 11.5, second));
  return out;
}

var TABLE_HEAD = L(679, [[21, 'Tanggal'], [95, 'Transaksi'], [267, 'ID transaksi'], [381, 'Metode pembayaran'], [507, 'Jumlah']]);

export var RECORDS = [
  { date: '30/09/2026', time: '19:53', title: ['Warung Contoh Satu'], id: ['0520260930AAAA1111bb', 'ccDDID'], methods: ['Tabungan by Jago'], amt: '-Rp25.000' },
  { date: '29/09/2026', time: '12:10', title: ['Kedai Mix Pembayaran, Cabang', 'Dua'], id: ['0420260929XXXX2222yy', 'zzEEID'], methods: ['GoPay Coins', 'GoPay Later'], amt: '-Rp40.000' },
  { date: '28/09/2026', time: '12:10', title: ['Cashback Kedai Mix'], id: ['0120260928QQQQ3333rr', 'ssFFID'], methods: ['GoPay Coins'], amt: '15' },
  { date: '27/09/2026', time: '09:00', title: ['GoPay Tabungan top up'], id: ['0220260927TTTT4444uu', 'vvGGID'], methods: ['Tabungan by Jago'], amt: 'Rp100.000' },
  { date: '26/09/2026', time: '08:30', title: ['GoTagihan'], id: ['0320260926HHHH5555ii', 'jjKKID'], methods: ['Tabungan by Jago'], amt: '-Rp300.000' },
  { date: '25/09/2026', time: '05:24', title: ['Bunga'], id: ['0720260925MMMM6666nn', 'ooLLID'], methods: ['Tabungan by Jago'], amt: 'Rp20' },
  { date: '25/09/2026', time: '05:24', title: ['Pajak atas bunga'], id: ['0720260925PPPP7777qq', 'rrNNID'], methods: ['Tabungan by Jago'], amt: '-Rp4' },
  { date: '24/09/2026', time: '17:41', title: ['Toko Online Contoh'], id: ['0520260924WWWW8888xx', 'yyOOID'], methods: ['GoPay Later'], amt: '-Rp60.000' },
  { date: '23/09/2026', time: '10:00', title: ['Hadiah kartu gosok'], id: ['0520260923RRRR9999ss', 'ttPPID'], methods: ['GoPay Coins'], amt: '25' }
];
/* header yang konsisten: coins dipakai 40 (hanya contoh), pemasukan = 100.000 + 20,
   pengeluaran = (25.000 + 40.000 + 300.000 + 4 + 60.000) - 40 */
export var TOTALS = { coinsEarned: 40, coinsUsed: 40, pemasukan: 'Rp100.020', pengeluaran: 'Rp424.964' };

export function makePages(opts) {
  opts = opts || {};
  var t = Object.assign({}, TOTALS, opts.totals || {});
  var page1 = [
    L(806.5, [[179, 'Halaman 1 dari 2'], [327, 'Periode transaksi'], [400, ': 1 September 2026 - 30 September 2026']]),
    L(806, [[86, 'E-statement']]),
    L(752.5, [[248, 'Total Coins didapatkan'], [343, 'Total Coins dipakai'], [426, 'Total pemasukan'], [504, 'Total pengeluaran']]),
    L(737.5, [[276, String(t.coinsEarned)], [365, String(t.coinsUsed)], [428, t.pemasukan], [507, t.pengeluaran]]),
    TABLE_HEAD
  ];
  var page2 = [L(806, [[86, 'E-statement']]), TABLE_HEAD];
  RECORDS.forEach(function (r, i) {
    var target = i < 5 ? page1 : page2;
    Array.prototype.push.apply(target, record(i < 5 ? 648 - i * 70 : 648 - (i - 5) * 70, r));
  });
  return [{ lines: page1 }, { lines: page2 }];
}
