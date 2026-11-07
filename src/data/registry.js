// The jurisdiction registry: one entry per country. To add a country, write its rules file in
// src/data/, a calculator in src/tax/ that returns the common result shape (see src/tax/engine.js),
// and register both here.
import { usFederal } from './us-federal.js';
import { usStates } from './us-states.js';
import { ukCommon, ukNations } from './uk.js';
import { caFederal, caProvinces } from './ca.js';
import { au, auStates } from './au.js';
import { world, worldByCode } from './world.js';

export const countries = [
  {
    code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', dateOrder: 'MDY',
    continent: 'North America', accuracy: 'detailed', plaid: true, globe: { center: [-98, 39] },
    regionLabel: 'State', cityLabel: 'City or county',
    taxYear: usFederal.taxYear, taxYearLabel: usFederal.taxYearLabel,
    filingStatuses: [
      { id: 'single', label: 'Single' },
      { id: 'mfj', label: 'Married filing jointly' },
      { id: 'hoh', label: 'Head of household' },
    ],
    asksDependents: true,
    regions: usStates.map((s) => ({
      code: s.code, name: s.name,
      cities: s.locals.map((l) => ({ id: l.id, name: l.name, approximate: !!l.approximate })),
      cityRequired: !!s.localRequired,
      hint: s.none ? 'No state income tax on wages' : null,
    })),
    authority: { name: 'the IRS or your state revenue department', url: 'https://www.irs.gov/', linkLabel: 'Go to IRS.gov' },
  },
  {
    code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', dateOrder: 'DMY',
    continent: 'Europe', accuracy: 'detailed', plaid: true, globe: { center: [-3, 54.5] },
    regionLabel: 'Nation', cityLabel: null,
    taxYear: ukCommon.taxYear, taxYearLabel: ukCommon.taxYearLabel,
    filingStatuses: null,
    regions: ukNations.map((n) => ({ code: n.code, name: n.name, cities: [] })),
    authority: { name: 'HMRC', url: 'https://www.gov.uk/government/organisations/hm-revenue-customs', linkLabel: 'Go to HMRC on GOV.UK' },
  },
  {
    code: 'CA', name: 'Canada', currency: 'CAD', locale: 'en-CA', dateOrder: 'YMD',
    continent: 'North America', accuracy: 'detailed', plaid: true, globe: { center: [-100, 57] },
    regionLabel: 'Province or territory', cityLabel: null,
    taxYear: caFederal.taxYear, taxYearLabel: caFederal.taxYearLabel,
    filingStatuses: null,
    regions: caProvinces.map((p) => ({ code: p.code, name: p.name, cities: [] })),
    authority: { name: 'the Canada Revenue Agency', url: 'https://www.canada.ca/en/revenue-agency.html', linkLabel: 'Go to the CRA' },
  },
  {
    code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', dateOrder: 'DMY',
    continent: 'Oceania', accuracy: 'detailed', globe: { center: [134, -26] },
    regionLabel: 'State or territory', cityLabel: null,
    taxYear: au.taxYear, taxYearLabel: au.taxYearLabel,
    filingStatuses: null,
    regions: auStates.map((s) => ({ code: s.code, name: s.name, cities: [], hint: 'No state income tax' })),
    authority: { name: 'the Australian Taxation Office', url: 'https://www.ato.gov.au/', linkLabel: 'Go to the ATO' },
  },
  // Simplified countries (src/data/world.js): no regions to choose.
  ...world.map((w) => ({
    code: w.code, name: w.name, currency: w.currency, locale: w.locale, dateOrder: w.dateOrder,
    continent: w.continent, accuracy: 'simplified', plaid: !!w.plaid, globe: w.globe,
    regionLabel: null, cityLabel: null, taxYear: w.taxYear, taxYearLabel: w.taxYearLabel,
    filingStatuses: null, regions: [], authority: w.authority,
  })),
];

export const continents = ['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania'];
export const continentCenters = { 'North America': [-100, 42], 'South America': [-60, -15], Europe: [12, 50], Asia: [100, 28], Africa: [20, 3], Oceania: [145, -30] };

export const countryByCode = Object.fromEntries(countries.map((c) => [c.code, c]));

/** Tax year window used to filter statement lines, as ISO dates. */
export function taxYearWindow(countryCode) {
  if (worldByCode[countryCode]) return worldByCode[countryCode].window;
  switch (countryCode) {
    case 'GB': return { start: '2025-04-06', end: '2026-04-05' };
    case 'AU': return { start: '2025-07-01', end: '2026-06-30' };
    default: return { start: '2025-01-01', end: '2025-12-31' };
  }
}
