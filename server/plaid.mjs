// Plaid on the server side. The browser never sees the secret or the access tokens: it gets a
// short-lived Link token, hands back the public token from Plaid Link, and from then on asks for
// transactions by an opaque connection id. Access tokens live in this process's memory only and
// are gone when the server stops.
//
// Configure with environment variables or a .env file next to server.mjs:
//   PLAID_CLIENT_ID=...   PLAID_SECRET=...   PLAID_ENV=sandbox|production   PLAID_REDIRECT_URI=(optional)
import { randomUUID } from 'node:crypto';

export const PLAID_COUNTRIES = ['US', 'CA', 'GB', 'IE', 'FR', 'ES', 'NL', 'DE', 'IT', 'PL', 'BE', 'AT', 'DK', 'FI', 'NO', 'PT', 'SE', 'EE', 'LT', 'LV'];

const BASES = { sandbox: 'https://sandbox.plaid.com', production: 'https://production.plaid.com' };

export function plaidConfig(env = process.env) {
  const clientId = env.PLAID_CLIENT_ID?.trim();
  const secret = env.PLAID_SECRET?.trim();
  const name = (env.PLAID_ENV || 'sandbox').trim().toLowerCase();
  if (!clientId || !secret || !BASES[name]) return null;
  return { clientId, secret, env: name, base: BASES[name], redirectUri: env.PLAID_REDIRECT_URI?.trim() || null };
}

/** Plaid reports money out as positive; Levy uses money in as positive. */
export function mapPlaidTransaction(t) {
  return {
    date: t.date,
    description: (t.merchant_name && t.name && !t.name.toLowerCase().includes(t.merchant_name.toLowerCase()) ? `${t.merchant_name} ${t.name}` : t.name || t.merchant_name || 'Transaction').replace(/\s+/g, ' ').trim(),
    amount: Math.round(-t.amount * 100) / 100,
    pending: !!t.pending,
    accountId: t.account_id,
  };
}

export function createPlaid(cfg, { fetchImpl = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const connections = new Map(); // connectionId -> { accessToken, itemId, institutionName, accounts }

  async function call(path, body) {
    const res = await fetchImpl(`${cfg.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: cfg.clientId, secret: cfg.secret, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error_message || `Plaid request failed (${res.status})`);
      err.code = data.error_code; err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    status: () => ({ provider: 'plaid', env: cfg.env, countries: PLAID_COUNTRIES }),

    async linkToken(country) {
      if (!PLAID_COUNTRIES.includes(country)) throw Object.assign(new Error(`Plaid does not support ${country}.`), { status: 400 });
      const data = await call('/link/token/create', {
        client_name: 'Levy',
        user: { client_user_id: randomUUID() },
        products: ['transactions'],
        transactions: { days_requested: 730 },
        country_codes: [country],
        language: 'en',
        ...(cfg.redirectUri ? { redirect_uri: cfg.redirectUri } : {}),
      });
      return { linkToken: data.link_token };
    },

    async exchange(publicToken, institutionName) {
      if (typeof publicToken !== 'string' || !publicToken) throw Object.assign(new Error('Missing public token.'), { status: 400 });
      const ex = await call('/item/public_token/exchange', { public_token: publicToken });
      const acc = await call('/accounts/get', { access_token: ex.access_token });
      const id = randomUUID();
      const accounts = acc.accounts.map((a) => ({ id: a.account_id, name: a.official_name || a.name, mask: a.mask || '' }));
      connections.set(id, { accessToken: ex.access_token, itemId: ex.item_id, institutionName: String(institutionName || 'Your bank').slice(0, 80), accounts });
      return { id, institutionName: connections.get(id).institutionName, accounts };
    },

    async transactions(id, from, to) {
      const conn = connections.get(id);
      if (!conn) throw Object.assign(new Error('That bank connection has expired. Connect again.'), { status: 404 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw Object.assign(new Error('Bad date range.'), { status: 400 });
      const out = [];
      let offset = 0, total = Infinity, tries = 0;
      while (offset < total) {
        try {
          const page = await call('/transactions/get', { access_token: conn.accessToken, start_date: from, end_date: to, options: { count: 500, offset } });
          total = page.total_transactions;
          out.push(...page.transactions);
          offset += page.transactions.length;
          if (!page.transactions.length) break;
        } catch (err) {
          // Right after linking, Plaid may still be pulling history.
          if (err.code === 'PRODUCT_NOT_READY' && tries++ < 12) { await wait(2500); continue; }
          throw err;
        }
      }
      return { transactions: out.map(mapPlaidTransaction).filter((t) => !t.pending) };
    },

    async remove(id) {
      const conn = connections.get(id);
      if (!conn) return { removed: false };
      connections.delete(id);
      await call('/item/remove', { access_token: conn.accessToken }).catch(() => {});
      return { removed: true };
    },
  };
}

/**
 * Minimal .env reader (KEY=value lines, # comments). Real environment variables win. Within the
 * file, blank values are ignored and a later line overrides an earlier one, so keys pasted below
 * the template's empty lines still work.
 */
export function loadDotEnv(text, env = process.env) {
  const fromFile = {};
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value) fromFile[key] = value;
  }
  for (const [key, value] of Object.entries(fromFile)) if (!env[key]) env[key] = value;
  return env;
}
