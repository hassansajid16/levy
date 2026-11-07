// The estimate engine: one entry point for every country.
//
// Every country calculator takes (profile, income) and returns
//   { lines, deductionsUsed, totalIncome, taxableIncome, taxableLabel, sales, notes, taxYearLabel }
// where each line is one tax: { id, name, level: 'national'|'state'|'local'|'social', amount, base,
// marginal?, parts? (brackets applied), details?, taxYear, sources, withheldOnWages? }.

import { calcUS } from './us.js';
import { calcUK } from './uk.js';
import { calcCA } from './ca.js';
import { calcAU } from './au.js';
import { countryByCode } from '../data/registry.js';
import { calcGeneric } from './generic.js';
import { worldByCode } from '../data/world.js';

/**
 * @typedef {Object} IncomeInput
 * @property {number} [wages]               gross salary and wages
 * @property {{income:number, expenses:number}} [selfEmployment]
 * @property {number} [interest]
 * @property {number} [dividends]
 * @property {number} [otherIncome]
 * @property {{retirement?:number, charity?:number, studentLoanInterest?:number, mortgageInterest?:number, medical?:number, workExpenses?:number}} [deductions]
 * @property {number} [withheld]            tax and contributions already deducted from pay
 * @property {number} [prepaid]             estimated or instalment payments made to the tax authority
 * @property {number} [taxableSpend]        spending in categories that carry sales tax or VAT
 */

const calculators = { US: calcUS, GB: calcUK, CA: calcCA, AU: calcAU };

function run(profile, inc) {
  const calc = calculators[profile.country] || (worldByCode[profile.country] && ((p, i) => calcGeneric(worldByCode[p.country], p, i)));
  if (!calc) throw new Error(`No calculator for country ${profile.country}`);
  const res = calc(profile, inc);
  const totalTax = res.lines.reduce((a, l) => a + l.amount, 0);
  return { ...res, totalTax };
}

/** Tax and contributions an employer would deduct on these wages alone. */
export function taxOnWagesAlone(profile, wages) {
  return wages > 0 ? run(profile, { wages }).totalTax : 0;
}

/**
 * Bank statements show take-home pay. Find the gross salary whose deductions leave `net`,
 * assuming the employer withheld as if the salary were the only income.
 */
export function grossUpFromNet(profile, net) {
  if (net <= 0) return { gross: 0, withheld: 0 };
  let lo = net, hi = net * 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid - taxOnWagesAlone(profile, mid) < net) lo = mid; else hi = mid;
  }
  const gross = Math.round(hi * 100) / 100;
  return { gross, withheld: Math.round((gross - net) * 100) / 100 };
}

/** Full estimate with totals, rates and the balance due or refund. */
export function estimate(profile, inc) {
  const res = run(profile, inc);
  const country = countryByCode[profile.country];
  const step = 1000;
  // Marginal rate measured, not looked up: how much of the next 1,000 of pay goes in tax.
  const bumped = inc.wages > 0 || !(inc.selfEmployment?.income > 0)
    ? { ...inc, wages: (inc.wages || 0) + step }
    : { ...inc, selfEmployment: { ...inc.selfEmployment, income: inc.selfEmployment.income + step } };
  const marginalRate = (run(profile, bumped).totalTax - res.totalTax) / step;
  const marginalOn = inc.wages > 0 || !(inc.selfEmployment?.income > 0) ? 'salary' : 'self-employed income';

  const withheld = inc.withheld || 0;
  const prepaid = inc.prepaid || 0;
  const balance = res.totalTax - withheld - prepaid; // positive: to pay; negative: refund

  let consumption = null;
  if (res.sales && inc.taxableSpend > 0) {
    consumption = { ...res.sales, spend: inc.taxableSpend, estimate: (inc.taxableSpend * res.sales.rate) / (1 + res.sales.rate) };
  } else if (res.sales) {
    consumption = { ...res.sales, spend: 0, estimate: 0 };
  }

  const sources = [];
  const seen = new Set();
  for (const l of res.lines) for (const s of l.sources || []) if (!seen.has(s.url)) { seen.add(s.url); sources.push({ ...s, taxYear: l.taxYear }); }
  if (consumption?.source && !seen.has(consumption.source.url)) sources.push(consumption.source);

  return {
    ...res,
    currency: country.currency,
    locale: country.locale,
    effectiveRate: res.totalIncome > 0 ? res.totalTax / res.totalIncome : 0,
    marginalRate, marginalOn, step,
    withheld, prepaid, balance,
    consumption, sources,
  };
}
