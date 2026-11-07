import { h, mount, icons } from '../ui/dom.js';
import { makeFormat } from '../ui/format.js';
import { ACCEPTED, readStatement } from '../ingest/index.js';
import { parseCSV } from '../ingest/csv.js';
import { sampleCSV } from '../sample/generate.js';
import { getProvider, bankStatus } from '../bank/provider.js';
import { taxYearWindow } from '../data/registry.js';
import { state, country, addTransactions, removeSource, restoreSources } from '../store.js';
import { toast } from './toast.js';

const ui = { country: null, errors: [], busy: false, bank: null, bankStep: 'idle', bankProgress: 0, institutions: null };

function sourceId() { return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

async function handleFiles(files, rerender) {
  const c = country();
  ui.errors = []; ui.busy = true; rerender();
  for (const file of files) {
    try {
      const res = await readStatement(file, { dateOrder: c.dateOrder });
      if (!res.transactions.length) throw new Error(`${file.name}: no transactions found.`);
      const added = addTransactions({ id: sourceId(), name: file.name, kind: res.kind.toUpperCase(), skipped: res.skipped }, res.transactions);
      toast(`${file.name}: ${added} transactions added${res.skipped ? `, ${res.skipped} lines skipped` : ''}.`);
    } catch (err) {
      ui.errors.push(err.message.startsWith(file.name) ? err.message : `${file.name}: ${err.message}`);
    }
  }
  ui.busy = false; rerender();
}

function loadSampleStatement() {
  const c = country();
  const name = `sample-statement-${c.code.toLowerCase()}.csv`;
  if (state.sources.some((s) => s.name === name)) return;
  const { transactions, skipped } = parseCSV(sampleCSV(c.code), { dateOrder: c.dateOrder, source: name });
  const added = addTransactions({ id: sourceId(), name, kind: 'CSV', skipped, sample: true }, transactions);
  toast(`Sample statement loaded: ${added} transactions.`);
}

async function connectBank(rerender, dialog, fmt) {
  const c = country();
  const provider = getProvider(c.code);
  const inst = provider.kind === 'demo' ? ui.institutions.find((i) => i.id === ui.bank) : null;
  // The demo shows a consent step like an aggregator's; Plaid Link shows its own.
  const ok = provider.kind !== 'demo' || await new Promise((resolve) => {
    mount(dialog, h('form', { method: 'dialog' },
      h('div', { class: 'dialog-body' },
        h('h2', { id: 'consent-h' }, `Share ${inst.name} data with Levy`),
        provider.kind === 'demo' ? h('p', { class: 'notice' }, h('strong', null, 'Demo connection. '), 'No real bank is contacted. Levy generates a year of realistic sample transactions on this device.') : null,
        h('p', null, 'Levy will be able to read:'),
        h('ul', null, h('li', null, 'Account name and the last four digits'), h('li', null, `Transactions from ${fmt.date(taxYearWindow(c.code).start)} to ${fmt.date(taxYearWindow(c.code).end)}`)),
        h('p', { class: 'muted' }, 'Levy cannot move money. You can remove the connection at any time.')),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-ghost', value: 'cancel' }, 'Cancel'),
        h('button', { class: 'btn btn-primary', value: 'allow', autofocus: true }, provider.kind === 'demo' ? 'Allow (demo)' : 'Allow'))));
    dialog.setAttribute('aria-labelledby', 'consent-h');
    dialog.onclose = () => resolve(dialog.returnValue === 'allow');
    dialog.showModal();
  });
  if (!ok) return;
  try {
    ui.errors = [];
    ui.bankStep = 'connecting'; ui.bankProgress = 30; rerender();
    const conn = await provider.connect(ui.bank, { country: c.code });
    if (!conn) { ui.bankStep = 'idle'; rerender(); return; }
    ui.bankStep = 'fetching'; ui.bankProgress = 70; rerender();
    const rows = await provider.fetchTransactions(conn, taxYearWindow(c.code));
    if (!rows.length) throw new Error(`${conn.institutionName} returned no transactions for the tax year.`);
    ui.bankProgress = 100;
    const added = addTransactions({ id: sourceId(), name: `${conn.institutionName}${conn.accounts[0]?.mask ? ` ···${conn.accounts[0].mask}` : ''}`, kind: provider.kind === 'demo' ? 'Demo bank' : 'Bank', skipped: 0, demo: provider.kind === 'demo' }, rows);
    ui.bankStep = 'idle';
    toast(`${conn.institutionName}: ${added} transactions added.`);
  } catch (err) {
    ui.bankStep = 'error'; ui.errors = [err.message];
  }
  rerender();
}

