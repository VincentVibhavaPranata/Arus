/* ============================ KONSTANTA ============================ */
export var KEY      = 'arus-proto-v1';

// DATA
export var LOCK_KEY = 'arus-lock-v1';

// PIN — TERPISAH, tak ikut ekspor/sync (v0.8)
export var ACCTS = ['GoPay', 'BCA', 'OVO', 'Cash', 'GoPay Later'];
/* Akun yang saldonya MINUS = utang (paylater/kartu kredit), bukan kas. Tidak dihitung ke aset;
   utangnya otomatis masuk ke total Utang. Saldo awalnya diisi sebagai "utang awal". */
export var LIAB_ACCTS = ['GoPay Later'];

export var SEP      = ' → ';

// satu-satunya pemisah kaki transfer
export var TF_CAT   = 'transfer';
