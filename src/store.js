// App state. Profile and preferences live in localStorage; transactions live in sessionStorage
// only, so financial data is gone when the tab closes. Nothing is sent anywhere.
import { countryByCode, taxYearWindow } from './data/registry.js';
import { categorizeAll, merchantKey } from './categorize/rules.js';
import { summarize } from './categorize/summary.js';
import { grossUpFromNet, estimate } from './tax/engine.js';
import { dedupe } from './ingest/normalize.js';

export const DISCLAIMER_VERSION = 'v1';

const read = (store, key, fallback) => {
  try { const v = store.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const write = (store, key, value) => {
  try { store.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: keep in memory */ }
};

const listeners = new Set();

export const state = {
  profile: read(localStorage, 'levy.profile', { country: null, region: null, city: null, filingStatus: 'single', dependents: 0 }),
  sources: read(sessionStorage, 'levy.sources', []),        // [{ id, name, kind, count, skipped, from, to }]
  transactions: read(sessionStorage, 'levy.tx', []),        // categorised transactions
  pay: read(sessionStorage, 'levy.pay', { mode: 'net', gross: '', withheld: '' }),
  acknowledged: read(localStorage, 'levy.ack', null) === DISCLAIMER_VERSION,
  applySimilar: true,
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(); }

function persist() {
  write(localStorage, 'levy.profile', state.profile);
  write(sessionStorage, 'levy.sources', state.sources);
  write(sessionStorage, 'levy.tx', state.transactions);
  write(sessionStorage, 'levy.pay', state.pay);
}

export function setProfile(patch) {
  const prev = state.profile;
  state.profile = { ...prev, ...patch };
  if (patch.country && patch.country !== prev.country) {
    state.profile.region = null; state.profile.city = null;
    state.profile.filingStatus = 'single'; state.profile.dependents = 0;
    // Categories and tax years differ by country: start the statements afresh.
    state.transactions = []; state.sources = [];
  }
  if (patch.region && patch.region !== prev.region) state.profile.city = null;
  persist(); emit();
}

export function addTransactions(sourceInfo, rows) {
  const country = state.profile.country;
  const before = state.transactions.length;
  const tagged = rows.map((r, i) => ({ id: r.id || `${sourceInfo.id}-${i}`, date: r.date, description: r.description, amount: r.amount, source: sourceInfo.name }));
  const merged = dedupe([...state.transactions, ...categorizeAll(tagged, { country })]);
  const added = merged.length - before;
  const dates = rows.map((r) => r.date).sort();
  state.transactions = merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  state.sources = [...state.sources, { ...sourceInfo, count: added, duplicates: rows.length - added, from: dates[0], to: dates[dates.length - 1] }];
  persist(); emit();
  return added;
}

export function removeSource(id) {
  const src = state.sources.find((s) => s.id === id);
  if (!src) return;
  state.sources = state.sources.filter((s) => s.id !== id);
  state.transactions = state.transactions.filter((t) => t.source !== src.name);
  persist(); emit();
}

/** Set a category; with applySimilar, also every uncorrected transaction from the same merchant. */
export function setCategory(id, category) {
  const target = state.transactions.find((t) => t.id === id);
  if (!target) return { changed: 0, undo: () => {} };
  const key = merchantKey(target.description);
  const sameSign = (t) => Math.sign(t.amount) === Math.sign(target.amount);
  const snapshot = state.transactions.map((t) => ({ id: t.id, category: t.category, confidence: t.confidence, manual: t.manual }));
  let changed = 0;
  state.transactions = state.transactions.map((t) => {
    const hit = t.id === id || (state.applySimilar && !t.manual && sameSign(t) && merchantKey(t.description) === key);
    if (!hit || t.category === category) return t.id === id ? { ...t, manual: true, confidence: 1 } : t;
    changed++;
    return { ...t, category, confidence: 1, manual: t.id === id ? true : t.manual };
  });
  persist(); emit();
  return {
    changed,
    undo: () => {
      const byId = new Map(snapshot.map((s) => [s.id, s]));
      state.transactions = state.transactions.map((t) => ({ ...t, ...byId.get(t.id) }));
      persist(); emit();
    },
  };
}

export function restoreSources({ sources, tx }) { state.sources = sources; state.transactions = tx; persist(); emit(); }

export function setPay(patch) { state.pay = { ...state.pay, ...patch }; persist(); emit(); }

export function acknowledge() {
  state.acknowledged = true;
  write(localStorage, 'levy.ack', DISCLAIMER_VERSION);
  emit();
}

export function resetAll() {
  state.transactions = []; state.sources = []; state.pay = { mode: 'net', gross: '', withheld: '' };
  state.profile = { country: null, region: null, city: null, filingStatus: 'single', dependents: 0 };
  try { sessionStorage.clear(); localStorage.removeItem('levy.profile'); } catch { /* ignore */ }
  emit();
}

export function country() { return countryByCode[state.profile.country] || null; }
export function region() { return country()?.regions.find((r) => r.code === state.profile.region) || null; }

export function locationComplete() {
  const c = country(); const r = region();
  if (!c) return false;
  if (!c.regions.length) return true;
  if (!r) return false;
  if (r.cityRequired && !state.profile.city) return false;
  return true;
}

export function summary() {
  return summarize(state.transactions, { window: taxYearWindow(state.profile.country) });
}

/** Everything the estimate screen needs, derived from the state. */
export function computeEstimate() {
  const { input, totals, inYear, outOfYear } = summary();
  const p = state.profile;
  const net = input.wages || 0;
  let wages, withheld, payBasis;
  const gross = parseFloat(state.pay.gross);
  if (state.pay.mode === 'gross' && gross > 0) {
    wages = gross;
    withheld = parseFloat(state.pay.withheld) || 0;
    payBasis = 'entered';
  } else {
    const g = grossUpFromNet(p, net);
    wages = g.gross; withheld = g.withheld; payBasis = 'estimated';
  }
  const result = estimate(p, { ...input, wages, withheld });
  return { result, input, totals, net, wages, withheld, payBasis, inYear, outOfYear };
}
