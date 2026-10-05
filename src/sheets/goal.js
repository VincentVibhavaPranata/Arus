import { fmtRp } from '../core/money.js';
import { DATA, withUndo } from '../core/store.js';
import { attachMoney, moneyVal } from '../ui/moneyInput.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';

/* ==================== SHEET: SATU TUJUAN ==================== */
export function sheetGoal(id) {
  var g = null;
  (DATA.goals || []).forEach(function (x) { if (x.id === id) g = x; });
  if (!g) return;
  openSheet(g.name || 'Tujuan', function (bd) {
    bd.id = 'goal-sheet';
    bd.dataset.goal = id;
    var pct = g.target > 0 ? Math.round(g.saved / g.target * 100) : 0;
    var info = el('div', 'tiny mut');
    info.style.margin = '0 0 14px';
    info.textContent = fmtRp(g.saved) + ' dari ' + fmtRp(g.target) + ' · ' + pct + '%' +
      (g.target > g.saved ? ' · kurang ' + fmtRp(g.target - g.saved) : ' · tercapai');
    bd.appendChild(info);

    var f0 = el('div', 'fld');
    f0.appendChild(el('label', null, 'Nama'));
    var nm = el('input', 'inp');
    nm.id = 'goal-sheet-name';
    nm.type = 'text';
    nm.value = g.name || '';
    f0.appendChild(nm);
    bd.appendChild(f0);

    var f1 = el('div', 'fld');
    f1.appendChild(el('label', null, 'Sudah terkumpul'));
    var sv = el('input', 'inp');
    sv.id = 'goal-sheet-saved';
    attachMoney(sv, g.saved);
    f1.appendChild(sv);
    bd.appendChild(f1);

    var f2 = el('div', 'fld');
    f2.appendChild(el('label', null, 'Target'));
    var tg = el('input', 'inp');
    tg.id = 'goal-sheet-target';
    attachMoney(tg, g.target);
    f2.appendChild(tg);
    bd.appendChild(f2);

    var b = el('button', 'btn');
    b.id = 'goal-sheet-save';
    b.textContent = 'Simpan';
    b.addEventListener('click', function () {
      var n = nm.value.trim() || 'Tanpa nama', s = moneyVal(sv), t = moneyVal(tg);
      closeSheet();
      withUndo('Tujuan "' + n + '" diperbarui', function () {
        g.name = n; g.saved = s; g.target = t;
      });
    });
    bd.appendChild(b);

    var del = el('button', 'btn ghost');
    del.id = 'goal-sheet-del';
    del.style.cssText = 'margin-top:9px;color:var(--down);border-color:rgba(255,123,143,.35)';
    del.textContent = 'Hapus tujuan ini';
    del.addEventListener('click', function () {
      closeSheet();
      withUndo('Tujuan "' + g.name + '" dihapus', function () {
        DATA.goals = DATA.goals.filter(function (x) { return x.id !== id; });
      });
    });
    bd.appendChild(del);
  });
}
