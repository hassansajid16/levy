// The bank connection seam. The app talks only to a BankProvider:
//
// interface BankProvider {
//   id: string; kind: 'demo' | 'live'; label: string;
//   listInstitutions(country): Promise<Institution[]>;   // empty when the provider has its own picker
//   connect(institutionId, { country }): Promise<Connection | null>;
//   fetchTransactions(connection, { from, to }): Promise<{date, description, amount}[]>;
//   disconnect(connection): Promise<void>;
// }
//
// Plaid is used when the Levy server has Plaid keys and Plaid covers the chosen country;
// otherwise the demo provider is used.
import { demoProvider } from './demo.js';
import { createPlaidProvider } from './aggregator.js';

let plaid = null;
let status = { provider: 'demo' };

/** Ask the local server which provider is available. Never throws. */
export async function initBank() {
  try {
    const res = await fetch('/api/bank/status', { signal: AbortSignal.timeout(3000) });
    status = await res.json();
    plaid = status.provider === 'plaid' ? createPlaidProvider(status) : null;
  } catch { status = { provider: 'demo' }; plaid = null; }
  return status;
}

export function bankStatus() { return status; }

export function getProvider(country) {
  if (plaid && (!country || plaid.countries.includes(country))) return plaid;
  return demoProvider;
}
