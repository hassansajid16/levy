import { ukCommon as U, ukNations } from '../data/uk.js';
import { applyBrackets } from './brackets.js';

const pos = (n) => Math.max(0, n);

/** Tax on `amount` of income starting at band position `start`, with three band rates. */
function sliceTax(start, amount, limits, rates) {
  const schedule = [[0, rates[0]], [limits[0], rates[1]], [limits[1], rates[2]]];
  return applyBrackets(start + amount, schedule).tax - applyBrackets(start, schedule).tax;
}

export function calcUK(profile, inc) {
  const nation = ukNations.find((n) => n.code === profile.region) || ukNations[0];
  const d = inc.deductions || {};
  const wages = inc.wages || 0;
  const tradingIncome = inc.selfEmployment?.income || 0;
  const tradingExpenses = inc.selfEmployment?.expenses || 0;
  const usesTradingAllowance = tradingIncome > 0 && U.tradingAllowance > tradingExpenses;
  const tradingProfit = tradingIncome <= U.tradingAllowance ? 0 : pos(tradingIncome - Math.max(tradingExpenses, U.tradingAllowance));
  const interest = inc.interest || 0;
  const dividends = inc.dividends || 0;
  const other = inc.otherIncome || 0;

  const nonSavings = wages + tradingProfit + other;
  const total = nonSavings + interest + dividends;
  // Relief-at-source pension contributions and Gift Aid: the gross amount (paid ÷ 0.8)
  // reduces adjusted net income and extends the basic-rate band.
  const grossRelief = ((d.retirement || 0) + (d.charity || 0)) / 0.8;
  const adjustedNet = pos(total - grossRelief);
  const pa = pos(U.personalAllowance - pos(adjustedNet - U.allowanceTaperStart) / 2);

  const nsTaxable = pos(nonSavings - pa);
  let paLeft = pos(pa - nonSavings);
  const savTaxable = pos(interest - paLeft);
  paLeft = pos(paLeft - interest);
  const divTaxable = pos(dividends - paLeft);
  const taxable = nsTaxable + savTaxable + divTaxable;

  // Non-savings bands: Scotland's own, otherwise rUK. Extend the band limits by the gross relief.
  const baseBands = nation.bands || U.bands;
  const shiftFrom = nation.bands ? 2 : 1; // Scottish starter band is not extended
  const nsBands = baseBands.map(([lo, r], i) => [i >= shiftFrom ? lo + grossRelief : lo, r]);
  const ns = applyBrackets(nsTaxable, nsBands);

  // Savings and dividends always use UK bands, stacked on top of non-savings income.
  const limits = [U.bands[1][0] + grossRelief, U.bands[2][0] + grossRelief];
  const taxpayerBand = taxable <= limits[0] ? 'basic' : taxable <= limits[1] ? 'higher' : 'additional';
  const psa = U.savings.personalSavingsAllowance[taxpayerBand];
  const startingBand = pos(U.savings.startingRateBand - nsTaxable);
  const savZero = Math.min(savTaxable, startingBand + psa);
  const savTax = sliceTax(nsTaxable + savZero, savTaxable - savZero, limits, U.savings.rates);
  const divZero = Math.min(divTaxable, U.dividends.allowance);
  const divTax = sliceTax(nsTaxable + savTaxable + divZero, divTaxable - divZero, limits, U.dividends.rates);
  const incomeTax = ns.tax + savTax + divTax;

  const c1 = U.ni.class1;
  const ni1 = pos(Math.min(wages, c1.upperEarningsLimit) - c1.primaryThreshold) * c1.mainRate + pos(wages - c1.upperEarningsLimit) * c1.upperRate;
  const c4 = U.ni.class4;
  const ni4 = pos(Math.min(tradingProfit, c4.upperProfitsLimit) - c4.lowerProfitsLimit) * c4.mainRate + pos(tradingProfit - c4.upperProfitsLimit) * c4.upperRate;

  const bandNames = nation.bandNames || ['Basic', 'Higher', 'Additional'];
  const parts = ns.parts.map((p, i) => ({ ...p, label: bandNames[i] }));
  const marginalNs = ns.marginal;
  // The allowance taper makes the effective marginal rate 60% (rUK) between £100k and £125,140.
  const inTaper = adjustedNet > U.allowanceTaperStart && pa > 0;

  const lines = [{
    id: 'uk-income-tax', name: nation.bands ? 'Income tax (Scottish rates)' : 'Income tax', level: 'national', jurisdiction: nation.name,
    amount: incomeTax, base: taxable, baseLabel: 'Taxable income', marginal: inTaper ? marginalNs * 1.5 : marginalNs, parts,
    taxYear: U.taxYear, sources: nation.sources.concat(U.sources.slice(2)),
    details: [
      ['Personal allowance', pa],
      ['Tax on earnings and other income', ns.tax],
      ...(interest > 0 ? [['Tax on savings interest', savTax], ['Savings at 0% (starting rate and allowance)', savZero]] : []),
      ...(dividends > 0 ? [['Tax on dividends', divTax], ['Dividend allowance used', divZero]] : []),
    ],
  }];
  if (wages > 0) lines.push({
    id: 'uk-ni1', name: 'National Insurance (Class 1)', level: 'social', jurisdiction: 'United Kingdom', amount: ni1, base: wages, baseLabel: 'Earnings',
    taxYear: U.taxYear, sources: [U.sources[1]], withheldOnWages: true,
    details: [['8% between £12,570 and £50,270', pos(Math.min(wages, c1.upperEarningsLimit) - c1.primaryThreshold) * c1.mainRate], ['2% above £50,270', pos(wages - c1.upperEarningsLimit) * c1.upperRate]],
  });
  if (tradingProfit > 0) lines.push({
    id: 'uk-ni4', name: 'National Insurance (Class 4)', level: 'social', jurisdiction: 'United Kingdom', amount: ni4, base: tradingProfit, baseLabel: 'Trading profit',
    taxYear: U.taxYear, sources: [U.sources[1]],
    details: [['6% between £12,570 and £50,270', pos(Math.min(tradingProfit, c4.upperProfitsLimit) - c4.lowerProfitsLimit) * c4.mainRate], ['2% above £50,270', pos(tradingProfit - c4.upperProfitsLimit) * c4.upperRate]],
  });

  const deductionsUsed = [
    { label: 'Personal allowance', amount: pa, kind: 'Allowance' },
    ...(usesTradingAllowance ? [{ label: 'Trading allowance (instead of expenses)', amount: Math.min(tradingIncome, U.tradingAllowance), kind: 'Allowance' }] : []),
    ...(!usesTradingAllowance && tradingExpenses > 0 ? [{ label: 'Allowable business expenses', amount: tradingExpenses, kind: 'Expense' }] : []),
    ...(grossRelief > 0 ? [{ label: 'Pension and Gift Aid (gross, extends basic band)', amount: grossRelief, kind: 'Relief' }] : []),
    ...(savZero > 0 ? [{ label: 'Savings at 0%', amount: savZero, kind: 'Allowance' }] : []),
    ...(divZero > 0 ? [{ label: 'Dividend allowance', amount: divZero, kind: 'Allowance' }] : []),
  ];

  return {
    lines, deductionsUsed,
    totalIncome: total, taxableIncome: taxable, taxableLabel: 'Taxable income',
    sales: { name: 'VAT', rate: U.vat.standard, source: U.vatSource, note: 'Standard-rated spending only. Most food, children’s clothes and books are zero-rated; domestic energy is 5%.' },
    notes: [...U.notes, ...(nation.notes || []), ...(inTaper ? ['Your income is in the personal allowance taper, which makes the marginal rate higher than the band rate.'] : [])],
    taxYearLabel: U.taxYearLabel,
  };
}
