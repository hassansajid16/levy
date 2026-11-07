// Shared helpers for turning statement text into transactions.
// A transaction is { id, date: 'YYYY-MM-DD', description, amount, source }
// where amount is signed: money in is positive, money out negative.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
};

/**
 * Parse a date in any common statement format. `order` ('MDY' | 'DMY' | 'YMD') breaks ties
 * for numeric dates such as 03/04/2025.
 */
export function parseDate(text, order = 'DMY') {
  if (!text) return null;
  const s = String(text).trim().replace(/\s+/g, ' ');
  let m;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return iso(+m[1], +m[2], +m[3]); // OFX 20250131120000
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/., ]+(\d{2,4})/))) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)];
    return mo ? iso(+m[3], mo, +m[1]) : null;
  }
  if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{2,4})/))) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    return mo ? iso(+m[3], mo, +m[2]) : null;
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    const a = +m[1], b = +m[2], y = +m[3];
    if (a > 12) return iso(y, b, a);
    if (b > 12) return iso(y, a, b);
    return order === 'MDY' ? iso(y, a, b) : iso(y, b, a);
  }
  return null;
}

/** Guess the numeric date order from a column of dates: a first part over 12 means DMY. */
export function inferDateOrder(samples, fallback = 'DMY') {
  let dmy = 0, mdy = 0;
  for (const s of samples) {
    const m = String(s).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  if (dmy > mdy) return 'DMY';
  if (mdy > dmy) return 'MDY';
  return fallback;
}

/** "−1,234.56", "(1,234.56)", "1.234,56", "$1,234.56 CR", "45.00-" → number. */
export function parseAmount(text) {
  if (text == null) return null;
  let s = String(text).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (/\bDR\b|\bdebit\b/i.test(s)) negative = true;
  const credit = /\bCR\b/i.test(s);
  s = s.replace(/\b(CR|DR)\b/gi, '').replace(/[A-Za-z$£€¥₹\s]/g, '');
  if (/^[-−–]/.test(s)) { negative = !negative; s = s.slice(1); }
  if (/[-−–]$/.test(s)) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith('+')) s = s.slice(1);
  // Decimal comma: "1.234,56" or "12,50"
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return credit ? Math.abs(n) : negative ? -n : n;
}

export function cleanDescription(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

let seq = 0;
export function makeId(prefix = 'tx') {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

/** Remove exact duplicates (same date, amount and description), e.g. overlapping statements. */
export function dedupe(transactions) {
  const seen = new Set();
  return transactions.filter((t) => {
    const k = `${t.date}|${t.amount.toFixed(2)}|${t.description.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