export function renderStatements(main, go) {
  const c = country();
  const fmt = makeFormat(c.locale, c.currency);
  const rerender = () => renderStatements(main, go);
  const dialog = document.getElementById('dialog');
  const provider = getProvider(c.code);
  const plaidElsewhere = provider.kind === 'demo' && bankStatus().provider === 'plaid';
  if (ui.country !== c.code) { resetStatementsUI(); ui.country = c.code; }
  if (!ui.institutions) provider.listInstitutions(c.code).then((list) => { ui.institutions = list; ui.bank ||= list[0]?.id; rerender(); });

  const fileInput = h('input', { type: 'file', id: 'file', accept: ACCEPTED, multiple: true, class: 'visually-hidden', 'aria-describedby': 'file-hint',
    onchange: (e) => { handleFiles([...e.target.files], rerender); e.target.value = ''; } });
  const drop = h('label', { class: 'drop', for: 'file',
    ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('is-over'); },
    ondragleave: (e) => e.currentTarget.classList.remove('is-over'),
    ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('is-over'); handleFiles([...e.dataTransfer.files], rerender); } },
    icons.upload(),
    h('span', { class: 'big' }, ui.busy ? 'Reading…' : 'Drop statements here or choose files'),
    h('span', { class: 'hint', id: 'file-hint' }, 'CSV, OFX, QFX or text PDF, up to 20 MB each. Read on this device, never uploaded.'));

  const upload = h('section', { class: 'panel', 'aria-labelledby': 'up-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'up-h' }, 'Upload statements'),
      h('button', { class: 'btn-text btn', type: 'button', onclick: loadSampleStatement }, 'Use a sample statement')),
    fileInput, drop,
    ui.errors.length ? h('div', { class: 'error-text', role: 'alert', style: { marginTop: '12px' } }, ui.errors.map((e) => h('p', null, e))) : null,
    state.sources.length
      ? h('ul', { class: 'file-list', 'aria-label': 'Added sources' }, state.sources.map((s) => h('li', null,
          h('div', { style: { minWidth: 0 } },
            h('div', { class: 'fname' }, s.name),
            h('div', { class: 'hint num' }, `${fmt.int(s.count)} transactions · ${fmt.shortDate(s.from)} – ${fmt.date(s.to)}${s.duplicates ? ` · ${s.duplicates} duplicates skipped` : ''}${s.skipped ? ` · ${s.skipped} lines unreadable` : ''}`)),
          h('span', { class: s.demo || s.sample ? 'pill pill-accent' : 'pill' }, s.demo ? 'Demo' : s.sample ? 'Sample' : s.kind),
          h('button', { class: 'btn icon-btn btn-ghost', type: 'button', 'aria-label': `Remove ${s.name}`, onclick: () => { const snapshot = { sources: [...state.sources], tx: [...state.transactions] }; removeSource(s.id); toast(`Removed ${s.name}.`, { label: 'Undo', run: () => restoreSources(snapshot) }); } }, icons.trash()))))
      : null);

  const banks = ui.institutions || [];
  const connecting = ui.bankStep === 'connecting' || ui.bankStep === 'fetching';
  const connect = h('section', { class: 'panel', 'aria-labelledby': 'bank-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'bank-h' }, 'Connect a bank'),
      provider.kind === 'demo' ? h('span', { class: 'pill pill-warning' }, 'Demo only') : h('span', { class: 'pill pill-accent' }, provider.label)),
    h('p', { class: 'muted', style: { marginBottom: '14px' } }, provider.kind !== 'demo'
      ? `Sign in to your bank in Plaid’s secure window. Levy reads ${c.name} transactions for the tax year and cannot move money.`
      : plaidElsewhere
        ? `Plaid doesn’t cover ${c.name}, so this is the demo connection with sample transactions.`
        : 'Add Plaid keys to the .env file to connect a real bank (see the README). Until then, this demo walks through the same steps with sample transactions.'),
    provider.kind !== 'demo' && provider.env === 'sandbox' ? h('p', { class: 'notice', style: { marginBottom: '14px' } }, h('strong', null, 'Plaid sandbox. '), 'Pick any bank in Plaid’s window and sign in with Plaid’s test login: username user_good, password pass_good.') : null,
    provider.kind !== 'demo' ? null : h('fieldset', { disabled: connecting },
      h('legend', { class: 'visually-hidden' }, 'Bank'),
      h('ul', { class: 'bank-list' }, banks.map((b) => h('li', null, h('label', { class: 'bank-option' },
        h('input', { type: 'radio', name: 'bank', value: b.id, checked: ui.bank === b.id, onchange: () => { ui.bank = b.id; } }),
        h('span', { class: 'bank-glyph', 'aria-hidden': 'true' }, b.name.split(' ').map((w) => w[0]).join('').slice(0, 2)),
        h('span', { class: 'grow' }, b.name),
        provider.kind === 'demo' ? h('span', { class: 'hint' }, 'Sample data') : null))))),
    connecting ? h('div', { role: 'status' },
      h('p', { class: 'status-line' }, ui.bankStep === 'connecting' ? 'Connecting…' : 'Fetching transactions…'),
      h('div', { class: 'progress' }, h('span', { style: { width: `${ui.bankProgress}%` } }))) : null,
    h('div', { class: 'actions-row', style: { marginTop: '4px' } },
      h('button', { class: provider.kind === 'demo' ? 'btn btn-ghost' : 'btn btn-primary', type: 'button', disabled: (provider.kind === 'demo' && !ui.bank) || connecting, onclick: () => connectBank(rerender, dialog, fmt) }, icons.bank(), provider.kind === 'demo' ? 'Connect demo bank' : 'Connect with Plaid')));

  const n = state.transactions.length;
  mount(main, h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('div', null, h('h1', null, 'Add your statements'),
        h('p', { class: 'sub' }, `Add every account that received pay or paid deductible costs during the ${c.taxYearLabel.replace(/^(Tax|Income) year /, '').replace(/ \(.*/, '')} tax year.`))),
    h('div', { class: 'grid-2' }, upload, connect),
    h('div', { class: 'actions-row' },
      h('span', { class: 'spacer num', role: 'status' }, n ? `${fmt.int(n)} transactions from ${state.sources.length} ${state.sources.length === 1 ? 'source' : 'sources'}` : 'No statements yet'),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => go('start') }, icons.back(), 'Back'),
      h('button', { class: 'btn btn-primary', type: 'button', disabled: !n, onclick: () => go('review') }, 'Review categories', icons.arrow()))));
}

export function resetStatementsUI() { ui.errors = []; ui.institutions = null; ui.bank = null; ui.bankStep = 'idle'; }
