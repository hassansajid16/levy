// Worked examples for the simplified countries (src/data/world.js), calculated by hand.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estimate } from '../src/tax/engine.js';
import { world, germanTariff2025 } from '../src/data/world.js';
import { countries, taxYearWindow } from '../src/data/registry.js';
import { generateSample } from '../src/sample/generate.js';
import { categorizeAll } from '../src/categorize/rules.js';

const near = (a, e, tol = 0.6) => assert.ok(Math.abs(a - e) <= tol, `expected ${e}, got ${a}`);
const line = (r, id) => r.lines.find((l) => l.id === id);
const run = (code, inc) => estimate({ country: code }, inc);

describe('simplified countries', () => {
  test('Germany §32a formula', () => {
    assert.equal(germanTariff2025(12096), 0);
    // z = 3.2557: (176.64z + 2397)z + 1015.13 = 10,691.35
    assert.equal(germanTariff2025(50000), 10691);
    assert.equal(germanTariff2025(100000), 31088); // 0.42 × 100,000 − 10,911.92
  });

  test('India new regime: no tax up to ₹12 lakh taxable', () => {
    near(line(run('IN', { wages: 1275000 }), 'in-it').amount, 0);
  });

  test('India ₹15 lakh taxable', () => {
    const r = run('IN', { wages: 1575000 });
    // 4L × 5% + 4L × 10% + 3L × 15% = 105,000; cess 4% = 4,200
    near(line(r, 'in-it').amount, 105000);
    near(line(r, 'in-cess').amount, 4200);
  });

  test('South Africa R500,000 salary', () => {
    const r = run('ZA', { wages: 500000 });
    // 77,362 + 31% × 129,500 = 117,507; less the R17,235 rebate
    near(line(r, 'za-it').amount, 100272);
    near(line(r, 'za-uif').amount, 2125.44);
  });

  test('Singapore $100,000 salary', () => {
    const r = run('SG', { wages: 100000 });
    // CPF 17,760; chargeable 81,240 → 200 + 350 + 2,800 + 1,240 × 11.5%
    near(line(r, 'sg-it').amount, 3492.6);
  });

  test('Kenya KSh 1.2 million salary', () => {
    const r = run('KE', { wages: 1200000 });
    // Taxable 1,097,160 → 28,800 + 25,000 + 709,160 × 30% − 28,800 relief
    near(line(r, 'ke-paye').amount, 237748);
  });

  test('New Zealand $60,000', () => {
    const r = run('NZ', { wages: 60000 });
    // 1,638 + 6,632.50 + 1,950 = 10,220.50; less the $520 IETC
    near(line(r, 'nz-it').amount, 9700.5);
    near(line(r, 'nz-acc').amount, 1002);
  });

  test('Hong Kong HK$400,000 salary uses progressive rates', () => {
    const r = run('HK', { wages: 400000 });
    // Net 382,000; chargeable 250,000 → 1,000 + 3,000 + 5,000 + 7,000 + 8,500
    near(line(r, 'hk-sal').amount, 24500);
  });

  test('UAE has no personal income tax', () => {
    assert.equal(run('AE', { wages: 500000 }).totalTax, 0);
  });

  test('Ireland DIRT on deposit interest', () => {
    near(line(run('IE', { wages: 40000, interest: 1000 }), 'ie-inv').amount, 330);
  });

  test('every country has sources, a window and a sane result', () => {
    assert.equal(countries.length, 33);
    for (const def of world) {
      assert.ok(def.sources.length >= 2 && def.sources.every((s) => s.url.startsWith('https://')), def.code);
      assert.ok(def.window.start < def.window.end, def.code);
      assert.deepEqual(taxYearWindow(def.code), def.window);
      for (const wages of [0, 20000 * def.sample.scale, 80000 * def.sample.scale, 400000 * def.sample.scale]) {
        const r = run(def.code, { wages, interest: 500 * def.sample.scale, dividends: 500 * def.sample.scale, selfEmployment: { income: 10000 * def.sample.scale, expenses: 2000 * def.sample.scale } });
        for (const l of r.lines) assert.ok(Number.isFinite(l.amount) && l.amount >= 0, `${def.code} ${l.id}`);
        assert.ok(r.effectiveRate < 0.65, `${def.code} effective ${r.effectiveRate}`);
      }
    }
  });

  test('every sample statement is categorised confidently', () => {
    for (const def of world) {
      const tx = categorizeAll(generateSample(def.code), { country: def.code });
      assert.equal(tx.filter((t) => t.confidence < 0.5).length, 0, def.code);
      assert.ok(tx.some((t) => t.category === 'salary') && tx.some((t) => t.category === 'tax-payment'), def.code);
    }
  });
});
