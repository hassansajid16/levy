// Demo provider: behaves like an aggregator (institutions, consent, accounts, a fetch with
// latency) but returns generated sample transactions. Nothing leaves the browser.
import { generateSample } from '../sample/generate.js';
import { taxYearWindow } from '../data/registry.js';

const INSTITUTIONS = [
  { id: 'larchmere', name: 'Larchmere Bank' },
  { id: 'quillstone', name: 'Quillstone Credit Union' },
  { id: 'brightwater', name: 'Brightwater Savings' },
  { id: 'halden', name: 'Halden Mutual' },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const demoProvider = {
  id: 'demo',
  kind: 'demo',
  label: 'Demo connection (sample data)',
  async listInstitutions(country) {
    return INSTITUTIONS.map((i) => ({ ...i, country }));
  },
  async connect(institutionId, { country }) {
    await wait(700);
    const inst = INSTITUTIONS.find((i) => i.id === institutionId) || INSTITUTIONS[0];
    return {
      id: `demo-${institutionId}`,
      institutionId,
      institutionName: inst.name,
      country,
      accounts: [{ id: 'chk', name: 'Everyday account', mask: '4821' }],
    };
  },
  async fetchTransactions(connection, { from, to } = {}) {
    await wait(900);
    const w = taxYearWindow(connection.country);
    // Every demo bank returns the same everyday account, so adding it next to the sample
    // statement de-duplicates instead of double-counting income.
    return generateSample(connection.country)
      .filter((t) => t.date >= (from || w.start) && t.date <= (to || w.end));
  },
  async disconnect() {},
};
