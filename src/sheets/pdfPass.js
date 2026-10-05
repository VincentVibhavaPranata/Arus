import { handleImportPDF } from '../importers/index.js';
import { el } from '../ui/nav.js';
import { closeSheet, openSheet } from '../ui/sheet.js';

export function sheetPdfPass(bytes, acct) {
  openSheet('PDF bersandi', function (bd) {
    bd.id = 'pdfpass-body';
    bd.appendChild(el('div', 'tiny mut', 'e-statement ini minta sandi. Biasanya ' +
      'tanggal lahir atau nomor yang dikirim bank bersama berkasnya.'));
    var f = el('div', 'fld');
    f.style.marginTop = '12px';
    f.appendChild(el('label', null, 'Sandi PDF'));
    var p = el('input', 'inp');
    p.id = 'pdfpass';
    p.type = 'password';
    f.appendChild(p);
    bd.appendChild(f);
    var b = el('button', 'btn');
    b.id = 'pdfpass-go';
    b.textContent = 'Buka';
    b.addEventListener('click', function () {
      closeSheet();
      handleImportPDF(bytes, acct, p.value);
    });
    bd.appendChild(b);
  });
}
