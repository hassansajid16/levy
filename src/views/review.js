import { h, mount, icons } from '../ui/dom.js';
import { makeFormat } from '../ui/format.js';
import { categoryById, categoriesFor, groups } from '../categorize/categories.js';
import { inWindow } from '../categorize/summary.js';
import { taxYearWindow } from '../data/registry.js';
import { state, country, setCategory, setPay, summary } from '../store.js';
import { toast } from './toast.js';

const ui = { filter: 'all', query: '', limit: 25 };
const NEEDS_LOOK = 0.6;

const payDocs = { US: 'Form W-2', GB: 'P60', CA: 'T4 slip', AU: 'income statement' };

export function renderReview(main, go) {
  const c = country();
  const fmt = makeFormat(c.locale, c.currency);
  const window = taxYearWindow(c.code);
  const rerender = () => renderReview(main, go);
  const { totals, counts, inYear, outOfYear } = summary();

  const groupTotal = (g) => Object.entries(totals).filter(([k]) => categoryById[k]?.group === g).reduce((a, [, v]) => a + v, 0);
  const groupCount = (g) => Object.entries(counts).filter(([k]) => categoryById[k]?.group === g).reduce((a, [, v]) => a + v, 0);

  const all = state.transactions;
  const look = (t) => !t.manual && t.confidence < NEEDS_LOOK;
  const filters = [
    { id: 'all', label: 'All', test: () => true },
    ...groups.map((g) => ({ id: g.id, label: g.label, test: (t) => categoryById[t.category]?.group === g.id })),
    { id: 'look', label: 'Needs a look', test: look },
  ];
  const active = filters.find((f) => f.id === ui.filter) || filters[0];
  const q = ui.query.trim().toLowerCase();
  const rows = all.filter((t) => active.test(t) && (!q || t.description.toLowerCase().includes(q)));
  const shown = rows.slice(0, ui.limit);

  const kpis = h('div', { class: 'kpis', style: { '--n': 4 }, role: 'group', 'aria-label': 'Totals in the tax year' },
    [['income', 'Taxable income found'], ['deductible', 'Deductible costs'], ['tax', 'Tax already paid'], ['excluded', 'Not counted']].map(([g, label]) =>
      h('div', { class: 'kpi' },
        h('span', { class: 'label' }, label),
        h('span', { class: `value num${g === 'income' ? ' money' : ''}` }, fmt.money(groupTotal(g))),
        h('span', { class: 'note num' }, `${fmt.int(groupCount(g))} ${groupCount(g) === 1 ? 'transaction' : 'transactions'}`))));

  const net = totals.salary || 0;
  const pay = h('section', { class: 'panel', 'aria-labelledby': 'pay-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'pay-h' }, 'Your pay'),
      h('p', { class: 'num' }, `${fmt.money(net)} of take-home pay on your statements`)),
    h('fieldset', { class: 'pay-options' },
      h('legend', { class: 'visually-hidden' }, 'How to treat salary'),
      h('label', { class: 'radio-row' },
        h('input', { type: 'radio', name: 'paymode', value: 'net', checked: state.pay.mode !== 'gross', onchange: () => setPay({ mode: 'net' }) }),
        h('span', null, h('span', { class: 't' }, 'Work out my gross pay from take-home'),
          h('span', { class: 'hint', style: { display: 'block' } }, 'Assumes your employer withheld tax as if this job were your only income.'))),
      h('label', { class: 'radio-row' },
        h('input', { type: 'radio', name: 'paymode', value: 'gross', checked: state.pay.mode === 'gross', onchange: () => setPay({ mode: 'gross' }) }),
        h('span', null, h('span', { class: 't' }, `Enter the figures from my ${payDocs[c.code] || 'payslips or annual tax statement'}`),
          h('span', { class: 'hint', style: { display: 'block' } }, 'More accurate when you have it.')))),
    state.pay.mode === 'gross' ? h('div', { class: 'form-row', style: { marginTop: '14px' } },
      h('div', { class: 'field' }, h('label', { for: 'gross' }, 'Gross pay for the year'),
        h('input', { class: 'input num', id: 'gross', name: 'gross', inputmode: 'decimal', autocomplete: 'off', value: state.pay.gross, placeholder: '0.00', onchange: (e) => setPay({ gross: e.target.value.replace(/[^\d.]/g, '') }) })),
      h('div', { class: 'field' }, h('label', { for: 'withheld' }, c.code === 'US' ? 'Federal, state and FICA withheld' : c.code === 'GB' ? 'Tax and National Insurance deducted' : c.code === 'CA' ? 'Tax, CPP/QPP and EI deducted' : 'Tax withheld'),
        h('input', { class: 'input num', id: 'withheld', name: 'withheld', inputmode: 'decimal', autocomplete: 'off', value: state.pay.withheld, placeholder: '0.00', onchange: (e) => setPay({ withheld: e.target.value.replace(/[^\d.]/g, '') }) }))) : null);

  const chipCount = (f) => all.filter(f.test).length;
  const toolbar = h('div', { class: 'toolbar' },
    h('input', { class: 'input search', id: 'search', type: 'search', name: 'search', placeholder: 'Search descriptions…', 'aria-label': 'Search descriptions', spellcheck: false, value: ui.query, autocomplete: 'off',
      oninput: (e) => { ui.query = e.target.value; ui.limit = 25; rerender(); } }),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.applySimilar, onchange: (e) => { state.applySimilar = e.target.checked; } }), 'Apply changes to the same merchant'));
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by group', style: { marginBottom: '8px' } },
    filters.map((f) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(ui.filter === f.id), onclick: () => { ui.filter = f.id; ui.limit = 25; rerender(); } },
      f.label, h('span', { class: 'count' }, fmt.int(chipCount(f))))));

  const table = shown.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data responsive' },
    h('caption', { class: 'visually-hidden' }, 'Transactions and their categories'),
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Date'), h('th', { scope: 'col' }, 'Description'), h('th', { scope: 'col' }, 'Category'), h('th', { scope: 'col', class: 'num' }, 'Amount'))),
    h('tbody', null, shown.map((t) => {
      const outside = !inWindow(t, window);
      return h('tr', { class: outside ? 'out-of-year' : null },
        h('td', { class: 'date num c-date' }, fmt.date(t.date), outside ? h('span', { class: 'visually-hidden' }, ' (outside the tax year)') : null),
        h('td', { class: 'c-desc' }, h('div', { class: 'desc', title: t.description }, look(t) ? h('span', { class: 'guess', title: 'Low-confidence guess' }) : null, t.description),
          h('div', { class: 'hint' }, outside ? 'Outside the tax year, not counted' : t.source)),
        h('td', { class: 'c-cat' }, h('select', { class: 'input', 'aria-label': `Category for ${t.description}, ${fmt.cents(t.amount)}`,
          onchange: (e) => {
            const r = setCategory(t.id, e.target.value);
            toast(r.changed > 1 ? `${r.changed} transactions set to ${categoryById[e.target.value].label}.` : `Set to ${categoryById[e.target.value].label}.`, { label: 'Undo', run: r.undo });
          } },
          categoriesFor(c.code, t.amount).map((cat) => h('option', { value: cat.id, selected: cat.id === t.category }, cat.label)))),
        h('td', { class: `num c-amt${t.amount > 0 ? ' amount-in' : ''}` }, t.amount > 0 ? `+${fmt.cents(t.amount)}` : fmt.cents(t.amount)));
    })))) : h('p', { class: 'empty' }, q ? `No transactions match “${ui.query}”.` : 'No transactions in this group.');

  const txPanel = h('section', { class: 'panel', 'aria-labelledby': 'tx-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'tx-h' }, 'Transactions'),
      h('p', { class: 'num' }, `${fmt.int(inYear)} in the tax year${outOfYear ? ` · ${fmt.int(outOfYear)} outside it, not counted` : ''}`)),
    toolbar, chips, table,
    rows.length > shown.length ? h('div', { class: 'table-foot' },
      h('span', { class: 'num' }, `Showing ${fmt.int(shown.length)} of ${fmt.int(rows.length)}`),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { ui.limit += 100; rerender(); } }, 'Show more')) : null);

  const lookCount = all.filter(look).length;
  mount(main, h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('div', null, h('h1', null, 'Check the categories'),
        h('p', { class: 'sub' }, lookCount
          ? `${lookCount} ${lookCount === 1 ? 'guess needs' : 'guesses need'} a look. Income, deductible costs and tax payments change the estimate; everyday spending only feeds the sales tax note.`
          : 'Income, deductible costs and tax payments change the estimate; everyday spending only feeds the sales tax note.')),
      h('div', { class: 'title-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => go('estimate') }, 'See estimate', icons.arrow()))),
    h('div', { class: 'stack' }, kpis, pay, txPanel),
    h('div', { class: 'actions-row' },
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => go('statements') }, icons.back(), 'Statements'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => go('estimate') }, 'See estimate', icons.arrow()))));
}
