import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseAmount, inferDateOrder, dedupe } from '../src/ingest/normalize.js';
import { parseCSV, tokenizeCSV } from '../src/ingest/csv.js';
import { parseOFX } from '../src/ingest/ofx.js';
import { parsePdfLines } from '../src/ingest/pdf.js';
import { categorize, categorizeAll, merchantKey } from '../src/categorize/rules.js';
import { summarize } from '../src/categorize/summary.js';
import { generateSample, sampleCSV } from '../src/sample/generate.js';
import { taxYearWindow } from '../src/data/registry.js';
import { estimate, grossUpFromNet } from '../src/tax/engine.js';

describe('dates and amounts', () => {
  test('parses common date formats', () => {
    assert.equal(parseDate('2025-03-04'), '2025-03-04');
    assert.equal(parseDate('03/04/2025', 'MDY'), '2025-03-04');
    assert.equal(parseDate('03/04/2025', 'DMY'), '2025-04-03');
    assert.equal(parseDate('31/01/2025', 'MDY'), '2025-01-31'); // unambiguous wins over order
    assert.equal(parseDate('4 Mar 2025'), '2025-03-04');
    assert.equal(parseDate('Mar 4, 2025'), '2025-03-04');
    assert.equal(parseDate('20250304120000[-5:EST]'), '2025-03-04');
    assert.equal(parseDate('not a date'), null);
  });
  test('infers date order from the column', () => {
    assert.equal(inferDateOrder(['01/02/2025', '25/02/2025']), 'DMY');
    assert.equal(inferDateOrder(['01/02/2025', '02/25/2025']), 'MDY');
  });
  test('parses amounts in bank formats', () => {
    assert.equal(parseAmount('1,234.56'), 1234.56);
    assert.equal(parseAmount('-1,234.56'), -1234.56);
    assert.equal(parseAmount('(45.00)'), -45);
    assert.equal(parseAmount('£12.50'), 12.5);
    assert.equal(parseAmount('45.00-'), -45);
    assert.equal(parseAmount('1.234,56'), 1234.56);
    assert.equal(parseAmount('100.00 CR'), 100);
    assert.equal(parseAmount(''), null);
    assert.equal(parseAmount('abc'), null);
  });
});

describe('CSV', () => {
  test('handles quotes, embedded commas and a signed amount column', () => {
    const csv = 'Date,Description,Amount\n01/15/2025,"ACME, INC PAYROLL",2500.00\n01/16/2025,"Cafe ""Blue""",-4.50\n';
    const { transactions } = parseCSV(csv, { dateOrder: 'MDY' });
    assert.equal(transactions.length, 2);
    assert.equal(transactions[0].description, 'ACME, INC PAYROLL');
    assert.equal(transactions[1].description, 'Cafe "Blue"');
    assert.equal(transactions[1].amount, -4.5);
  });
  test('handles separate debit and credit columns and semicolons', () => {
    const csv = 'Booking date;Details;Debit;Credit\n05/04/2025;Rent;1200,00;\n06/04/2025;Salary;;2400,00\n';
    const { transactions } = parseCSV(csv, { dateOrder: 'DMY' });
    assert.deepEqual(transactions.map((t) => [t.date, t.amount]), [['2025-04-05', -1200], ['2025-04-06', 2400]]);
  });
  test('skips preamble rows above the header', () => {
    const csv = 'Account,12345678\nStatement,2025\n\nDate,Description,Amount,Balance\n2025-02-01,Interest,1.20,100.00\n';
    assert.equal(parseCSV(csv).transactions.length, 1);
  });
  test('tokenizer keeps newlines inside quotes', () => {
    assert.deepEqual(tokenizeCSV('a,"b\nc"\n1,2'), [['a', 'b\nc'], ['1', '2']]);
  });
  test('round-trips the generated sample statement for every country', () => {
    for (const c of ['US', 'GB', 'CA', 'AU']) {
      const { transactions } = parseCSV(sampleCSV(c), { dateOrder: c === 'US' ? 'MDY' : 'DMY' });
      const sample = generateSample(c);
      assert.equal(transactions.length, sample.length, c);
      assert.equal(transactions[10].date, sample[10].date, c);
      assert.equal(transactions[10].amount, sample[10].amount, c);
    }
  });
});

describe('OFX', () => {
  test('parses SGML transactions', () => {
    const ofx = '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20250131<TRNAMT>1500.00<FITID>1<NAME>PAYROLL &amp; CO</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250201<TRNAMT>-12.40<NAME>CAFE<MEMO>CARD 1234</STMTTRN></BANKTRANLIST></OFX>';
    const { transactions } = parseOFX(ofx);
    assert.equal(transactions.length, 2);
    assert.equal(transactions[0].description, 'PAYROLL & CO');
    assert.equal(transactions[1].description, 'CAFE CARD 1234');
    assert.equal(transactions[1].amount, -12.4);
  });
});

