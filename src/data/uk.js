// United Kingdom: income tax and National Insurance, tax year 2025/26
// (6 April 2025 – 5 April 2026; Self Assessment due 31 January 2027).
// Bands are on taxable income, i.e. after the personal allowance.

const GOV_RATES = { name: 'GOV.UK: Income Tax rates and allowances', url: 'https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past' };
const GOV_NI = { name: 'GOV.UK: National Insurance rates and thresholds', url: 'https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions/rates-and-allowances-national-insurance-contributions' };

export const ukCommon = {
  id: 'uk',
  taxYear: '2025/26',
  taxYearLabel: 'Tax year 2025/26 (6 Apr 2025 – 5 Apr 2026)',
  currency: 'GBP',
  personalAllowance: 12570,
  allowanceTaperStart: 100000, // £1 lost per £2 of adjusted net income above this
  // rUK non-savings, savings and dividend bands (taxable income).
  bands: [[0, 0.20], [37700, 0.40], [125140, 0.45]],
  savings: {
    startingRateBand: 5000,
    personalSavingsAllowance: { basic: 1000, higher: 500, additional: 0 },
    rates: [0.20, 0.40, 0.45],
  },
  dividends: { allowance: 500, rates: [0.0875, 0.3375, 0.3935] },
  tradingAllowance: 1000,
  ni: {
    class1: { primaryThreshold: 12570, upperEarningsLimit: 50270, mainRate: 0.08, upperRate: 0.02 },
    class4: { lowerProfitsLimit: 12570, upperProfitsLimit: 50270, mainRate: 0.06, upperRate: 0.02 },
  },
  vat: { standard: 0.20 },
  sources: [GOV_RATES, GOV_NI, { name: 'GOV.UK: Tax on savings interest', url: 'https://www.gov.uk/apply-tax-free-interest-on-savings' }, { name: 'GOV.UK: Tax on dividends', url: 'https://www.gov.uk/tax-on-dividends' }],
  vatSource: { name: 'GOV.UK: VAT rates', url: 'https://www.gov.uk/guidance/rates-of-vat-on-different-goods-and-services' },
  notes: [
    'Salary deposits are assumed to be after PAYE; the employer deducts tax and employee National Insurance.',
    'Class 1 National Insurance is calculated on annual earnings; payroll actually works per pay period.',
    'Student loan repayments, the High Income Child Benefit Charge and the marriage allowance are not included.',
    'Pension contributions and Gift Aid are treated as relief-at-source: they extend the basic-rate band by the gross amount.',
  ],
};

// Scotland sets its own non-savings rates. Thresholds below are in taxable income
// (Scottish band upper limits minus the £12,570 personal allowance).
export const ukNations = [
  { code: 'ENG', name: 'England', bands: null, sources: [GOV_RATES] },
  { code: 'NIR', name: 'Northern Ireland', bands: null, sources: [GOV_RATES] },
  { code: 'WLS', name: 'Wales', bands: null, sources: [GOV_RATES, { name: 'Welsh Revenue Authority: Welsh rates of income tax', url: 'https://www.gov.wales/welsh-rates-income-tax' }],
    notes: ['Welsh rates of income tax are 10p in each band and currently match England.'] },
  { code: 'SCT', name: 'Scotland',
    bands: [[0, 0.19], [2827, 0.20], [14921, 0.21], [31092, 0.42], [62430, 0.45], [125140, 0.48]],
    bandNames: ['Starter', 'Basic', 'Intermediate', 'Higher', 'Advanced', 'Top'],
    sources: [{ name: 'Scottish Government: Scottish income tax rates and bands', url: 'https://www.gov.scot/policies/taxes/income-tax/' }, GOV_RATES],
    notes: ['Savings and dividend income use UK rates and bands even for Scottish taxpayers.'] },
];
