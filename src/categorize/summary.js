// Turn categorised transactions into the engine's IncomeInput.
import { categoryById } from './categories.js';

const r2 = (n) => Math.round(n * 100) / 100;

export function inWindow(tx, window) {
  return !window || (tx.date >= window.start && tx.date <= window.end);
}

/**
 * @returns {{ input: object, totals: Record<string, number>, counts: Record<string, number>, inYear: number, outOfYear: number }}
 */
export function summarize(transactions, { window } = {}) {
  const totals = {};
  const counts = {};
  let inYear = 0, outOfYear = 0;
  for (const t of transactions) {
    if (!inWindow(t, window)) { outOfYear++; continue; }
    inYear++;
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
    counts[t.category] = (counts[t.category] || 0) + 1;
  }
  const input = { selfEmployment: { income: 0, expenses: 0 }, deductions: {} };
  for (const [cat, amount] of Object.entries(totals)) {
    const feeds = categoryById[cat]?.feeds;
    if (!feeds) continue;
    const [a, b] = feeds.split('.');
    if (b) input[a][b] = r2((input[a][b] || 0) + amount);
    else input[a] = r2((input[a] || 0) + amount);
  }
  for (const k of Object.keys(totals)) totals[k] = r2(totals[k]);
  return { input, totals, counts, inYear, outOfYear };
}
