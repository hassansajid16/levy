import { parseDate, parseAmount, cleanDescription, inferDateOrder, makeId } from './normalize.js';

/** RFC 4180-style CSV tokenizer with delimiter detection. */
export function tokenizeCSV(text) {
  const src = text.replace(/^﻿/, '');
  const firstLines = src.split(/\r?\n/).slice(0, 10).join('\n');
  const delims = [',', ';', '\t', '|'];
  const delim = delims.map((d) => [d, (firstLines.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const HEADER_PATTERNS = {
  date: /^(transaction |posted |posting |value |trans\.? )?date$|^date posted$|^booking date$/i,
  description: /description|details|narrative|payee|merchant|memo|reference|transaction$|name/i,
  amount: /^(amount|value|transaction amount|amount \(.*\))$/i,
  debit: /debit|withdrawal|money out|paid out|out$/i,
  credit: /credit|deposit|money in|paid in|in$/i,
  balance: /balance/i,
};

/** Find the header row and map column roles. */
export function detectColumns(rows) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r].map((c) => c.trim());
    const map = {};
    cells.forEach((c, i) => {
      if (!c) return;
      if (map.date == null && HEADER_PATTERNS.date.test(c)) map.date = i;
      else if (map.balance == null && HEADER_PATTERNS.balance.test(c)) map.balance = i;
      else if (map.amount == null && HEADER_PATTERNS.amount.test(c)) map.amount = i;
      else if (map.debit == null && HEADER_PATTERNS.debit.test(c)) map.debit = i;
      else if (map.credit == null && HEADER_PATTERNS.credit.test(c)) map.credit = i;
      else if (map.description == null && HEADER_PATTERNS.description.test(c)) map.description = i;
    });
    if (map.date != null && (map.amount != null || map.debit != null || map.credit != null)) {
      if (map.description == null) map.description = cells.findIndex((_, i) => !Object.values(map).includes(i));
      return { headerRow: r, map };
    }
  }
  // No header: guess from the first data row (date, description, amount).
  const first = rows[0] || [];
  const dateIdx = first.findIndex((c) => parseDate(c));
  const amountIdx = first.map((c, i) => [i, parseAmount(c)]).filter(([i, v]) => v != null && i !== dateIdx).map(([i]) => i);
  const descIdx = first.findIndex((c, i) => i !== dateIdx && !amountIdx.includes(i) && /[A-Za-z]/.test(c));
  if (dateIdx >= 0 && amountIdx.length) return { headerRow: -1, map: { date: dateIdx, amount: amountIdx[0], description: descIdx } };
  return null;
}

/**
 * Parse a CSV bank statement.
 * @returns {{ transactions: object[], skipped: number, columns: object }}
 */
export function parseCSV(text, { dateOrder = 'DMY', source = 'CSV' } = {}) {
  const rows = tokenizeCSV(text);
  const found = detectColumns(rows);
  if (!found) throw new Error('Could not find date and amount columns. Export the statement again with a header row (Date, Description, Amount), or download it as OFX instead.');
  const { headerRow, map } = found;
  const data = rows.slice(headerRow + 1);
  const order = inferDateOrder(data.map((r) => r[map.date]), dateOrder);
  const transactions = [];
  let skipped = 0;
  for (const r of data) {
    const date = parseDate(r[map.date], order);
    let amount = null;
    if (map.amount != null) amount = parseAmount(r[map.amount]);
    else {
      const debit = parseAmount(r[map.debit]);
      const credit = parseAmount(r[map.credit]);
      if (debit) amount = -Math.abs(debit);
      else if (credit) amount = Math.abs(credit);
    }
    const description = cleanDescription(map.description >= 0 ? r[map.description] : '');
    if (!date || amount == null || amount === 0) { skipped++; continue; }
    transactions.push({ id: makeId(), date, description: description || '(no description)', amount, source });
  }
  return { transactions, skipped, columns: map };
}
