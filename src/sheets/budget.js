import { render } from '../app/render.js';
import { budgetFor, budgetIsOverride } from '../core/budget.js';
import { catOf } from '../core/categories.js';
import { ymLabel } from '../core/dates.js';
import { catSpend } from '../core/derived.js';
import { fmtRp } from '../core/money.js';
import { DATA, save, withUndo } from '../core/store.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { UI, el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';

/* ==================== SHEET: SATU ANGGARAN ==================== */
export function sheetBudget(k) {
  var c = catOf(k), ym = UI.ym;
  openSheet('Anggaran ' + c.label, function (bd) {
    bd.id = 'budget-sheet';
    bd.dataset.cat = k;
    var used = catSpend(ym)[k] || 0;
    var lim = budgetFor(k, ym);

    var info = el('div', 'tiny mut');
    info.style.margin = '0 0 14px';
    info.textContent = 'Terpakai ' + fmtRp(used) + ' dari ' + fmtRp(lim) +
      ' di ' + ymLabel(ym) + (lim > 0 && used > lim ? ' · sudah lewat ' + fmtRp(used - lim) : '');
    bd.appendChild(info);

    var f = el('div', 'fld');
    f.appendChild(el('label', null, 'Batas per bulan'));
    var inp = el('input', 'inp money');
    inp.id = 'budget-sheet-amt';
    attachMoney(inp, lim);
    f.appendChild(inp);
    bd.appendChild(f);

    var ovOn = budgetIsOverride(k, ym);
    var tog = el('button', 'btn-sm' + (ovOn ? '' : ' plain'));
    tog.id = 'budget-sheet-override';
    tog.style.cssText = 'width:100%;padding:11px';
    tog.setAttribute('aria-pressed', ovOn ? 'true' : 'false');
    tog.textContent = ovOn ? 'Khusus ' + ymLabel(ym) + ' · aktif' : 'Jadikan khusus ' + ymLabel(ym);
    tog.addEventListener('click', function () {
      var v = moneyVal(inp);
      if (ovOn) {
        delete DATA.budgetsMo[ym][k];
        DATA.budgets[k] = v;
      } else {
        if (!DATA.budgetsMo[ym]) DATA.budgetsMo[ym] = {};
        DATA.budgetsMo[ym][k] = v;
      }
      save();
      closeSheet();
      render();
      sheetBudget(k);
    });
    bd.appendChild(tog);
    var hint = el('div', 'tiny mut');
    hint.style.margin = '8px 0 16px';
    hint.textContent = ovOn
      ? 'Bulan lain tetap memakai batas umum ' + fmtRp(DATA.budgets[k] || 0) + '.'
      : 'Sekarang berlaku untuk semua bulan.';
    bd.appendChild(hint);

    var b = el('button', 'btn');
    b.id = 'budget-sheet-save';
    b.textContent = 'Simpan';
    b.addEventListener('click', function () {
      var v = moneyVal(inp);
      closeSheet();
      withUndo('Anggaran ' + c.label + ' jadi ' + fmtRp(v), function () {
        if (budgetIsOverride(k, ym)) DATA.budgetsMo[ym][k] = v;
        else DATA.budgets[k] = v;
      });
    });
    bd.appendChild(b);

    var del = el('button', 'btn ghost');
    del.id = 'budget-sheet-del';
    del.style.cssText = 'margin-top:9px;color:var(--down);border-color:rgba(255,123,143,.35)';
    del.textContent = 'Hapus anggaran ini';
    del.addEventListener('click', function () {
      closeSheet();
      withUndo('Anggaran ' + c.label + ' dihapus', function () {
        delete DATA.budgets[k];
        for (var m in DATA.budgetsMo) delete DATA.budgetsMo[m][k];
      });
    });
    bd.appendChild(del);
  });
}
