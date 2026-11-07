// Australia: resident individual income tax, income year 2025–26
// (1 July 2025 – 30 June 2026; returns due 31 October 2026 if self-lodging).
// States and territories levy no income tax, so the state choice affects nothing here.

export const au = {
  id: 'au',
  name: 'Australian income tax',
  taxYear: '2025–26',
  taxYearLabel: 'Income year 2025–26 (1 Jul 2025 – 30 Jun 2026)',
  currency: 'AUD',
  brackets: [[0, 0], [18200, 0.16], [45000, 0.30], [135000, 0.37], [190000, 0.45]],
  lito: { max: 700, firstStart: 37500, firstRate: 0.05, secondStart: 45000, secondRate: 0.015, end: 66667 },
  medicare: {
    rate: 0.02,
    // Lower threshold for singles. The 2026–27 Budget raised it 2.9% to $28,011 for 2025–26,
    // backdated to 1 July 2025; check the ATO page for whether it has been legislated.
    lowIncomeThreshold: 28011,
    shadeInRate: 0.10,
  },
  gst: 0.10,
  sources: [
    { name: 'ATO: Tax rates: Australian residents', url: 'https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents' },
    { name: 'ATO: Medicare levy reduction for low-income earners', url: 'https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners' },
    { name: 'ATO: Low income tax offset', url: 'https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/tax-offsets/low-and-middle-income-earner-tax-offsets' },
  ],
  gstSource: { name: 'ATO: GST', url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst' },
  notes: [
    'Salary deposits are assumed to be after PAYG withholding. Employer superannuation is not income on your statements.',
    'Dividends are treated as unfranked; franking credits would reduce the tax shown.',
    'The Medicare levy surcharge (for higher earners without private hospital cover) and HELP/HECS repayments are not included.',
    'The Medicare low-income threshold of $28,011 was announced in the 2026–27 Budget for 2025–26 and may still be awaiting legislation.',
  ],
};

export const auStates = [
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NSW', name: 'New South Wales' },
  { code: 'NT', name: 'Northern Territory' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'WA', name: 'Western Australia' },
];
