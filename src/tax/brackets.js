// Bracket maths shared by every jurisdiction.
// A schedule is an ascending list of [threshold, rate]: `rate` applies to income above
// `threshold` up to the next threshold. The first threshold is always 0.

export function applyBrackets(income, schedule) {
  const parts = [];
  let tax = 0;
  const taxable = Math.max(0, income);
  for (let i = 0; i < schedule.length; i++) {
    const [lo, rate] = schedule[i];
    const hi = i + 1 < schedule.length ? schedule[i + 1][0] : Infinity;
    if (taxable <= lo) break;
    const amount = Math.min(taxable, hi) - lo;
    const t = amount * rate;
    tax += t;
    parts.push({ from: lo, to: hi === Infinity ? null : hi, rate, amount, tax: t });
  }
  return { tax, parts, marginal: marginalRate(taxable, schedule) };
}

/** Rate on the next unit of income. */
export function marginalRate(income, schedule) {
  let rate = schedule[0][1];
  for (const [lo, r] of schedule) if (income >= lo) rate = r; // income exactly at a threshold: next unit is taxed at that bracket
  return rate;
}

/** Scale every threshold (e.g. married-joint brackets that are exactly double). */
export function scaleSchedule(schedule, factor) {
  return schedule.map(([lo, r]) => [lo * factor, r]);
}

/** Tax on a slice of income that sits on top of `below` (for stacking, e.g. dividends). */
export function stackedTax(below, slice, schedule) {
  return applyBrackets(below + slice, schedule).tax - applyBrackets(below, schedule).tax;
}

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
