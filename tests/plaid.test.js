// Plaid server logic against a mocked Plaid API (no network, no keys).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPlaid, plaidConfig, mapPlaidTransaction, loadDotEnv, PLAID_COUNTRIES } from '../server/plaid.mjs';

function mockPlaid({ notReadyTimes = 0, total = 3 } = {}) {
  const calls = [];
  const txs = Array.from({ length: total }, (_, i) => ({ date: `2025-03-0${i + 1}`, name: `Shop ${i}`, merchant_name: null, amount: 10 + i, pending: false, account_id: 'a1' }));
  let notReady = notReadyTimes;
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body);
    calls.push({ path, body });
    const ok = (data) => ({ ok: true, status: 200, json: async () => data });
    if (path === '/link/token/create') return ok({ link_token: 'link-sandbox-123' });
    if (path === '/item/public_token/exchange') return ok({ access_token: 'access-sandbox-secret', item_id: 'item-1' });
    if (path === '/accounts/get') return ok({ accounts: [{ account_id: 'a1', name: 'Checking', mask: '0000' }] });
    if (path === '/transactions/get') {
      if (notReady-- > 0) return { ok: false, status: 400, json: async () => ({ error_code: 'PRODUCT_NOT_READY', error_message: 'not ready' }) };
      const { offset, count } = body.options;
      return ok({ total_transactions: txs.length, transactions: txs.slice(offset, offset + Math.min(count, 2)) });
    }
    if (path === '/item/remove') return ok({});
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { calls, fetchImpl };
}

const cfg = { clientId: 'id', secret: 'shh', env: 'sandbox', base: 'https://sandbox.plaid.com', redirectUri: null };

describe('Plaid integration (server side)', () => {
  test('is off without keys', () => {
    assert.equal(plaidConfig({}), null);
    assert.equal(plaidConfig({ PLAID_CLIENT_ID: 'x', PLAID_SECRET: 'y', PLAID_ENV: 'nonsense' }), null);
    assert.equal(plaidConfig({ PLAID_CLIENT_ID: 'x', PLAID_SECRET: 'y' }).env, 'sandbox');
  });

  test('link, exchange, fetch all pages, retry while not ready, remove', async () => {
    const { calls, fetchImpl } = mockPlaid({ notReadyTimes: 2, total: 5 });
    const plaid = createPlaid(cfg, { fetchImpl, wait: async () => {} });
    assert.equal((await plaid.linkToken('GB')).linkToken, 'link-sandbox-123');
    assert.deepEqual(calls[0].body.country_codes, ['GB']);
    const conn = await plaid.exchange('public-sandbox-abc', 'First Platypus Bank');
    assert.equal(conn.institutionName, 'First Platypus Bank');
    assert.equal(JSON.stringify(conn).includes('access-sandbox-secret'), false, 'access token never leaves the server');
    const { transactions } = await plaid.transactions(conn.id, '2025-01-01', '2025-12-31');
    assert.equal(transactions.length, 5);
    assert.equal(transactions[0].amount, -10, 'Plaid money out becomes negative');
    assert.equal((await plaid.remove(conn.id)).removed, true);
    await assert.rejects(plaid.transactions(conn.id, '2025-01-01', '2025-12-31'), /expired/);
  });

  test('rejects unsupported countries and bad dates', async () => {
    const plaid = createPlaid(cfg, mockPlaid());
    await assert.rejects(plaid.linkToken('IN'), /does not support/);
    const conn = await plaid.exchange('p', 'Bank');
    await assert.rejects(plaid.transactions(conn.id, 'yesterday', '2025-12-31'), /Bad date/);
  });

  test('maps descriptions and signs', () => {
    assert.deepEqual(mapPlaidTransaction({ date: '2025-01-02', name: 'PAYROLL ACME', merchant_name: null, amount: -2500, account_id: 'a' }).amount, 2500);
    assert.equal(mapPlaidTransaction({ date: '2025-01-02', name: 'SQ *BLUE DOOR', merchant_name: 'Blue Door Cafe', amount: 4.5 }).description, 'Blue Door Cafe SQ *BLUE DOOR');
  });

  test('reads .env without overriding the environment', () => {
    const env = { PLAID_ENV: 'production' };
    loadDotEnv('# keys\nPLAID_CLIENT_ID=abc\nPLAID_SECRET="s3cret"\nPLAID_ENV=sandbox\n', env);
    assert.deepEqual(env, { PLAID_ENV: 'production', PLAID_CLIENT_ID: 'abc', PLAID_SECRET: 's3cret' });
  });

  test('covers the countries Plaid supports', () => {
    for (const c of ['US', 'CA', 'GB', 'IE', 'DE', 'FR', 'ES', 'NL']) assert.ok(PLAID_COUNTRIES.includes(c));
  });
});
