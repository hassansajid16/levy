// Canada: federal and provincial/territorial income tax, CPP/QPP and EI, tax year 2025
// (1 Jan – 31 Dec 2025; filed by 30 April 2026, or 15 June 2026 if self-employed).
// The federal lowest rate fell from 15% to 14% on 1 July 2025, so the CRA applies an
// effective 14.5% for the whole 2025 year, on both the first bracket and the credits.

const CRA_RATES = { name: 'CRA: Canadian income tax rates for individuals', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html' };
const CRA_CPP = { name: 'CRA: CPP contribution rates, maximums and exemptions', url: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html' };
const CRA_EI = { name: 'CRA: EI premium rates and maximums', url: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html' };
const CRA_SALES = { name: 'CRA: GST/HST rates by province', url: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html' };

export const caFederal = {
  id: 'ca-federal',
  name: 'Federal income tax',
  taxYear: '2025',
  taxYearLabel: 'Tax year 2025 (1 Jan – 31 Dec 2025)',
  currency: 'CAD',
  brackets: [[0, 0.145], [57375, 0.205], [114750, 0.26], [177882, 0.29], [253414, 0.33]],
  creditRate: 0.145,
  basicPersonalAmount: { max: 16129, min: 14538, phaseStart: 177882, phaseEnd: 253414 },
  canadaEmploymentAmount: 1471,
  eligibleDividend: { grossUp: 0.38, federalCredit: 0.150198 },
  quebecAbatement: 0.165,
  cpp: { rate: 0.0595, baseRate: 0.0495, basicExemption: 3500, ympe: 71300, cpp2Rate: 0.04, yampe: 81200 },
  qpp: { rate: 0.064, baseRate: 0.054, basicExemption: 3500, ympe: 71300, qpp2Rate: 0.04, yampe: 81200 },
  ei: { rate: 0.0164, quebecRate: 0.0131, maxInsurable: 65700 },
  qpip: { rate: 0.00494, maxInsurable: 98000 },
  sources: [CRA_RATES, CRA_CPP, CRA_EI, { name: 'Retraite Québec: QPP contribution rates', url: 'https://www.retraitequebec.gouv.qc.ca/en/' }],
  salesTaxSource: CRA_SALES,
  notes: [
    'Salary deposits are assumed to be after source deductions (tax, CPP/QPP and EI).',
    'Dividends are treated as eligible dividends (38% gross-up with the dividend tax credit).',
    'Refundable credits and benefits (GST/HST credit, Canada Workers Benefit, CCB) are not included.',
    'Ontario low-income reduction and other provincial credits beyond the basic personal amount are not included.',
  ],
};

const prov = (code, name, brackets, bpa, dtc, salesTax, extra = {}) => ({
  code, name, brackets, basicPersonalAmount: bpa, creditRate: extra.creditRate ?? brackets[0][1],
  dividendCredit: dtc, salesTax, taxYear: '2025', ...extra,
  sources: [CRA_RATES, ...(extra.sources || [])],
});

export const caProvinces = [
  prov('AB', 'Alberta', [[0, 0.08], [60000, 0.10], [151234, 0.12], [181481, 0.13], [241974, 0.14], [362961, 0.15]], 22323, 0.0812, { gst: 0.05, pst: 0 },
    { notes: ['Alberta credits are calculated at 8% from 2025; the supplemental credit for claims over $60,000 is not included.'], sources: [{ name: 'Alberta: Personal income tax', url: 'https://www.alberta.ca/personal-income-tax' }] }),
  prov('BC', 'British Columbia', [[0, 0.0506], [49279, 0.077], [98560, 0.105], [113158, 0.1229], [137407, 0.147], [186306, 0.168], [259829, 0.205]], 12932, 0.12, { gst: 0.05, pst: 0.07 },
    { sources: [{ name: 'Government of BC: Personal income tax rates', url: 'https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates' }] }),
  prov('MB', 'Manitoba', [[0, 0.108], [47000, 0.1275], [100000, 0.174]], 15780, 0.08, { gst: 0.05, pst: 0.07 },
    { notes: ['Manitoba phases out its basic personal amount above $200,000 from 2025; the phase-out is not applied.'] }),
  prov('NB', 'New Brunswick', [[0, 0.094], [51306, 0.14], [102614, 0.16], [190060, 0.195]], 13396, 0.14, { hst: 0.15 }),
  prov('NL', 'Newfoundland and Labrador', [[0, 0.087], [44192, 0.145], [88382, 0.158], [157792, 0.178], [220910, 0.198], [282214, 0.208], [564429, 0.213], [1128858, 0.218]], 11067, 0.063, { hst: 0.15 }),
  prov('NS', 'Nova Scotia', [[0, 0.0879], [30507, 0.1495], [61015, 0.1667], [95883, 0.175], [154650, 0.21]], 11744, 0.0885, { hst: 0.14 }),
  prov('NT', 'Northwest Territories', [[0, 0.059], [51964, 0.086], [103930, 0.122], [168967, 0.1405]], 17842, 0.115, { gst: 0.05, pst: 0 }),
  prov('NU', 'Nunavut', [[0, 0.04], [54707, 0.07], [109413, 0.09], [177881, 0.115]], 19274, 0.0551, { gst: 0.05, pst: 0 }),
  prov('ON', 'Ontario', [[0, 0.0505], [52886, 0.0915], [105775, 0.1116], [150000, 0.1216], [220000, 0.1316]], 12747, 0.10, { hst: 0.13 },
    { surtax: [[5710, 0.20], [7307, 0.36]], healthPremium: true,
      sources: [{ name: 'CRA: Ontario tax package (ON428, health premium)', url: 'https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package/ontario.html' }] }),
  prov('PE', 'Prince Edward Island', [[0, 0.095], [33328, 0.1347], [64656, 0.166], [105000, 0.1762], [140000, 0.19]], 14250, 0.105, { hst: 0.15 }),
  prov('QC', 'Quebec', [[0, 0.14], [53255, 0.19], [106495, 0.24], [129590, 0.2575]], 18571, 0.117, { gst: 0.05, qst: 0.09975 },
    { quebec: true,
      notes: ['Quebec residents file a separate provincial return with Revenu Québec; credits beyond the basic personal amount are not included.'],
      sources: [{ name: 'Revenu Québec: Income tax rates', url: 'https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/' }] }),
  prov('SK', 'Saskatchewan', [[0, 0.105], [53463, 0.125], [152750, 0.145]], 19491, 0.11, { gst: 0.05, pst: 0.06 }),
  prov('YT', 'Yukon', [[0, 0.064], [57375, 0.09], [114750, 0.109], [177882, 0.128], [500000, 0.15]], 16129, 0.1202, { gst: 0.05, pst: 0 }),
].map((p) => ({ ...p, salesTaxRate: (p.salesTax.hst ?? 0) + (p.salesTax.gst ?? 0) + (p.salesTax.pst ?? 0) + (p.salesTax.qst ?? 0) }));

// Ontario Health Premium: piecewise on taxable income.
export const ontarioHealthPremium = [
  // [from, to, base, rate on excess over `from`, cap]
  [20000, 25000, 0, 0.06, 300],
  [25000, 36000, 300, 0, 300],
  [36000, 38500, 300, 0.06, 450],
  [38500, 48000, 450, 0, 450],
  [48000, 48600, 450, 0.25, 600],
  [48600, 72000, 600, 0, 600],
  [72000, 72600, 600, 0.25, 750],
  [72600, 200000, 750, 0, 750],
  [200000, 200600, 750, 0.25, 900],
  [200600, Infinity, 900, 0, 900],
];
