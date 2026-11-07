// PDF statements: text is extracted in the browser with PDF.js (served from node_modules by
// server.mjs), rebuilt into lines by position, then read with the heuristics below.
// Scanned (image-only) PDFs have no text layer and are reported as such.
import { parseDate, parseAmount, cleanDescription, makeId } from './normalize.js';

const MONEY = /^[-−(]?[$£€]?\d{1,3}(?:[,\s]?\d{3})*(?:[.,]\d{2})\)?(?:\s?(?:CR|DR|-))?$/i;
const DATE_START = /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{4}-\d{2}-\d{2}|\d{1,2} [A-Za-z]{3,9}(?: \d{2,4})?|[A-Za-z]{3,9}\.? \d{1,2}(?:,? \d{4})?)\b/;

/** Group PDF.js text items into lines of { str, x } sorted left to right. */
export function groupItems(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) { row = { y, cells: [] }; rows.push(row); }
    row.cells.push({ str: it.str.trim(), x: it.transform[4] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => r.cells.sort((a, b) => a.x - b.x));
}

function findColumns(lines) {
  for (const cells of lines) {
    const text = cells.map((c) => c.str.toLowerCase());
    const out = cells.find((c) => /^(paid out|money out|debits?|withdrawals?|out)$/i.test(c.str));
    const inn = cells.find((c) => /^(paid in|money in|credits?|deposits?|in)$/i.test(c.str));
    const bal = cells.find((c) => /^balance/i.test(c.str));
    if ((out || inn) && text.some((t) => /date/.test(t))) return { out: out?.x, in: inn?.x, balance: bal?.x };
  }
  return null;
}

/**
 * Read transactions from positioned lines.
 * @param {{str:string,x:number}[][]} lines
 */
export function parsePdfLines(lines, { dateOrder = 'DMY', year, source = 'PDF' } = {}) {
  const allText = lines.map((l) => l.map((c) => c.str).join(' ')).join('\n');
  const statementYear = year || +(allText.match(/\b(20[2-3]\d)\b/) || [])[1] || new Date().getFullYear();
  const cols = findColumns(lines);
  const transactions = [];
  let prevBalance = null;
  let skipped = 0;

  for (const cells of lines) {
    const text = cells.map((c) => c.str).join(' ');
    if (/balance (brought|carried) forward|opening balance/i.test(text)) {
      const a = cells.map((c) => parseAmount(c.str)).filter((v) => v != null);
      if (a.length) prevBalance = a[a.length - 1];
      continue;
    }
    const dm = text.match(DATE_START);
    if (!dm) continue;
    let dateText = dm[1];
    if (!/\d{4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2}\b/.test(dateText)) dateText = `${dateText} ${statementYear}`;
    const date = parseDate(dateText, dateOrder);
    if (!date) continue;

    const moneyCells = cells.filter((c) => MONEY.test(c.str.replace(/\s/g, '')) && /[.,]\d{2}/.test(c.str));
    if (!moneyCells.length) { skipped++; continue; }
    const descCells = cells.filter((c) => !moneyCells.includes(c));
    const description = cleanDescription(descCells.map((c) => c.str).join(' ').replace(DATE_START, ''));

    let amountCell = moneyCells[0];
    let balance = null;
    if (moneyCells.length >= 2) {
      balance = parseAmount(moneyCells[moneyCells.length - 1].str);
      amountCell = moneyCells[moneyCells.length - 2];
    }
    let amount = parseAmount(amountCell.str);
    if (amount == null) { skipped++; continue; }
    const explicitSign = /^[-−(]|(CR|DR|-)$/i.test(amountCell.str.trim());

    if (!explicitSign) {
      if (cols && (cols.in != null || cols.out != null)) {
        const dIn = cols.in != null ? Math.abs(amountCell.x - cols.in) : Infinity;
        const dOut = cols.out != null ? Math.abs(amountCell.x - cols.out) : Infinity;
        amount = dIn < dOut ? Math.abs(amount) : -Math.abs(amount);
      } else if (balance != null && prevBalance != null) {
        amount = balance >= prevBalance ? Math.abs(amount) : -Math.abs(amount);
      } else {
        amount = -Math.abs(amount); // unknown direction: treat as spending; the user reviews it
      }
    }
    if (balance != null) prevBalance = balance;
    if (amount === 0) continue;
    transactions.push({ id: makeId(), date, description: description || '(no description)', amount, source });
  }
  return { transactions, skipped };
}

let pdfjsPromise;
async function loadPdfJs() {
  pdfjsPromise ||= import('/vendor/pdfjs/pdf.min.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
    return m;
  });
  return pdfjsPromise;
}

/** Browser only: extract positioned text lines from a PDF File/ArrayBuffer. */
export async function extractPdfLines(buffer) {
  let pdfjs;
  try { pdfjs = await loadPdfJs(); } catch {
    throw new Error('The PDF reader is not installed. Run "npm install" once, then reload.');
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    lines.push(...groupItems(content.items));
  }
  if (!lines.length) throw new Error('This PDF has no text layer (it may be a scan). Export a CSV or OFX from your bank instead.');
  return lines;
}

export async function parsePDF(buffer, opts) {
  const lines = await extractPdfLines(buffer);
  return parsePdfLines(lines, { ...opts, source: opts?.source || 'PDF' });
}

export { makeId };
