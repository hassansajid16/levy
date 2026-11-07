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

export function createPlaidProvider(status) {
  return {
    id: 'plaid',
    kind: 'live',
    env: status.env,
    label: status.env === 'sandbox' ? 'Plaid (sandbox)' : 'Plaid',
    countries: status.countries,
    async listInstitutions() { return []; },
    /** Opens Plaid Link; resolves with the connection, or null if the person closes it. */
    async connect(_institutionId, { country }) {
      const [{ linkToken }, Plaid] = await Promise.all([
        call('link-token', { method: 'POST', body: JSON.stringify({ country }) }),
        loadLink(),
      ]);
      const result = await new Promise((resolve, reject) => {
        const handler = Plaid.create({
          token: linkToken,
          onSuccess: (publicToken, metadata) => resolve({ publicToken, institutionName: metadata?.institution?.name }),
          onExit: (err) => (err ? reject(new Error(err.display_message || err.error_message || 'Plaid Link closed with an error.')) : resolve(null)),
        });
        handler.open();
      });
      if (!result) return null;
      const conn = await call('exchange', { method: 'POST', body: JSON.stringify(result) });
      return { id: conn.id, institutionId: 'plaid', institutionName: conn.institutionName, country, accounts: conn.accounts };
    },
    async fetchTransactions(connection, { from, to }) {
      const q = new URLSearchParams({ connection: connection.id, from, to });
      return (await call(`transactions?${q}`)).transactions;
    },
    disconnect: (connection) => call(`connection/${encodeURIComponent(connection.id)}`, { method: 'DELETE' }),
  };
}
