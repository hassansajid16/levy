// Worked examples, calculated by hand from the published schedules in src/data/.
// Each comment shows the arithmetic so a reviewer can check it against the source.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, grossUpFromNet, taxOnWagesAlone } from '../src/tax/engine.js';
import { applyBrackets, marginalRate } from '../src/tax/brackets.js';
import { ontarioHealthPremiumFor } from '../src/tax/ca.js';
import { lowIncomeTaxOffset, medicareLevy } from '../src/tax/au.js';
import { usStates } from '../src/data/us-states.js';
import { countries } from '../src/data/registry.js';

const near = (actual, expected, tol = 0.01, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected}, got ${actual}`);
const line = (res, id) => res.lines.find((l) => l.id === id);

describe('bracket maths', () => {
  const s = [[0, 0.1], [10000, 0.2], [20000, 0.3]];
  test('applies each slice at its own rate', () => {
    // 10,000 × 10% + 10,000 × 20% + 5,000 × 30% = 1,000 + 2,000 + 1,500
    assert.equal(applyBrackets(25000, s).tax, 4500);
  });
  test('zero and negative income owe nothing', () => {
    assert.equal(applyBrackets(0, s).tax, 0);
    assert.equal(applyBrackets(-500, s).tax, 0);
  });
  test('marginal rate at a threshold is the next bracket', () => {
    assert.equal(marginalRate(9999, s), 0.1);
    assert.equal(marginalRate(10000, s), 0.2);
  });
});

describe('United States, 2025', () => {
  test('single, $75,000 wages, Texas', () => {
    const r = estimate({ country: 'US', region: 'TX', filingStatus: 'single' }, { wages: 75000 });
    // Taxable 75,000 − 15,750 = 59,250
    // 11,925 × 10% = 1,192.50; 36,550 × 12% = 4,386.00; 10,775 × 22% = 2,370.50 → 7,949.00
    near(line(r, 'us-federal').amount, 7949.0);
    // FICA: 75,000 × 6.2% + 75,000 × 1.45% = 4,650 + 1,087.50
    near(line(r, 'us-fica').amount, 5737.5);
    assert.equal(r.lines.some((l) => l.level === 'state'), false);
    // Marginal: 22% federal + 7.65% FICA
    near(r.marginalRate, 0.2965, 0.0001);
  });

  test('single, $100,000 wages, California with SDI', () => {
    const r = estimate({ country: 'US', region: 'CA', filingStatus: 'single' }, { wages: 100000 });
    // Federal taxable 84,250: 1,192.50 + 4,386.00 + 35,775 × 22% (7,870.50) = 13,449.00
    near(line(r, 'us-federal').amount, 13449.0);
    // CA taxable 94,294: 110.79 + 303.70 + 607.52 + 965.40 + 1,214.56 + 2,006.01 = 5,207.98, less $153 credit
    near(line(r, 'us-ca').amount, 5054.98);
    near(line(r, 'us-sdi').amount, 1200);
  });

  test('single freelancer, $60,000 revenue and $10,000 expenses, Texas', () => {
    const r = estimate({ country: 'US', region: 'TX', filingStatus: 'single' }, { selfEmployment: { income: 60000, expenses: 10000 } });
    // Net profit 50,000; × 92.35% = 46,175; × 15.3% = 7,064.775
    near(line(r, 'us-se').amount, 7064.78);
    // AGI 50,000 − 3,532.39 = 46,467.61; less 15,750 = 30,717.61
    // QBI 20% × 30,717.61 = 6,143.52 → taxable 24,574.09
    // 1,192.50 + 12,649.09 × 12% (1,517.89) = 2,710.39
    near(line(r, 'us-federal').amount, 2710.39);
    assert.equal(line(r, 'us-fica'), undefined);
  });

  test('married jointly, $150,000 wages, New York City', () => {
    const r = estimate({ country: 'US', region: 'NY', city: 'nyc', filingStatus: 'mfj' }, { wages: 150000 });
    // Federal taxable 118,500: 2,385 + 8,772 + 21,550 × 22% (4,741) = 15,898
    near(line(r, 'us-federal').amount, 15898);
    // NY taxable 133,950: 686 + 290.25 + 225.75 + 106,050 × 5.5% (5,832.75) = 7,034.75
    near(line(r, 'us-ny').amount, 7034.75);
    // NYC: 664.848 + 880.308 + 1,718.55 + 1,703.502 = 4,967.21
    near(line(r, 'us-local-nyc').amount, 4967.21);
  });

  test('Ohio city tax applies to earned income', () => {
    const r = estimate({ country: 'US', region: 'OH', city: 'columbus', filingStatus: 'single' }, { wages: 50000 });
    near(line(r, 'us-local-columbus').amount, 1250); // 50,000 × 2.5%
    // Ohio: (50,000 − 26,050) × 2.75% = 658.63
    near(line(r, 'us-oh').amount, 658.63);
  });

  test('child tax credit reduces federal tax', () => {
    const a = estimate({ country: 'US', region: 'TX', filingStatus: 'mfj', dependents: 0 }, { wages: 90000 });
    const b = estimate({ country: 'US', region: 'TX', filingStatus: 'mfj', dependents: 2 }, { wages: 90000 });
    near(line(a, 'us-federal').amount - line(b, 'us-federal').amount, 4400);
  });

  test('qualified dividends inside the 0% band are untaxed', () => {
    const base = estimate({ country: 'US', region: 'TX', filingStatus: 'single' }, { wages: 40000 });
    const withDiv = estimate({ country: 'US', region: 'TX', filingStatus: 'single' }, { wages: 40000, dividends: 2000 });
    // Taxable 24,250 + 2,000 stays under 48,350
    near(line(withDiv, 'us-federal').amount, line(base, 'us-federal').amount);
  });

  test('every state has a name, a tax year and a source', () => {
    assert.equal(usStates.length, 51); // 50 states and DC
    for (const s of usStates) {
      assert.ok(s.name && s.taxYear && s.sources.length >= 1, s.code);
      assert.ok(s.none || s.brackets, `${s.code} has brackets`);
      for (const l of s.locals) assert.ok(l.sources[0].url.startsWith('https://'), `${s.code}/${l.id}`);
    }
  });

  test('every state calculates without error at several incomes', () => {
    for (const s of usStates) for (const fs of ['single', 'mfj', 'hoh']) for (const wages of [0, 20000, 85000, 400000]) {
      const r = estimate({ country: 'US', region: s.code, filingStatus: fs }, { wages, interest: 500 });
      for (const l of r.lines) assert.ok(Number.isFinite(l.amount) && l.amount >= 0, `${s.code} ${fs} ${wages} ${l.id}`);
    }
  });
});

describe('United Kingdom, 2025/26', () => {
  test('England, £50,000 salary', () => {
    const r = estimate({ country: 'GB', region: 'ENG' }, { wages: 50000 });
    // Taxable 37,430 × 20% = 7,486; NI (50,000 − 12,570) × 8% = 2,994.40
    near(line(r, 'uk-income-tax').amount, 7486);
    near(line(r, 'uk-ni1').amount, 2994.4);
  });

  test('Scotland, £50,000 salary', () => {
    const r = estimate({ country: 'GB', region: 'SCT' }, { wages: 50000 });
    // 2,827 × 19% + 12,094 × 20% + 16,171 × 21% + 6,338 × 42%
    // = 537.13 + 2,418.80 + 3,395.91 + 2,661.96 = 9,013.80
    near(line(r, 'uk-income-tax').amount, 9013.8);
  });

  test('England, £110,000 salary loses part of the personal allowance', () => {
    const r = estimate({ country: 'GB', region: 'ENG' }, { wages: 110000 });
    // PA 12,570 − 5,000 = 7,570; taxable 102,430: 7,540 + 64,730 × 40% (25,892) = 33,432
    near(line(r, 'uk-income-tax').amount, 33432);
    // NI 37,700 × 8% + 59,730 × 2% = 3,016 + 1,194.60
    near(line(r, 'uk-ni1').amount, 4210.6);
    near(r.marginalRate, 0.62, 0.0001); // 40% × 1.5 in the taper + 2% NI
  });

  test('savings and dividend allowances', () => {
    const r = estimate({ country: 'GB', region: 'ENG' }, { wages: 30000, interest: 2000, dividends: 3000 });
    // 17,430 × 20% = 3,486; savings: 1,000 at 0%, 1,000 × 20% = 200; dividends: 500 at 0%, 2,500 × 8.75% = 218.75
    near(line(r, 'uk-income-tax').amount, 3904.75);
  });

  test('trading allowance covers small side income', () => {
    const r = estimate({ country: 'GB', region: 'ENG' }, { wages: 30000, selfEmployment: { income: 900, expenses: 0 } });
    near(line(r, 'uk-income-tax').amount, 3486);
    assert.equal(line(r, 'uk-ni4'), undefined);
  });
});

describe('Canada, 2025', () => {
  test('Ontario, $60,000 employment income', () => {
    const r = estimate({ country: 'CA', region: 'ON' }, { wages: 60000 });
    // CPP 56,500 × 5.95% = 3,361.75 (base 2,796.75, enhanced 565); EI 60,000 × 1.64% = 984
    near(line(r, 'ca-pension').amount, 3361.75);
    near(line(r, 'ca-ei').amount, 984);
    // Taxable 59,435. Federal 8,319.375 + 2,060 × 20.5% (422.30) = 8,741.675
    // less (16,129 + 1,471 + 2,796.75 + 984) × 14.5% = 3,100.21 → 5,641.47
    near(line(r, 'ca-federal').amount, 5641.47);
    // Ontario 2,670.743 + 6,549 × 9.15% (599.23) = 3,269.98, less 16,527.75 × 5.05% = 834.65 → 2,435.33
    near(line(r, 'ca-on').amount, 2435.33);
    near(line(r, 'ca-ohp').amount, 600);
  });

  test('Ontario Health Premium schedule', () => {
    assert.equal(ontarioHealthPremiumFor(19000), 0);
    near(ontarioHealthPremiumFor(22000), 120);
    assert.equal(ontarioHealthPremiumFor(30000), 300);
    assert.equal(ontarioHealthPremiumFor(250000), 900);
  });

  test('every province calculates', () => {
    for (const c of countries.find((x) => x.code === 'CA').regions) {
      const r = estimate({ country: 'CA', region: c.code }, { wages: 85000, selfEmployment: { income: 12000, expenses: 2000 }, dividends: 1000 });
      for (const l of r.lines) assert.ok(Number.isFinite(l.amount) && l.amount >= 0, `${c.code} ${l.id}`);
    }
  });
});

describe('Australia, 2025–26', () => {
  test('$90,000 salary', () => {
    const r = estimate({ country: 'AU', region: 'NSW' }, { wages: 90000 });
    // 26,800 × 16% + 45,000 × 30% = 4,288 + 13,500 = 17,788; no LITO; Medicare 1,800
    near(line(r, 'au-income-tax').amount, 17788);
    near(line(r, 'au-medicare').amount, 1800);
  });

  test('$40,000 salary with the low income tax offset', () => {
    const r = estimate({ country: 'AU', region: 'VIC' }, { wages: 40000 });
    // 21,800 × 16% = 3,488; LITO 700 − 2,500 × 5% = 575 → 2,913
    near(line(r, 'au-income-tax').amount, 2913);
    near(line(r, 'au-medicare').amount, 800);
  });

  test('offsets and levy thresholds', () => {
    assert.equal(lowIncomeTaxOffset(30000), 700);
    assert.equal(lowIncomeTaxOffset(70000), 0);
    assert.equal(medicareLevy(28000), 0);
    near(medicareLevy(30000), 198.9); // 10% × (30,000 − 28,011)
  });
});

describe('take-home gross-up and balance', () => {
  for (const profile of [
    { country: 'US', region: 'CA', filingStatus: 'single' },
    { country: 'GB', region: 'SCT' },
    { country: 'CA', region: 'QC' },
    { country: 'AU', region: 'QLD' },
  ]) {
    test(`net pay round-trips for ${profile.country}/${profile.region}`, () => {
      const { gross, withheld } = grossUpFromNet(profile, 48000);
      near(gross - taxOnWagesAlone(profile, gross), 48000, 0.05);
      near(gross - withheld, 48000, 0.01);
    });
  }

  test('salary-only, fully withheld, owes about nothing', () => {
    const profile = { country: 'US', region: 'TX', filingStatus: 'single' };
    const { gross, withheld } = grossUpFromNet(profile, 60000);
    const r = estimate(profile, { wages: gross, withheld });
    near(r.balance, 0, 0.1);
  });

  test('side income creates a balance to pay', () => {
    const profile = { country: 'GB', region: 'ENG' };
    const { gross, withheld } = grossUpFromNet(profile, 30000);
    const r = estimate(profile, { wages: gross, withheld, selfEmployment: { income: 5000, expenses: 500 } });
    assert.ok(r.balance > 0);
  });

  test('sales tax information is computed from tax-inclusive spending', () => {
    const r = estimate({ country: 'GB', region: 'ENG' }, { wages: 30000, taxableSpend: 1200 });
    near(r.consumption.estimate, 200); // 1,200 × 20/120
  });
});
