import { caFederal as F, caProvinces, ontarioHealthPremium } from '../data/ca.js';
import { applyBrackets } from './brackets.js';

const pos = (n) => Math.max(0, n);

export function ontarioHealthPremiumFor(taxable) {
  for (const [from, to, base, rate, cap] of ontarioHealthPremium) {
    if (taxable > from && taxable <= to) return Math.min(cap, base + rate * (taxable - from));
  }
  return 0;
}

function federalBPA(netIncome) {
  const b = F.basicPersonalAmount;
  if (netIncome <= b.phaseStart) return b.max;
  if (netIncome >= b.phaseEnd) return b.min;
  return b.max - (b.max - b.min) * ((netIncome - b.phaseStart) / (b.phaseEnd - b.phaseStart));
}

export function calcCA(profile, inc) {
  const p = caProvinces.find((x) => x.code === profile.region) || caProvinces.find((x) => x.code === 'ON');
  const d = inc.deductions || {};
  const wages = inc.wages || 0;
  const seNet = pos((inc.selfEmployment?.income || 0) - (inc.selfEmployment?.expenses || 0));
  const interest = inc.interest || 0;
  const dividends = inc.dividends || 0;
  const grossedDiv = dividends * (1 + F.eligibleDividend.grossUp);
  const other = inc.otherIncome || 0;

  // CPP or QPP.
  const plan = p.quebec ? F.qpp : F.cpp;
  const planName = p.quebec ? 'QPP' : 'CPP';
  const empPensionable = pos(Math.min(wages, plan.ympe) - plan.basicExemption);
  const empContrib = empPensionable * plan.rate;
  const empBase = empPensionable * plan.baseRate;
  const empEnhanced = empContrib - empBase;
  const second = (plan.cpp2Rate ?? plan.qpp2Rate);
  const emp2 = pos(Math.min(wages, plan.yampe) - plan.ympe) * second;

  const totalEarn = wages + seNet;
  const totalPensionable = pos(Math.min(totalEarn, plan.ympe) - plan.basicExemption);
  const sePensionable = pos(totalPensionable - empPensionable);
  const seContrib = sePensionable * plan.rate * 2;
  const seBase = sePensionable * plan.baseRate; // employee-half base portion: credit
  const seDeduction = sePensionable * plan.rate + sePensionable * (plan.rate - plan.baseRate); // employer half + enhanced half
  const total2 = pos(Math.min(totalEarn, plan.yampe) - plan.ympe);
  const se2 = pos(total2 - pos(Math.min(wages, plan.yampe) - plan.ympe)) * second * 2;

  const ei = Math.min(wages, F.ei.maxInsurable) * (p.quebec ? F.ei.quebecRate : F.ei.rate);
  const qpip = p.quebec ? Math.min(wages, F.qpip.maxInsurable) * F.qpip.rate : 0;

  const rrsp = d.retirement || 0;
  const deductionList = [
    ['RRSP contributions', rrsp],
    [`Enhanced ${planName} contributions`, empEnhanced + emp2],
    [`${planName} on self-employment (deductible part)`, seDeduction + se2],
  ].filter(([, v]) => v > 0);
  const deductionTotal = deductionList.reduce((a, [, v]) => a + v, 0);
  const netIncome = pos(wages + seNet + interest + grossedDiv + other - deductionTotal);
  const taxable = netIncome;

  // Federal.
  const fed = applyBrackets(taxable, F.brackets);
  const bpa = federalBPA(netIncome);
  const cea = wages > 0 ? Math.min(F.canadaEmploymentAmount, wages) : 0;
  const creditBase = bpa + cea + empBase + seBase + ei + qpip;
  const charity = d.charity || 0;
  const fedDonation = Math.min(charity, 200) * F.creditRate + pos(charity - 200) * 0.29;
  const fedDTC = grossedDiv * F.eligibleDividend.federalCredit;
  const fedCredits = creditBase * F.creditRate + fedDonation + fedDTC;
  let fedTax = pos(fed.tax - fedCredits);
  const abatement = p.quebec ? fedTax * F.quebecAbatement : 0;
  fedTax -= abatement;

  // Provincial.
  const pr = applyBrackets(taxable, p.brackets);
  const topRate = p.brackets[p.brackets.length - 1][1];
  const provDonation = Math.min(charity, 200) * p.creditRate + pos(charity - 200) * topRate;
  const provCredits = (p.basicPersonalAmount + empBase + seBase + ei + qpip) * p.creditRate + grossedDiv * p.dividendCredit + provDonation;
  const provBasic = pos(pr.tax - provCredits);
  let surtax = 0;
  if (p.surtax) for (const [thr, rate] of p.surtax) surtax += pos(provBasic - thr) * rate;
  const provTax = provBasic + surtax;
  const ohp = p.healthPremium ? ontarioHealthPremiumFor(taxable) : 0;

  const lines = [
    {
      id: 'ca-federal', name: 'Federal income tax', level: 'national', jurisdiction: 'Canada',
      amount: fedTax, base: taxable, baseLabel: 'Taxable income', marginal: fed.marginal, parts: fed.parts,
      taxYear: F.taxYear, sources: [F.sources[0]],
      details: [
        ['Tax on taxable income', fed.tax],
        ['Basic personal amount credit', -bpa * F.creditRate],
        ...(cea ? [['Canada employment amount credit', -cea * F.creditRate]] : []),
        [`${planName}, EI${p.quebec ? ' and QPIP' : ''} credits`, -(empBase + seBase + ei + qpip) * F.creditRate],
        ...(fedDonation ? [['Donation credit', -fedDonation]] : []),
        ...(fedDTC ? [['Dividend tax credit', -fedDTC]] : []),
        ...(abatement ? [['Quebec abatement (16.5%)', -abatement]] : []),
      ],
    },
    {
      id: `ca-${p.code.toLowerCase()}`, name: `${p.name} income tax`, level: 'state', jurisdiction: p.name,
      amount: provTax, base: taxable, baseLabel: 'Taxable income', marginal: pr.marginal, parts: pr.parts,
      taxYear: p.taxYear, sources: p.sources, notes: p.notes,
      details: [
        ['Tax on taxable income', pr.tax],
        ['Basic personal amount credit', -p.basicPersonalAmount * p.creditRate],
        [`${planName}, EI${p.quebec ? ' and QPIP' : ''} credits`, -(empBase + seBase + ei + qpip) * p.creditRate],
        ...(provDonation ? [['Donation credit', -provDonation]] : []),
        ...(grossedDiv ? [['Dividend tax credit', -grossedDiv * p.dividendCredit]] : []),
        ...(surtax ? [['Ontario surtax', surtax]] : []),
      ],
    },
  ];
  if (ohp > 0) lines.push({ id: 'ca-ohp', name: 'Ontario Health Premium', level: 'state', jurisdiction: 'Ontario', amount: ohp, base: taxable, baseLabel: 'Taxable income', taxYear: p.taxYear, sources: p.sources.slice(1) });
  if (empContrib + emp2 > 0) lines.push({ id: 'ca-pension', name: `${planName} contributions`, level: 'social', jurisdiction: 'Canada', amount: empContrib + emp2, base: wages, baseLabel: 'Employment income', taxYear: F.taxYear, sources: [F.sources[p.quebec ? 3 : 1]], withheldOnWages: true });
  if (seContrib + se2 > 0) lines.push({ id: 'ca-pension-se', name: `${planName} on self-employment`, level: 'social', jurisdiction: 'Canada', amount: seContrib + se2, base: sePensionable, baseLabel: 'Pensionable earnings', taxYear: F.taxYear, sources: [F.sources[p.quebec ? 3 : 1]] });
  if (ei > 0) lines.push({ id: 'ca-ei', name: 'Employment Insurance premiums', level: 'social', jurisdiction: 'Canada', amount: ei, base: Math.min(wages, F.ei.maxInsurable), baseLabel: 'Insurable earnings', taxYear: F.taxYear, sources: [F.sources[2]], withheldOnWages: true });
  if (qpip > 0) lines.push({ id: 'ca-qpip', name: 'QPIP premiums', level: 'social', jurisdiction: 'Quebec', amount: qpip, base: Math.min(wages, F.qpip.maxInsurable), baseLabel: 'Insurable earnings', taxYear: F.taxYear, sources: [{ name: 'Revenu Québec — QPIP', url: 'https://www.revenuquebec.ca/en/' }], withheldOnWages: true });

  const st = p.salesTax;
  const salesName = st.hst ? 'HST' : st.qst ? 'GST and QST' : st.pst ? 'GST and PST' : 'GST';
  return {
    lines,
    deductionsUsed: [
      ...deductionList.map(([label, amount]) => ({ label, amount, kind: 'Deduction' })),
      { label: 'Federal basic personal amount (credit base)', amount: bpa, kind: 'Credit' },
      { label: `${p.name} basic personal amount (credit base)`, amount: p.basicPersonalAmount, kind: 'Credit' },
      ...(dividends ? [{ label: 'Dividend gross-up (added to income)', amount: grossedDiv - dividends, kind: 'Addition' }] : []),
    ],
    totalIncome: wages + seNet + interest + dividends + other, taxableIncome: taxable, taxableLabel: 'Taxable income',
    sales: { name: salesName, rate: p.salesTaxRate, source: F.salesTaxSource, note: 'Basic groceries, prescription drugs and rent are zero-rated or exempt.' },
    notes: [...F.notes, ...(p.notes || [])],
    taxYearLabel: F.taxYearLabel,
  };
}
