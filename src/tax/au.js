import { au as A, auStates } from '../data/au.js';
import { applyBrackets } from './brackets.js';

const pos = (n) => Math.max(0, n);

export function lowIncomeTaxOffset(taxable) {
  const l = A.lito;
  if (taxable <= l.firstStart) return l.max;
  if (taxable <= l.secondStart) return pos(l.max - (taxable - l.firstStart) * l.firstRate);
  if (taxable <= l.end) return pos(l.max - (l.secondStart - l.firstStart) * l.firstRate - (taxable - l.secondStart) * l.secondRate);
  return 0;
}

export function medicareLevy(taxable) {
  const m = A.medicare;
  if (taxable <= m.lowIncomeThreshold) return 0;
  return Math.min(taxable * m.rate, (taxable - m.lowIncomeThreshold) * m.shadeInRate);
}

export function calcAU(profile, inc) {
  const state = auStates.find((s) => s.code === profile.region);
  const d = inc.deductions || {};
  const wages = inc.wages || 0;
  const seNet = pos((inc.selfEmployment?.income || 0) - (inc.selfEmployment?.expenses || 0));
  const interest = inc.interest || 0;
  const dividends = inc.dividends || 0;
  const other = inc.otherIncome || 0;
  const total = wages + seNet + interest + dividends + other;
  const deductionList = [
    ['Work-related expenses', d.workExpenses || 0],
    ['Gifts and donations', d.charity || 0],
    ['Personal super contributions (claimed)', d.retirement || 0],
  ].filter(([, v]) => v > 0);
  const taxable = pos(total - deductionList.reduce((a, [, v]) => a + v, 0));
  const it = applyBrackets(taxable, A.brackets);
  const lito = Math.min(lowIncomeTaxOffset(taxable), it.tax);
  const incomeTax = it.tax - lito;
  const medicare = medicareLevy(taxable);

  return {
    lines: [
      {
        id: 'au-income-tax', name: 'Income tax', level: 'national', jurisdiction: 'Australia',
        amount: incomeTax, base: taxable, baseLabel: 'Taxable income', marginal: it.marginal, parts: it.parts,
        taxYear: A.taxYear, sources: [A.sources[0], A.sources[2]],
        details: [['Tax on taxable income', it.tax], ...(lito ? [['Low income tax offset', -lito]] : [])],
      },
      {
        id: 'au-medicare', name: 'Medicare levy', level: 'social', jurisdiction: 'Australia',
        amount: medicare, base: taxable, baseLabel: 'Taxable income', taxYear: A.taxYear, sources: [A.sources[1]],
        details: [['2% of taxable income, reduced below the low-income threshold', medicare]],
      },
    ],
    deductionsUsed: [
      { label: 'Tax-free threshold', amount: Math.min(taxable, 18200), kind: 'Threshold' },
      ...deductionList.map(([label, amount]) => ({ label, amount, kind: 'Deduction' })),
    ],
    totalIncome: total, taxableIncome: taxable, taxableLabel: 'Taxable income',
    sales: { name: 'GST', rate: A.gst, source: A.gstSource, note: 'Most basic food, health and education costs are GST-free.' },
    notes: [...A.notes, ...(state ? [`${state.name} does not levy income tax.`] : [])],
    taxYearLabel: A.taxYearLabel,
  };
}
