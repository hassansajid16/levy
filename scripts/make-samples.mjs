// Writes sample statements into samples/ so the upload flow can be tried with real files:
//   node scripts/make-samples.mjs
// All names and amounts are invented.
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateSample, sampleCSV } from '../src/sample/generate.js';

const dir = new URL('../samples/', import.meta.url);
mkdirSync(dir, { recursive: true });
const write = (name, data) => { writeFileSync(new URL(name, dir), data); console.log('wrote samples/' + name); };

// CSV, one per country, single signed amount column.
for (const c of ['US', 'GB', 'CA', 'AU']) write(`sample-${c.toLowerCase()}.csv`, sampleCSV(c));

// A CSV in the "Money out / Money in" layout many UK banks export.
{
  const rows = generateSample('GB', 77).slice(0, 120);
  const lines = ['Transaction Date,Transaction Type,Transaction Description,Debit Amount,Credit Amount,Balance'];
  let bal = 3100;
  for (const r of rows) {
    bal += r.amount;
    const [y, m, d] = r.date.split('-');
    lines.push(`${d}/${m}/${y},${r.amount < 0 ? 'DEB' : 'BGC'},${r.description},${r.amount < 0 ? (-r.amount).toFixed(2) : ''},${r.amount > 0 ? r.amount.toFixed(2) : ''},${bal.toFixed(2)}`);
  }
  write('sample-gb-debit-credit.csv', lines.join('\r\n'));
}

// OFX 1.x (SGML) for the US sample.
{
  const rows = generateSample('US');
  const tx = rows.map((r, i) => `<STMTTRN>\n<TRNTYPE>${r.amount < 0 ? 'DEBIT' : 'CREDIT'}\n<DTPOSTED>${r.date.replace(/-/g, '')}120000\n<TRNAMT>${r.amount.toFixed(2)}\n<FITID>S${1000 + i}\n<NAME>${r.description.slice(0, 32).replace(/&/g, '&amp;')}\n</STMTTRN>`).join('\n');
  write('sample-us.ofx', `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>USD\n<BANKTRANLIST>\n<DTSTART>20250101\n<DTEND>20251231\n${tx}\n</BANKTRANLIST>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n`);
}

// A text-based PDF statement (UK layout: Date | Description | Paid out | Paid in | Balance).
{
  const rows = generateSample('GB', 9).slice(0, 90);
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const perPage = 40;
  const pages = [];
  let bal = 2500;
  for (let p = 0; p * perPage < rows.length; p++) {
    const ops = ['BT /F1 14 Tf 40 800 Td (Larchmere Bank - Everyday account statement 2025) Tj ET'];
    const head = [[40, 'Date'], [110, 'Description'], [370, 'Paid out'], [440, 'Paid in'], [510, 'Balance']];
    for (const [x, t] of head) ops.push(`BT /F1 9 Tf ${x} 770 Td (${t}) Tj ET`);
    if (p === 0) ops.push(`BT /F1 9 Tf 110 755 Td (Balance brought forward) Tj ET`, `BT /F1 9 Tf 510 755 Td (${bal.toFixed(2)}) Tj ET`);
    rows.slice(p * perPage, (p + 1) * perPage).forEach((r, i) => {
      const y = 740 - i * 17;
      bal += r.amount;
      const [yy, mm, dd] = r.date.split('-');
      const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mm - 1];
      ops.push(`BT /F1 9 Tf 40 ${y} Td (${dd} ${mon} ${yy}) Tj ET`);
      ops.push(`BT /F1 9 Tf 110 ${y} Td (${esc(r.description.slice(0, 44))}) Tj ET`);
      ops.push(`BT /F1 9 Tf ${r.amount < 0 ? 370 : 440} ${y} Td (${Math.abs(r.amount).toFixed(2)}) Tj ET`);
      ops.push(`BT /F1 9 Tf 510 ${y} Td (${bal.toFixed(2)}) Tj ET`);
    });
    pages.push(ops.join('\n'));
  }
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((content, i) => {
    const id = 4 + i * 2;
    objs[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objs[id + 1] = `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = Buffer.byteLength(pdf); pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  write('sample-gb-statement.pdf', pdf);
}