describe('PDF line reader', () => {
  const L = (...cells) => cells.map(([x, str]) => ({ x, str }));
  test('uses column positions to sign amounts', () => {
    const lines = [
      L([40, 'Date'], [110, 'Description'], [370, 'Paid out'], [440, 'Paid in'], [510, 'Balance']),
      L([110, 'Balance brought forward'], [510, '1,000.00']),
      L([40, '02 Apr 2025'], [110, 'VALLEY SUPERMARKET'], [370, '42.10'], [510, '957.90']),
      L([40, '25 Apr 2025'], [110, 'HARTWELL ENGINEERING LTD SALARY'], [440, '2,780.00'], [510, '3,737.90']),
    ];
    const { transactions } = parsePdfLines(lines);
    assert.deepEqual(transactions.map((t) => [t.date, t.amount, t.description]), [
      ['2025-04-02', -42.1, 'VALLEY SUPERMARKET'],
      ['2025-04-25', 2780, 'HARTWELL ENGINEERING LTD SALARY'],
    ]);
  });
  test('falls back to the running balance', () => {
    const lines = [
      L([10, 'Opening balance'], [300, '500.00']),
      L([10, '03/01/2025'], [60, 'Coffee'], [250, '4.00'], [300, '496.00']),
      L([10, '03/02/2025'], [60, 'Refund'], [250, '10.00'], [300, '506.00']),
    ];
    const { transactions } = parsePdfLines(lines, { dateOrder: 'MDY' });
    assert.deepEqual(transactions.map((t) => t.amount), [-4, 10]);
  });
});

describe('categoriser', () => {
  const cases = [
    ['NORTHWIND LOGISTICS PAYROLL DIRECT DEP', 2420, 'salary'],
    ['INVOICE 1012 CLIENT PAYMENT', 900, 'freelance'],
    ['INTEREST PAID SAVINGS', 4.2, 'interest'],
    ['DIVIDEND PAYMENT BROKERAGE', 120, 'dividends'],
    ['IRS USATAXPYMT ESTIMATED TAX', -900, 'tax-payment'],
    ['HMRC SELF ASSESSMENT', -650, 'tax-payment'],
    ['IRS TREAS 310 TAX REF', 812, 'tax-refund'],
    ['RRSP CONTRIBUTION', -300, 'retirement'],
    ['GIFT AID DONATION HOSPICE CHARITY', -20, 'charity'],
    ['VALLEY SUPERMARKET', -42, 'groceries'],
    ['BLUE DOOR CAFE', -12, 'dining'],
    ['CLOUDNEST WEB HOSTING', -12, 'business'],
    ['TRANSFER TO SAVINGS', -200, 'transfer-out'],
    ['RENT FALCON LETTINGS', -1250, 'housing'],
    ['SOMETHING UNKNOWN', -10, 'other-spend'],
  ];
  for (const [d, a, want] of cases) test(`${d} → ${want}`, () => assert.equal(categorize({ description: d, amount: a }, { country: 'US' }).category, want));

  test('merchant key ignores store numbers', () => {
    assert.equal(merchantKey('GREENLEAF GROCERY #104'), merchantKey('GREENLEAF GROCERY #131'));
  });

  test('dedupe removes overlapping statement lines', () => {
    const t = { date: '2025-01-01', amount: -5, description: 'Cafe' };
    assert.equal(dedupe([t, { ...t }, { ...t, amount: -6 }]).length, 2);
  });
});

describe('end to end with the sample statement', () => {
  for (const c of ['US', 'GB', 'CA', 'AU']) {
    test(`${c}: every sample line is categorised and the estimate is sane`, () => {
      const window = taxYearWindow(c);
      const tx = categorizeAll(generateSample(c), { country: c });
      assert.ok(tx.every((t) => t.category), 'all categorised');
      const lowConfidence = tx.filter((t) => t.confidence < 0.5);
      assert.equal(lowConfidence.length, 0, `unrecognised: ${lowConfidence.map((t) => t.description).join(', ')}`);
      const { input, inYear } = summarize(tx, { window });
      assert.equal(inYear, tx.length);
      assert.ok(input.wages > 20000 && input.selfEmployment.income > 2000 && input.interest > 0);
      const region = { US: 'NY', GB: 'ENG', CA: 'ON', AU: 'NSW' }[c];
      const profile = { country: c, region, city: c === 'US' ? 'nyc' : undefined, filingStatus: 'single' };
      const { gross, withheld } = grossUpFromNet(profile, input.wages);
      const r = estimate(profile, { ...input, wages: gross, withheld });
      assert.ok(r.totalTax > 0 && r.effectiveRate > 0.05 && r.effectiveRate < 0.5, `${c} effective ${r.effectiveRate}`);
      assert.ok(r.balance > 0, 'freelance income leaves a balance to pay before prepayments');
    });
  }
});
