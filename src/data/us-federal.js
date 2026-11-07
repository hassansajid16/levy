// United States: federal income tax and payroll taxes, tax year 2025
// (returns filed in 2026). Figures reflect Rev. Proc. 2024-40 as amended by
// Public Law 119-21 (the 2025 reconciliation act, "OBBBA"), which raised the 2025
// standard deduction, the child tax credit and the SALT cap.

export const usFederal = {
  id: 'us-federal',
  name: 'US federal income tax',
  taxYear: '2025',
  taxYearLabel: 'Tax year 2025 (1 Jan – 31 Dec 2025)',
  currency: 'USD',
  sources: [
    { name: 'IRS: 2025 inflation adjustments (Rev. Proc. 2024-40)', url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2025' },
    { name: 'IRS: One, Big, Beautiful Bill provisions (P.L. 119-21)', url: 'https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions' },
    { name: 'SSA: Contribution and benefit base', url: 'https://www.ssa.gov/oact/cola/cbb.html' },
  ],
  brackets: {
    single: [[0, 0.10], [11925, 0.12], [48475, 0.22], [103350, 0.24], [197300, 0.32], [250525, 0.35], [626350, 0.37]],
    mfj: [[0, 0.10], [23850, 0.12], [96950, 0.22], [206700, 0.24], [394600, 0.32], [501050, 0.35], [751600, 0.37]],
    hoh: [[0, 0.10], [17000, 0.12], [64850, 0.22], [103350, 0.24], [197300, 0.32], [250500, 0.35], [626350, 0.37]],
  },
  standardDeduction: { single: 15750, mfj: 31500, hoh: 23625 },
  // Qualified dividends and long-term gains: 0% / 15% / 20%, thresholds on taxable income.
  qualifiedDividends: {
    single: [[0, 0], [48350, 0.15], [533400, 0.20]],
    mfj: [[0, 0], [96700, 0.15], [600050, 0.20]],
    hoh: [[0, 0], [64750, 0.15], [566700, 0.20]],
  },
  socialSecurity: { rate: 0.062, wageBase: 176100 },
  medicare: { rate: 0.0145, additionalRate: 0.009, additionalThreshold: { single: 200000, mfj: 250000, hoh: 200000 } },
  selfEmployment: { netEarningsFactor: 0.9235, ssRate: 0.124, medicareRate: 0.029, minimum: 400 },
  niit: { rate: 0.038, threshold: { single: 200000, mfj: 250000, hoh: 200000 } },
  childTaxCredit: { perChild: 2200, phaseOutStart: { single: 200000, mfj: 400000, hoh: 200000 }, reductionPer1000: 50 },
  qbi: { rate: 0.20, threshold: { single: 197300, mfj: 394600, hoh: 197300 } },
  salt: { cap: { single: 40000, mfj: 40000, hoh: 40000 }, phaseDownStart: 500000, phaseDownRate: 0.30, floor: 10000 },
  studentLoanInterestMax: 2500,
  medicalFloor: 0.075,
  notes: [
    'All dividends are treated as qualified (taxed at 0/15/20%). Non-qualified dividends would be taxed as ordinary income.',
    'Credits other than the child tax credit (earned income credit, education and energy credits) are not included.',
    'The QBI deduction is applied only below the income threshold, where the wage and property limits do not apply.',
    'New 2025 deductions for tips, overtime, car-loan interest and the senior deduction are not included.',
  ],
};
