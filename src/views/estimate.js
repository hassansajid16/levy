import { h, mount, icons } from '../ui/dom.js';
import { makeFormat } from '../ui/format.js';
import { state, country, region, computeEstimate } from '../store.js';
import { DISCLAIMER } from './shell.js';

const LEVEL_COLOR = { national: 'var(--accent)', state: 'var(--accent-2)', local: 'var(--accent-3)', social: 'var(--accent-4)' };
const LEVEL_NAME = { national: 'National', state: 'State or provincial', local: 'Local', social: 'Social contributions' };

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

function exportCSV(view, c, r, where) {
  const rows = [
    ['Levy tax estimate'], ['Location', where], ['Tax year', r.taxYearLabel], ['Generated', new Date().toISOString().slice(0, 10)], [],
    ['Tax', 'Jurisdiction', 'Tax year', 'Applies to', 'Base', `Amount (${c.currency})`],
    ...view.lines.map((l) => [l.name, l.jurisdiction, l.taxYear, l.baseLabel, Math.round(l.base), l.shown]),
    ['Total tax', '', '', '', '', view.total], [],
    ['Total income', Math.round(r.totalIncome)], [r.taxableLabel, Math.round(r.taxableIncome)],
    ['Withheld from pay', view.withheld], ['Paid to the tax authority', view.prepaid], [view.balance >= 0 ? 'Estimated balance to pay' : 'Estimated refund', Math.abs(view.balance)],
    ['Effective rate', `${(view.effective * 100).toFixed(1)}%`], ['Marginal rate', `${(r.marginalRate * 100).toFixed(1)}%`], [],
    ['Deductions and allowances used'], ...r.deductionsUsed.map((d) => [d.label, Math.round(d.amount)]), [],
    ['Sources'], ...r.sources.map((s) => [s.name, s.url]), [],
    ['Disclaimer', [...DISCLAIMER.body, DISCLAIMER.consult(c.authority.name)].join(' ')],
  ];
  download(`levy-estimate-${c.code.toLowerCase()}-${c.taxYear.replace(/\W/g, '')}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}

function detailRow(l, fmt, id, open) {
  const parts = l.parts || [];
  const maxTax = Math.max(1, ...parts.map((p) => p.tax));
  const top = parts.length ? parts[parts.length - 1] : null;
  return h('tr', { class: 'row-detail', id, hidden: !open },
    h('td', { colspan: 5 }, h('div', { class: 'detail-grid' },
      parts.length ? h('div', null,
        h('h3', { style: { marginBottom: '8px' } }, 'How the brackets apply'),
        h('table', { class: 'mini' },
          h('thead', null, h('tr', null, h('th', null, 'Band'), h('th', { class: 'num' }, 'Rate'), h('th', { class: 'num' }, 'Taxed'), h('th', { class: 'num' }, 'Tax'), h('th', null, h('span', { class: 'visually-hidden' }, 'Share')))),
          h('tbody', null, parts.map((p) => h('tr', { class: p === top ? 'is-top' : null },
            h('td', { class: 'num', style: { textAlign: 'left' } }, p.label ? `${p.label} · ` : '', p.to == null ? `Over ${fmt.money(p.from)}` : `${fmt.money(p.from)} – ${fmt.money(p.to)}`),
            h('td', { class: 'num' }, fmt.rate(p.rate)),
            h('td', { class: 'num' }, fmt.money(p.amount)),
            h('td', { class: 'num' }, fmt.money(p.tax)),
            h('td', { class: 'bar-cell', 'aria-hidden': 'true' }, h('span', { style: { width: `${(p.tax / maxTax) * 100}%` } })))))),
        h('p', { class: 'hint', style: { marginTop: '8px' } }, 'Bracket tax is before credits and offsets; the details show the adjustments.')) : null,
      h('div', null,
        l.details?.length ? [h('h3', { style: { marginBottom: '8px' } }, 'Details'),
          h('dl', { class: 'dl' }, l.details.map(([k, v]) => [h('dt', null, k), h('dd', null, v < 0 ? `−${fmt.money(-v)}` : fmt.money(v))]))] : null,
        h('div', { class: 'src-links' },
          h('span', null, `Rules: tax year ${l.taxYear}${l.approximate ? ' · typical local rate, check yours' : ''}`),
          (l.sources || []).map((s) => h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.name, ' ', icons.external())))))));
}

export function renderEstimate(main, go) {
  const c = country();
  const r0 = region();
  const fmt = makeFormat(c.locale, c.currency);
  const { result: r, payBasis, net, wages, inYear } = computeEstimate();
  const city = r0?.cities.find((x) => x.id === state.profile.city);
  const where = [city?.name, r0?.name, c.name].filter(Boolean).join(', ');

  // Figures shown on screen are whole units; every total is summed from the shown parts.
  const lines = r.lines.filter((l, i) => l.amount > 0.5 || i === 0).map((l) => ({ ...l, shown: Math.round(l.amount) }));
  const total = lines.reduce((a, l) => a + l.shown, 0);
  const withheld = Math.round(r.withheld);
  const prepaid = Math.round(r.prepaid);
  const balance = total - withheld - prepaid;
  const income = Math.round(r.totalIncome);
  const effective = income > 0 ? total / income : 0;
  const view = { lines, total, withheld, prepaid, balance, effective };

  const owes = balance > 0;
  const verdict = balance === 0 ? 'You are about square' : owes ? 'You may owe' : 'You may get back';
  const takeHome = Math.max(0, income - total);

  const bar = h('div', null,
    h('div', { class: 'slab-stage', role: 'img', 'aria-label': `Of ${fmt.money(income)} income, ${fmt.money(total)} goes in tax and ${fmt.money(takeHome)} is left.` },
      h('div', { class: 'slab-row' },
        lines.map((l, i) => h('div', { class: 'slab', title: `${l.name}: ${fmt.money(l.shown)}`, style: { flex: `0 0 ${income ? Math.max(0.6, (l.shown / income) * 100) : 0}%`, '--c': LEVEL_COLOR[l.level], '--h': `${Math.max(18, 44 - i * 5)}px`, animationDelay: `${i * 90}ms` } }, h('div', { class: 'side' }), h('div', { class: 'front' }), h('div', { class: 'top' }))),
        h('div', { class: 'slab rest', title: `Left after tax: ${fmt.money(takeHome)}`, style: { flex: '1', '--h': '10px', animationDelay: `${lines.length * 90}ms` } }, h('div', { class: 'side' }), h('div', { class: 'front' }), h('div', { class: 'top' })))),
    h('div', { class: 'stack-scale', 'aria-hidden': 'true' }, h('span', null, `Tax ${fmt.money(total)}`), h('span', null, `Income ${fmt.money(income)}`)),
    h('table', { class: 'legend-table' },
      h('caption', { class: 'visually-hidden' }, 'Where your income goes'),
      h('tbody', null,
        lines.map((l) => h('tr', null,
          h('td', null, h('span', { class: 'swatch', style: { background: LEVEL_COLOR[l.level] }, 'aria-hidden': 'true' }), l.name),
          h('td', { class: 'num muted', style: { textAlign: 'right' } }, income ? fmt.pct(l.shown / income) : '—'),
          h('td', { class: 'num', style: { textAlign: 'right', width: '96px' } }, fmt.money(l.shown)))),
        h('tr', null,
          h('td', null, h('span', { class: 'swatch', style: { background: 'var(--take-home)' }, 'aria-hidden': 'true' }), 'Left after tax'),
          h('td', { class: 'num muted', style: { textAlign: 'right' } }, income ? fmt.pct(takeHome / income) : '—'),
          h('td', { class: 'num', style: { textAlign: 'right' } }, fmt.money(takeHome))))));

  const paidParts = [withheld ? `${fmt.money(withheld)} withheld from pay` : null, prepaid ? `${fmt.money(prepaid)} already paid to the tax authority` : null].filter(Boolean);
  const amountEl = h('p', { class: `amount ${!owes && balance !== 0 ? 'refund' : 'owe'}` }, fmt.money(Math.abs(balance)));
  const card = h('div', { class: 'hero-card' },
    h('div', { class: 'lead-block' },
      h('h2', { class: 'verdict', id: 'verdict-h' }, verdict),
      amountEl,
      h('p', { class: 'explain' },
        `Estimated total tax of ${fmt.money(total)} on ${fmt.money(income)} of income`,
        paidParts.length ? `, less ${paidParts.join(' and ')}.` : '.'),
      payBasis === 'estimated' && net > 0 ? h('p', { class: 'hint', style: { marginTop: '10px' } }, `Gross pay of ${fmt.money(wages)} worked out from ${fmt.money(net)} take-home. `, h('a', { href: '#/review' }, 'Enter your real figures')) : null),
    h('div', { class: 'bar-block' }, bar));
  const headline = h('section', { class: 'hero-result', 'aria-labelledby': 'verdict-h' }, card);
  // Depth on the pointer: the card turns a few degrees towards it.
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && window.matchMedia('(pointer: fine)').matches) {
    headline.addEventListener('pointermove', (e) => {
      const b = card.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      card.style.transform = `rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
    });
    headline.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
  // Count the headline figure up once per visit.
  if (!still && !renderEstimate.counted) {
    renderEstimate.counted = true;
    const target = Math.abs(balance), t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 900), eased = 1 - Math.pow(1 - k, 3);
      amountEl.textContent = fmt.money(target * eased);
      if (k < 1 && amountEl.isConnected) requestAnimationFrame(tick);
    };
    amountEl.textContent = fmt.money(0);
    requestAnimationFrame(tick);
  }

  const kpis = h('div', { class: 'kpis', style: { '--n': 5 }, role: 'group', 'aria-label': 'Key figures' },
    [['Total income', fmt.money(income), `${fmt.int(inYear)} transactions`],
      [r.taxableLabel, fmt.money(r.taxableIncome), 'After deductions'],
      ['Total tax', fmt.money(total), `${lines.length} taxes`],
      ['Effective rate', fmt.pct(effective), 'Tax ÷ income'],
      ['Marginal rate', fmt.pct(r.marginalRate), `On the next ${fmt.money(r.step)} of ${r.marginalOn}`]]
      .map(([k, v, n], i) => h('div', { class: 'kpi' }, h('span', { class: 'label' }, k), h('span', { class: `value${i === 2 ? ' money' : ''}` }, v), h('span', { class: 'note' }, n))));

  const tbody = h('tbody', null);
  lines.forEach((l, i) => {
    const id = `detail-${i}`;
    const btn = h('button', { class: 'expand', type: 'button', 'aria-expanded': 'false', 'aria-controls': id }, icons.chevron(), l.name);
    const detail = detailRow(l, fmt, id, false);
    btn.addEventListener('click', () => { const open = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(open)); detail.hidden = !open; });
    tbody.append(
      h('tr', { class: 'row-main' },
        h('td', null, h('div', { class: 'tax-name' }, h('span', { class: 'swatch', style: { background: LEVEL_COLOR[l.level] }, 'aria-hidden': 'true' }), btn),
          h('div', { class: 'hint', style: { paddingLeft: '18px' } }, `${LEVEL_NAME[l.level]} · ${l.jurisdiction}`)),
        h('td', { class: 'c-base' }, h('div', { class: 'num' }, fmt.money(l.base)), h('div', { class: 'hint' }, l.baseLabel)),
        h('td', { class: 'c-year' }, h('span', { class: 'pill' }, l.taxYear)),
        h('td', { class: 'num' }, l.base > 0 ? fmt.pct(l.shown / l.base) : '—'),
        h('td', { class: 'num' }, fmt.money(l.shown))),
      detail);
  });
  tbody.append(h('tr', { class: 'row-main is-total' }, h('td', null, 'Total tax'), h('td', { class: 'c-base' }), h('td', { class: 'c-year' }), h('td', { class: 'num' }, fmt.pct(effective)), h('td', { class: 'num' }, fmt.money(total))));

  const breakdown = h('section', { class: 'panel', 'aria-labelledby': 'bd-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'bd-h' }, 'Tax by tax'), h('p', null, 'Open a row to see its brackets and source.')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'breakdown' },
      h('caption', { class: 'visually-hidden' }, 'Each tax with the amount it applies to, its tax year, its rate and the amount'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Tax'), h('th', { scope: 'col', class: 'c-base' }, 'Applies to'), h('th', { scope: 'col', class: 'c-year' }, 'Tax year'), h('th', { scope: 'col', class: 'num' }, 'Rate'), h('th', { scope: 'col', class: 'num' }, 'Amount'))),
      tbody)));

  const deductions = h('section', { class: 'panel', 'aria-labelledby': 'ded-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'ded-h' }, 'Deductions and allowances used')),
    h('dl', { class: 'dl', style: { fontSize: '14px' } }, r.deductionsUsed.map((d) => [h('dt', null, d.label, h('span', { class: 'hint', style: { display: 'block' } }, d.kind)), h('dd', null, fmt.money(d.amount))])));

  const paid = h('section', { class: 'panel', 'aria-labelledby': 'paid-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'paid-h' }, 'Paid so far')),
    h('dl', { class: 'dl', style: { fontSize: '14px' } },
      h('dt', null, 'Total tax'), h('dd', null, fmt.money(total)),
      h('dt', null, payBasis === 'estimated' ? 'Withheld from pay (estimated)' : 'Withheld from pay'), h('dd', null, withheld ? `−${fmt.money(withheld)}` : fmt.money(0)),
      h('dt', null, 'Paid to the tax authority'), h('dd', null, prepaid ? `−${fmt.money(prepaid)}` : fmt.money(0)),
      h('dt', { style: { fontWeight: 500, color: 'var(--text)', paddingTop: '6px', borderTop: '1px solid var(--rule)' } }, owes ? 'Balance to pay' : balance === 0 ? 'Balance' : 'Refund'),
      h('dd', { style: { fontWeight: 700, paddingTop: '6px', borderTop: '1px solid var(--rule)' } }, fmt.money(Math.abs(balance)))));

  const s = r.consumption;
  const sales = s ? h('section', { class: 'panel', 'aria-labelledby': 'sales-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'sales-h' }, `${s.name} you probably paid`), h('span', { class: 'pill' }, 'Information only')),
    h('p', { class: 'num', style: { fontSize: '22px', lineHeight: '28px', fontWeight: 500, marginBottom: '6px' } }, s.rate ? fmt.money(s.estimate) : fmt.money(0)),
    h('p', null, s.rate
      ? `About ${fmt.rate(s.rate)} included in ${fmt.money(s.spend)} of spending on eating out, shopping and subscriptions. It is already paid at the till and is not part of what you owe.`
      : `${r0.name} has no general sales tax.`),
    h('p', { class: 'hint', style: { marginTop: '8px' } }, s.note, ' ', h('a', { href: s.source.url, target: '_blank', rel: 'noopener noreferrer' }, s.source.name))) : null;

  const notes = h('section', { class: 'panel', 'aria-labelledby': 'notes-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'notes-h' }, 'Assumptions and limits')),
    h('ul', { class: 'notes' }, [...new Set(r.notes)].map((n) => h('li', null, n))));

  const sources = h('section', { class: 'panel', 'aria-labelledby': 'src-h' },
    h('div', { class: 'panel-head' }, h('h2', { id: 'src-h' }, 'Sources')),
    h('ul', { class: 'sources' }, r.sources.map((x) => h('li', null, h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer' }, x.name), x.taxYear ? h('div', { class: 'yr' }, `Tax year ${x.taxYear}`) : null))));

  const notice = h('div', { class: 'notice', role: 'note' },
    h('p', null, h('strong', null, `${DISCLAIMER.title}. `), DISCLAIMER.body[0], ' ', DISCLAIMER.consult(c.authority.name)));

  mount(main, h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('div', null, h('h1', null, `Your ${c.taxYear} tax estimate`), h('p', { class: 'sub' }, `${where} · ${r.taxYearLabel}`, r.simplified ? [' ', h('span', { class: 'pill pill-warning' }, 'Simplified model')] : null)),
      h('div', { class: 'title-actions no-print' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => exportCSV(view, c, r, where) }, icons.download(), 'Download CSV'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => window.print() }, icons.print(), 'Print or save PDF'))),
    h('div', { class: 'stack' },
      notice, headline, kpis, breakdown,
      h('div', { class: 'grid-2' }, deductions, paid),
      h('div', { class: 'grid-2' }, sales, notes),
      sources),
    h('div', { class: 'actions-row no-print' },
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => go('review') }, icons.back(), 'Back to categories'))));
}

/** The acknowledgement required before the first results. Resolves true when accepted. */
export function askAcknowledgement(dialog, authority) {
  return new Promise((resolve) => {
    let checked = false;
    const go = h('button', { class: 'btn btn-primary', value: 'ok', disabled: true }, 'Show my estimate');
    const box = h('input', { type: 'checkbox', id: 'ack-box', onchange: (e) => { checked = e.target.checked; go.disabled = !checked; } });
    mount(dialog, h('form', { method: 'dialog' },
      h('div', { class: 'dialog-body' },
        h('h2', { id: 'ack-h' }, 'Before you see your estimate'),
        h('ul', null,
          h('li', null, 'The figures are estimates and may contain mistakes. They depend on how your transactions are categorised and on the assumptions listed with the results.'),
          h('li', null, 'Levy is a tool for cross-checking and making calculations easier. It is not tax, legal, accounting or financial advice.'),
          h('li', null, 'The makers of Levy accept no responsibility or liability for any decision, filing, payment, penalty or loss based on these estimates.'),
          h('li', null, `Consult a qualified tax professional or ${authority} before you file or pay.`)),
        h('label', { class: 'ack', for: 'ack-box' }, box, h('span', null, 'I understand that this is an estimate, not advice, and that I am responsible for checking it.'))),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-ghost', value: 'cancel' }, 'Not now'),
        go)));
    dialog.setAttribute('aria-labelledby', 'ack-h');
    dialog.onclose = () => resolve(dialog.returnValue === 'ok' && checked);
    dialog.showModal();
    box.focus();
  });
}
