import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque';
import './styles/index.css';
import { boot } from './app/boot.js';
import { render } from './app/render.js';
import { budgetFor, budgetIsOverride, budgetPct, budgetedCats } from './core/budget.js';
import { catExists, catKeyFor, catOf, catUsage, catsByKind, isDefaultCat, ymRange } from './core/categories.js';
import { ACCTS, KEY, LOCK_KEY, SEP } from './core/constants.js';
import { clampDay, dToS, inputToS, sToD, sToInput, sYm, todayS, ymAdd, ymLabel } from './core/dates.js';
import { acctAtEnd, acctBalances, addCheckpoint, allItems, anchorAcct, cashTotal, catSpend, cpAll, cpDiff, cpLatest, dayTotal, findItem, monthDays, monthTotals } from './core/derived.js';
import { digits, fmtRp, fmtRpShort, fmtRpSign, grp } from './core/money.js';
import { isNative } from './core/native.js';
import { adjTotal, allocPct, assetClass, assetsTotal, cashAtEnd, cashSeries, classRows, classTotal, contribCount, contribTotal, liabTotal, networthTotal, targetTotal } from './core/networth.js';
import { DATA, addItem, blankData, load, migrate, normTargets, removeItem, restore, save, seedDemo, setData, snapshot, sortDays, updateItem, withUndo } from './core/store.js';
import { isAcct, isClassKey, isInvestFlow, isTf, legLabel, mkTfAcct, tfKind, tfLabel, tfLegs } from './core/transfer.js';
import { auditData, auditFix } from './features/audit.js';
import { backupStats, buildCSV, buildJSON, csvEscape, downloadText, parseBackup } from './features/backup.js';
import { guessCat, offerRecat, recatSame, sameTitle, setCatRule, titleKey } from './features/categorize.js';
import { LOCK_COOLDOWN_MS, LOCK_FAIL_MAX, hasSubtle, hashEq, lockClear, lockCooldownLeft, lockDerive, lockEnabled, lockLoad, lockSave, lockSet, lockTry, simpleHash } from './features/lock.js';
import { recDueDate, recPending, recPost, recSkip, runAutoRecurring } from './features/recurring.js';
import { commitStaging, dedupKey, existingCounts, mkStageRow, restage, stagingStats } from './features/staging.js';
import { syncApply, syncCfg, syncFetch, syncOn, syncPayload, syncPull, syncPush, syncUrl } from './features/sync.js';
import { fmtPF, fmtR, tradePnl, tradeStats, tradesClosed, tradesOpen } from './features/trading.js';
import { bcaClassify, bcaResolveDate, bcaSplitGlue, bcaYearCtx, cleanBCADesc, detectSource, parseBCA } from './importers/bca.js';
import { bcaPdfCol, parseBCAPdf } from './importers/bcaPdf.js';
import { parseTxCSV } from './importers/csvTx.js';
import { findHeaderRow, normThousands, parseDateS, parseMoney, parseVal, sniffDelim, splitCSVLine, splitLines } from './importers/csvUtils.js';
import { applyFolio, folioPlan, parseFolioCSV } from './importers/folio.js';
import { handleImportPDF, handleImportText, parseImport, stageRows } from './importers/index.js';
import { latin1ToU8, pdfCrypto, pdfInflate, pdfLines, pdfLitBytes, pdfScanObjects, pdfTextItems, u8ToLatin1 } from './importers/pdfReader.js';
import { SAMPLE_BYBIT, SAMPLE_GOPAY, parseBybit, parseGoPay } from './importers/simulasi.js';
import { sheetAcctStart } from './pages/akun.js';
import { matchTx, renderTxList, txCount, txFiltered } from './pages/transaksi.js';
import { sheetAudit } from './sheets/audit.js';
import { sheetBackup } from './sheets/backup.js';
import { sheetBudget } from './sheets/budget.js';
import { sheetCats } from './sheets/cats.js';
import { sheetConflict } from './sheets/conflict.js';
import { sheetFolio } from './sheets/folio.js';
import { sheetGoal } from './sheets/goal.js';
import { sheetHistory } from './sheets/history.js';
import { sheetPaste, sheetStage } from './sheets/importStage.js';
import { sheetAi } from './sheets/ai.js';
import { sheetLock } from './sheets/lock.js';
import { showOnboarding } from './sheets/onboarding.js';
import { sheetRecurring } from './sheets/recurring.js';
import { resetAll, sheetReset } from './sheets/reset.js';
import { sheetSync } from './sheets/sync.js';
import { sheetClose, sheetTrade } from './sheets/trade.js';
import { sheetTx } from './sheets/tx.js';
import { showLock } from './ui/lockScreen.js';
import { moneyVal } from './ui/moneyInput.js';
import { UI, go } from './ui/nav.js';
import { closeSheet, openSheet } from './ui/sheet.js';
import { toast } from './ui/toast.js';

