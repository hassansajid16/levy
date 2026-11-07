const cache = new Map();
function nf(locale, currency, digits) {
  const key = `${locale}|${currency}|${digits}`;
  if (!cache.has(key)) {
    cache.set(key, new Intl.NumberFormat(locale, currency
      ? { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  }
  return cache.get(key);
}

export const makeFormat = (locale, currency) => ({
  /** Whole units: £12,345 */
  money: (n) => nf(locale, currency, 0).format(Math.round(n) === 0 ? 0 : Math.round(n)),
  /** Two decimals: £12,345.67 */
  cents: (n) => nf(locale, currency, 2).format(n),
  pct: (n, digits = 1) => `${nf(locale, null, digits).format(n * 100)}%`,
  rate: (r) => { const p = r * 100; const d = [0, 1, 2, 3].find((k) => Math.abs(Math.round(p * 10 ** k) / 10 ** k - p) < 1e-7) ?? 3; return `${nf(locale, null, d).format(p)}%`; },
  date: (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  shortDate: (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  int: (n) => nf(locale, null, 0).format(n),
});
