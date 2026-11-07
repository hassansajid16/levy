import { usFederal as F } from '../data/us-federal.js';
import { usStateByCode } from '../data/us-states.js';
import { applyBrackets, scaleSchedule, stackedTax } from './brackets.js';

const pos = (n) => Math.max(0, n);

function scheduleFor(brackets, key) {
  const s = brackets[key] ?? brackets.single;
  return typeof s === 'number' ? scaleSchedule(brackets.single, s) : s;
}

/** State income tax for one state. Returns null for states without an income tax on wages. */
export function stateIncomeTax(state, fs, ctx) {
  if (!state || state.none) return null;
  const key = fs === 'mfj' ? 'mfj' : 'single';
  let base = state.base === 'federalTaxable' ? ctx.federalTaxable : state.base === 'gross' ? ctx.grossIncome : ctx.agi;
  const deductions = [];
  if (state.deductsFederalTax && ctx.federalTax > 0) {
    base -= ctx.federalTax;
    deductions.push(['Federal income tax deducted', ctx.federalTax]);
  }
  let std = 0;
  if (state.std === 'federal') std = F.standardDeduction[fs];
  else if (state.std && typeof state.std === 'object') std = state.std[key];
  if (state.slidingStd) {
    const s = state.slidingStd[key];
    std = pos(s.max - s.rate * pos(ctx.agi - s.start));
  }
  if (std) deductions.push(['Standard deduction', std]);
  let exemption = state.exemption ? state.exemption[key] : 0;
  if (state.exemptionPhaseOut) {
    const p = state.exemptionPhaseOut[key];
    exemption = pos(p.amount - Math.ceil(pos(ctx.agi - p.start) / 1000) * state.exemptionPhaseOut.per1000);
  }
  if (exemption) deductions.push(['Personal exemption', exemption]);
  const taxable = pos(base - std - exemption);
  const schedule = scheduleFor(state.brackets, key);
  const { tax: gross, parts, marginal } = applyBrackets(taxable, schedule);
  let credit = state.credit ? state.credit[key] : 0;
  if (state.utahCredit) {
    const u = state.utahCredit;
    credit = pos(u.rate * F.standardDeduction[fs] - u.phaseOutRate * pos(ctx.agi - u.phaseOutStart[key]));
  }
  const tax = pos(gross - credit);
  return { base, taxable, tax, gross, credit, parts, marginal: tax > 0 ? marginal : 0, deductions };
}

function localTax(local, fs, ctx, stateRes) {
  const key = fs === 'mfj' ? 'mfj' : 'single';
  const filers = fs === 'mfj' ? 2 : 1;
  const earned = ctx.wages + ctx.seProfit;
  switch (local.basis) {
    case 'earned': return { base: earned, tax: earned * local.rate };
    case 'income': { const base = pos(ctx.grossIncome - (local.exemptionPerFiler || 0) * filers); return { base, tax: base * local.rate }; }
    case 'stateTaxable': return { base: stateRes?.taxable ?? 0, tax: (stateRes?.taxable ?? 0) * local.rate };
    case 'stateTaxPct': return { base: stateRes?.tax ?? 0, tax: (stateRes?.tax ?? 0) * local.rate };
    case 'brackets': { const r = applyBrackets(stateRes?.taxable ?? 0, local.brackets[key]); return { base: stateRes?.taxable ?? 0, tax: r.tax, parts: r.parts }; }
    case 'surtax': { const r = applyBrackets(stateRes?.taxable ?? 0, [[0, 0], ...local.tiers[key]]); return { base: stateRes?.taxable ?? 0, tax: r.tax, parts: r.parts.filter((p) => p.rate > 0) }; }
    case 'flatAnnual': return { base: ctx.wages, tax: ctx.wages >= (local.minWages || 0) ? local.amount : 0 };
    default: return { base: 0, tax: 0 };
  }
}

/**
 * @param {{filingStatus?: string, region?: string, city?: string, dependents?: number}} profile
 * @param {import('./engine.js').IncomeInput} inc
 */