/* --- API untuk suite tes (test2.js). Hanya membaca/menulis lewat jalur yang
   sama dengan UI; tidak ada logika khusus tes. --- */
window.Arus = {
  KEY: KEY, LOCK_KEY: LOCK_KEY, ACCTS: ACCTS, SEP: SEP,
  get DATA() { return DATA; },
  get UI()   { return UI; },
  /* util */
  todayS: todayS, dToS: dToS, sToD: sToD, sYm: sYm, ymAdd: ymAdd, ymLabel: ymLabel,
  sToInput: sToInput, inputToS: inputToS, clampDay: clampDay,
  fmtRp: fmtRp, fmtRpSign: fmtRpSign, fmtRpShort: fmtRpShort, grp: grp, digits: digits,
  /* transfer */
  isTf: isTf, tfLegs: tfLegs, mkTfAcct: mkTfAcct, tfKind: tfKind,
  isInvestFlow: isInvestFlow, isAcct: isAcct, isClassKey: isClassKey,
  legLabel: legLabel, tfLabel: tfLabel,
  contribTotal: contribTotal, contribCount: contribCount, adjTotal: adjTotal,
  /* derived */
  allItems: allItems, findItem: findItem, monthDays: monthDays, monthTotals: monthTotals,
  dayTotal: dayTotal, catSpend: catSpend, acctBalances: acctBalances, cashTotal: cashTotal,
  budgetFor: budgetFor, budgetIsOverride: budgetIsOverride, budgetedCats: budgetedCats,
  budgetPct: budgetPct,
  /* net worth */
  assetClass: assetClass, classRows: classRows, classTotal: classTotal,
  assetsTotal: assetsTotal, liabTotal: liabTotal, networthTotal: networthTotal,
  allocPct: allocPct, targetTotal: targetTotal, normTargets: normTargets,
  cashAtEnd: cashAtEnd, cashSeries: cashSeries, sheetAcctStart: sheetAcctStart,
  /* impor */
  splitCSVLine: splitCSVLine, sniffDelim: sniffDelim, normThousands: normThousands,
  parseVal: parseVal, parseMoney: parseMoney, findHeaderRow: findHeaderRow,
  splitLines: splitLines, parseDateS: parseDateS, guessCat: guessCat,
  dedupKey: dedupKey, restage: restage, stagingStats: stagingStats,
  existingCounts: existingCounts,
  commitStaging: commitStaging, parseTxCSV: parseTxCSV, mkStageRow: mkStageRow,
  detectSource: detectSource, parseBCA: parseBCA, parseImport: parseImport,
  /* PDF */
  pdfLines: pdfLines, pdfTextItems: pdfTextItems, pdfInflate: pdfInflate,
  pdfScanObjects: pdfScanObjects, pdfCrypto: pdfCrypto, pdfLitBytes: pdfLitBytes,
  u8ToLatin1: u8ToLatin1, latin1ToU8: latin1ToU8,
  parseBCAPdf: parseBCAPdf, bcaPdfCol: bcaPdfCol, bcaClassify: bcaClassify,
  handleImportPDF: handleImportPDF,
  cleanBCADesc: cleanBCADesc, bcaYearCtx: bcaYearCtx, bcaResolveDate: bcaResolveDate,
  bcaSplitGlue: bcaSplitGlue,
  parseGoPay: parseGoPay, parseBybit: parseBybit, stageRows: stageRows,
  /* rutin & cadangan */
  recDueDate: recDueDate, recPending: recPending, recPost: recPost, recSkip: recSkip,
  runAutoRecurring: runAutoRecurring, sheetRecurring: sheetRecurring, sheetBackup: sheetBackup,
  /* trading */
  tradesClosed: tradesClosed, tradesOpen: tradesOpen, tradeStats: tradeStats,
  tradePnl: tradePnl, fmtR: fmtR, fmtPF: fmtPF,
  sheetTrade: sheetTrade, sheetClose: sheetClose,
  /* sinkronisasi */
  syncCfg: syncCfg, syncOn: syncOn, syncPayload: syncPayload, syncUrl: syncUrl,
  syncFetch: syncFetch, syncPush: syncPush, syncPull: syncPull, syncApply: syncApply,
  sheetSync: sheetSync, sheetConflict: sheetConflict, sheetHistory: sheetHistory,
  /* kunci */
  lockLoad: lockLoad, lockSave: lockSave, lockClear: lockClear, lockEnabled: lockEnabled,
  lockSet: lockSet, lockTry: lockTry, lockDerive: lockDerive, lockCooldownLeft: lockCooldownLeft,
  hasSubtle: hasSubtle, simpleHash: simpleHash, hashEq: hashEq,
  showLock: showLock, sheetLock: sheetLock, sheetAi: sheetAi,
  LOCK_FAIL_MAX: LOCK_FAIL_MAX, LOCK_COOLDOWN_MS: LOCK_COOLDOWN_MS,
  csvEscape: csvEscape, buildCSV: buildCSV, buildJSON: buildJSON,
  parseBackup: parseBackup, backupStats: backupStats, migrate: migrate,
  auditData: auditData, auditFix: auditFix, sheetAudit: sheetAudit,
  showOnboarding: showOnboarding, resetAll: resetAll, sheetReset: sheetReset,
  sheetBudget: sheetBudget, sheetGoal: sheetGoal,
  SAMPLE_GOPAY: SAMPLE_GOPAY, SAMPLE_BYBIT: SAMPLE_BYBIT,
  parseFolioCSV: parseFolioCSV, folioPlan: folioPlan, applyFolio: applyFolio,
  handleImportText: handleImportText, sheetFolio: sheetFolio, sheetStage: sheetStage,
  sheetPaste: sheetPaste,
  catOf: catOf, ymRange: ymRange, catsByKind: catsByKind, catUsage: catUsage,
  /* ingatan kategori & titik periksa saldo */
  titleKey: titleKey, sameTitle: sameTitle, setCatRule: setCatRule,
  recatSame: recatSame, offerRecat: offerRecat,
  acctAtEnd: acctAtEnd, cpDiff: cpDiff, cpAll: cpAll, cpLatest: cpLatest,
  addCheckpoint: addCheckpoint, anchorAcct: anchorAcct,
  catKeyFor: catKeyFor, catExists: catExists, isDefaultCat: isDefaultCat,
  matchTx: matchTx, txFiltered: txFiltered, txCount: txCount,
  /* aksi */
  addItem: addItem, removeItem: removeItem, updateItem: updateItem, withUndo: withUndo,
  save: save, load: load, render: render, go: go,
  snapshot: snapshot, restore: restore, toast: toast, sortDays: sortDays,
  blankData: blankData, seedDemo: seedDemo,
  sheetTx: sheetTx, sheetCats: sheetCats, closeSheet: closeSheet, openSheet: openSheet,
  isNative: isNative, downloadText: downloadText,
  moneyVal: moneyVal, renderTxList: renderTxList,
  reset: function (d) { setData(d || blankData()); save(); render(); }
};

/* Script ini berada SETELAH seluruh markup, jadi kalau rangka sudah ada kita
   boot sekarang — tidak perlu menunggu DOMContentLoaded. */
if (document.getElementById('nav-dasbor')) boot();
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
