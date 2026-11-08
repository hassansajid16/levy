// Plaid provider (browser side). The Levy server holds the Plaid secret and the access tokens;
// this file only opens Plaid Link and asks the server for transactions. See server/plaid.mjs.

const LINK_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

async function call(path, init) {
  const res = await fetch(`/api/bank/${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Bank service error (${res.status})`);
  return body;
}

let scriptPromise;
function loadLink() {
  if (window.Plaid) return Promise.resolve(window.Plaid);
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LINK_SCRIPT;
    s.onload = () => (window.Plaid ? resolve(window.Plaid) : reject(new Error('Plaid Link did not load.')));
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load Plaid Link. Check your internet connection.')); };
    document.head.append(s);
  });
  return scriptPromise;
}

// OAuth banks (most UK and EU banks, some US ones) send the person to the bank's own site and back
// to /oauth?oauth_state_id=... . Link then has to be reopened with the same token and that URL.
// The URL is read when this module loads, before the app rewrites the address.
const PENDING_KEY = 'levy.plaidOAuth';
const oauthReturn = location.pathname === '/oauth' && /[?&]oauth_state_id=/.test(location.search)
  ? location.href.split('#')[0] : null;

function readPending() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; }
}
function writePending(value) {
  try { value ? sessionStorage.setItem(PENDING_KEY, JSON.stringify(value)) : sessionStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ }
}

/** Opens Link and resolves with { publicToken, institutionName }, or null if the person closes it. */
async function openLink(token, receivedRedirectUri) {
  const Plaid = await loadLink();
  return new Promise((resolve, reject) => {
    const handler = Plaid.create({
      token,
      ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
      onSuccess: (publicToken, metadata) => resolve({ publicToken, institutionName: metadata?.institution?.name }),
      onExit: (err) => (err ? reject(new Error(err.display_message || err.error_message || 'Plaid Link closed with an error.')) : resolve(null)),
    });
    handler.open();
  });
}

export function createPlaidProvider(status) {
  async function finish(result, country) {
    writePending(null);
    if (!result) return null;
    const conn = await call('exchange', { method: 'POST', body: JSON.stringify(result) });
    return { id: conn.id, institutionId: 'plaid', institutionName: conn.institutionName, country, accounts: conn.accounts };
  }
  return {
    id: 'plaid',
    kind: 'live',
    env: status.env,
    label: status.env === 'sandbox' ? 'Plaid (sandbox)' : 'Plaid',
    countries: status.countries,
    async listInstitutions() { return []; },
    /** Opens Plaid Link; resolves with the connection, or null if the person closes it. */
    async connect(_institutionId, { country }) {
      const { linkToken } = await call('link-token', { method: 'POST', body: JSON.stringify({ country }) });
      writePending({ linkToken, country });
      try { return await finish(await openLink(linkToken), country); } catch (err) { writePending(null); throw err; }
    },
    /** True when the page was opened by a bank sending the person back mid-connection. */
    hasOAuthReturn: () => Boolean(oauthReturn && readPending()),
    async resumeOAuth() {
      const pending = readPending();
      history.replaceState(null, '', '/#/statements');
      if (!pending) return null;
      try { return await finish(await openLink(pending.linkToken, oauthReturn), pending.country); } catch (err) { writePending(null); throw err; }
    },
    async fetchTransactions(connection, { from, to }) {
      const q = new URLSearchParams({ connection: connection.id, from, to });
      return (await call(`transactions?${q}`)).transactions;
    },
    disconnect: (connection) => call(`connection/${encodeURIComponent(connection.id)}`, { method: 'DELETE' }),
  };
}