export function calcUS(profile, inc) {
  const fs = profile.filingStatus || 'single';
  const state = usStateByCode[profile.region];
  const local = state?.locals.find((l) => l.id === profile.city) || null;
  const d = inc.deductions || {};
  const wages = inc.wages || 0;
  const seProfit = pos((inc.selfEmployment?.income || 0) - (inc.selfEmployment?.expenses || 0));
  const interest = inc.interest || 0;
  const dividends = inc.dividends || 0;
  const other = inc.otherIncome || 0;

  // Payroll taxes on wages (withheld by the employer).
  const ssWages = Math.min(wages, F.socialSecurity.wageBase) * F.socialSecurity.rate;
  const medWages = wages * F.medicare.rate;

  // Self-employment tax.
  const seBase = seProfit * F.selfEmployment.netEarningsFactor;
  let seSS = 0, seMed = 0;
  if (seProfit >= F.selfEmployment.minimum) {
    seSS = Math.min(seBase, pos(F.socialSecurity.wageBase - wages)) * F.selfEmployment.ssRate;
    seMed = seBase * F.selfEmployment.medicareRate;
  }
  const seTax = seSS + seMed;
  const halfSE = seTax / 2;
  const addlMed = pos(wages + (seProfit >= F.selfEmployment.minimum ? seBase : 0) - F.medicare.additionalThreshold[fs]) * F.medicare.additionalRate;

  // Adjusted gross income.
  const retirement = d.retirement || 0;
  const studentLoan = Math.min(d.studentLoanInterest || 0, F.studentLoanInterestMax);
  const grossIncome = wages + seProfit + interest + dividends + other;
  const agi = pos(grossIncome - halfSE - retirement - studentLoan);
  const above = [['Half of self-employment tax', halfSE], ['Retirement contributions', retirement], ['Student loan interest', studentLoan]].filter(([, v]) => v > 0);

  const std = F.standardDeduction[fs];
  const ctxBase = { wages, seProfit, grossIncome, agi, federalTaxable: pos(agi - std), federalTax: 0 };

  // Pass 1: state and local tax with the standard deduction, used for the SALT itemised deduction.
  const s1 = stateIncomeTax(state, fs, ctxBase);
  const l1 = local ? localTax(local, fs, ctxBase, s1) : null;
  const stateLocal1 = (s1?.tax || 0) + (l1?.tax || 0);

  const saltCap = Math.max(F.salt.floor, F.salt.cap[fs] - F.salt.phaseDownRate * pos(agi - F.salt.phaseDownStart));
  const salt = Math.min(stateLocal1, saltCap);
  const medical = pos((d.medical || 0) - F.medicalFloor * agi);
  const itemizedParts = [['Charitable gifts', d.charity || 0], ['Mortgage interest', d.mortgageInterest || 0], ['State and local tax (capped)', salt], ['Medical above 7.5% of AGI', medical]].filter(([, v]) => v > 0);
  const itemized = itemizedParts.reduce((a, [, v]) => a + v, 0);
  const itemizes = itemized > std;
  const deduction = itemizes ? itemized : std;

  const taxableBeforeQBI = pos(agi - deduction);
  let qbi = 0;
  if (taxableBeforeQBI <= F.qbi.threshold[fs] && seProfit > 0) {
    qbi = F.qbi.rate * Math.min(pos(seProfit - halfSE), pos(taxableBeforeQBI - dividends));
  }
  const taxable = pos(taxableBeforeQBI - qbi);
  const qualified = Math.min(dividends, taxable);
  const ordinary = taxable - qualified;
  const ord = applyBrackets(ordinary, F.brackets[fs]);
  const qdTax = stackedTax(ordinary, qualified, F.qualifiedDividends[fs]);
  const incomeTaxBeforeCredits = ord.tax + qdTax;
  const deps = profile.dependents || 0;
  const ctc = pos(deps * F.childTaxCredit.perChild - Math.ceil(pos(agi - F.childTaxCredit.phaseOutStart[fs]) / 1000) * F.childTaxCredit.reductionPer1000);
  const ctcUsed = Math.min(ctc, incomeTaxBeforeCredits);
  const niit = F.niit.rate * Math.min(interest + dividends, pos(agi - F.niit.threshold[fs]));
  const federalIncomeTax = incomeTaxBeforeCredits - ctcUsed;

  // Pass 2: state and local with real federal figures.
  const ctx = { ...ctxBase, federalTaxable: taxable, federalTax: federalIncomeTax };
  const s = stateIncomeTax(state, fs, ctx);
  const l = local ? localTax(local, fs, ctx, s) : null;

  const lines = [];
  const deductionsUsed = [
    ...above.map(([label, amount]) => ({ label, amount, kind: 'Adjustment to income' })),
    ...(itemizes ? itemizedParts.map(([label, amount]) => ({ label, amount, kind: 'Itemised deduction' })) : [{ label: 'Standard deduction', amount: std, kind: 'Deduction' }]),
    ...(qbi > 0 ? [{ label: 'Qualified business income deduction (20%)', amount: qbi, kind: 'Deduction' }] : []),
  ];

  lines.push({
    id: 'us-federal', name: 'Federal income tax', level: 'national', jurisdiction: 'United States',
    amount: federalIncomeTax, base: taxable, baseLabel: 'Taxable income', marginal: ord.marginal,
    parts: ord.parts, taxYear: F.taxYear, sources: F.sources.slice(0, 2),
    details: [
      ['Adjusted gross income', agi],
      [itemizes ? 'Itemised deductions' : 'Standard deduction', -deduction],
      ...(qbi > 0 ? [['QBI deduction', -qbi]] : []),
      ['Taxable income', taxable],
      ['Tax on ordinary income', ord.tax],
      ...(qualified > 0 ? [['Tax on qualified dividends', qdTax]] : []),
      ...(ctcUsed > 0 ? [['Child tax credit', -ctcUsed]] : []),
    ],
  });
  if (niit > 0) lines.push({ id: 'us-niit', name: 'Net investment income tax', level: 'national', jurisdiction: 'United States', amount: niit, base: interest + dividends, baseLabel: 'Investment income', taxYear: F.taxYear, sources: F.sources.slice(0, 1) });
  if (wages > 0) lines.push({
    id: 'us-fica', name: 'Social Security and Medicare', level: 'social', jurisdiction: 'United States',
    amount: ssWages + medWages + addlMed, base: wages, baseLabel: 'Wages', taxYear: F.taxYear, sources: [F.sources[2]], withheldOnWages: true,
    details: [['Social Security 6.2% (to $176,100)', ssWages], ['Medicare 1.45%', medWages], ...(addlMed > 0 ? [['Additional Medicare 0.9%', addlMed]] : [])],
  });
  if (seTax > 0) lines.push({
    id: 'us-se', name: 'Self-employment tax', level: 'social', jurisdiction: 'United States',
    amount: seTax, base: seBase, baseLabel: '92.35% of net profit', taxYear: F.taxYear, sources: [F.sources[2]],
    details: [['Social Security 12.4%', seSS], ['Medicare 2.9%', seMed]],
  });
  if (s) {
    lines.push({
      id: `us-${state.code.toLowerCase()}`, name: `${state.name} income tax`, level: 'state', jurisdiction: state.name,
      amount: s.tax, base: s.taxable, baseLabel: 'State taxable income', marginal: s.marginal, parts: s.parts,
      taxYear: state.taxYear, sources: state.sources,
      details: [['Starting income', s.base + (state.deductsFederalTax ? federalIncomeTax : 0)], ...s.deductions.map(([k, v]) => [k, -v]), ...(s.credit ? [['Personal credit', -s.credit]] : [])],
      notes: state.notes,
    });
  }
  if (state?.payroll && wages > 0) {
    lines.push({ id: 'us-sdi', name: state.payroll.name, level: 'social', jurisdiction: state.name, amount: wages * state.payroll.rate, base: wages, baseLabel: 'Wages', taxYear: state.taxYear, sources: [{ name: state.payroll.source[0], url: state.payroll.source[1] }], withheldOnWages: true });
  }
  if (local && l) {
    lines.push({ id: `us-local-${local.id}`, name: local.label, level: 'local', jurisdiction: local.name, amount: l.tax, base: l.base, baseLabel: 'Taxed amount', parts: l.parts, taxYear: local.taxYear, sources: local.sources, approximate: local.approximate });
  }

  const sales = state ? { name: 'Sales tax', rate: state.salesTax, source: state.salesTaxSource, note: `Approximate combined state and average local rate for ${state.name}. Groceries are excluded because most states exempt or reduce them.` } : null;

  return {
    lines, deductionsUsed,
    totalIncome: grossIncome, taxableIncome: taxable, taxableLabel: 'Federal taxable income',
    sales,
    notes: [...F.notes, ...(state?.notes || []), ...(fs === 'hoh' && s ? ['State tax uses the single schedule for head-of-household filers.'] : [])],
    taxYearLabel: F.taxYearLabel,
  };
}
