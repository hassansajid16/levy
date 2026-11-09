import { h, mount, icons, brandMark } from '../ui/dom.js';
import { state, country, region, locationComplete, resetAll } from '../store.js';

// The landing page ("start") chooses the place; the workspace steps do everything else.
export const STEPS = [
  { id: 'start', label: 'Where you live' },
  { id: 'statements', label: 'Import' },
  { id: 'review', label: 'Review' },
  { id: 'estimate', label: 'Estimate' },
];
const WORKSPACE = STEPS.slice(1);

export function stepAvailable(id) {
  if (id === 'start') return true;
  if (id === 'statements') return locationComplete();
  return locationComplete() && state.transactions.length > 0;
}

export function stepDone(id) {
  if (id === 'start') return locationComplete();
  if (id === 'statements') return state.transactions.length > 0;
  if (id === 'review') return state.transactions.length > 0 && state.acknowledged;
  return false;
}

export const DISCLAIMER = {
  title: 'This is an estimate, not tax advice',
  body: [
    'Levy produces estimates only. They may contain mistakes or be incomplete, tax rules change, and your circumstances may differ from the assumptions shown.',
    'Levy is a tool for cross-checking figures and making calculations easier. It is not tax, legal, accounting or financial advice, and it does not prepare or file a return.',
    'The makers of Levy accept no responsibility or liability for any loss, penalty, interest or other consequence arising from the use of, or reliance on, these estimates.',
  ],
  consult: (authority) => `Before you file or pay, check your figures with a qualified tax professional or ${authority || 'the official tax authority'}.`,
};

export function placeLabel() {
  const c = country(); const r = region();
  if (!c) return '';
  const city = r?.cities.find((x) => x.id === state.profile.city);
  return [city?.name, r?.name, c.name].filter(Boolean).join(', ');
}

export function themeButton() {
  const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';
  const btn = h('button', { class: 'btn icon-btn btn-ghost', type: 'button' });
  const paint = () => {
    btn.replaceChildren(isDark() ? icons.sun() : icons.moon());
    btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    btn.title = btn.getAttribute('aria-label');
  };
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('levy.theme', next); } catch { /* ignore */ }
    paint();
  });
  paint();
  return btn;
}

export function startOverButton() {
  return h('button', { class: 'btn icon-btn btn-ghost', type: 'button', 'aria-label': 'Start over', title: 'Start over',
    onclick: () => { if (confirm('Clear your location, statements and categories from this browser?')) { resetAll(); location.hash = '#/start'; } } }, icons.reset());
}

function renderAppbar(active) {
  const bar = document.getElementById('appbar');
  if (active === 'start') { bar.hidden = true; mount(bar); return; }
  bar.hidden = false;
  const c = country();
  mount(bar, h('div', { class: 'appbar-inner' },
    h('a', { class: 'brand', href: '#/start', 'aria-label': 'Levy, change where you live' }, brandMark(), h('span', { class: 'brand-name', translate: 'no' }, 'Levy')),
    h('nav', { 'aria-label': 'Steps', style: { display: 'contents' } },
      h('ol', { class: 'steps' }, WORKSPACE.map((s) => {
        const available = stepAvailable(s.id);
        const done = stepDone(s.id) && s.id !== active;
        const content = [h('span', { class: 'dot', 'aria-hidden': 'true' }), s.label, done ? h('span', { class: 'visually-hidden' }, ' (done)') : null];
        return h('li', { class: done ? 'done' : null }, available
          ? h('a', { href: `#/${s.id}`, 'aria-current': s.id === active ? 'page' : null }, content)
          : h('span', { 'aria-disabled': 'true', title: 'Add statements first' }, content));
      }))),
    h('div', { class: 'appbar-tools' },
      c ? h('a', { class: 'loc-chip', href: '#/start', title: 'Change where you live' },
        h('span', { class: 'pin', 'aria-hidden': 'true' }),
        h('span', { class: 't' }, placeLabel()),
        h('span', { class: 'y' }, c.taxYear)) : null,
      themeButton(),
      startOverButton())));
}

export function renderShell(active) {
  renderAppbar(active);
  const c = country();
  const authority = c?.authority;
  mount(document.getElementById('footer'),
    h('div', { class: 'legal', role: 'note', 'aria-label': 'Disclaimer' },
      h('p', null, h('strong', null, `${DISCLAIMER.title}. `), DISCLAIMER.body.join(' ')),
      h('p', null, DISCLAIMER.consult(authority ? authority.name : null), authority ? [' ', h('a', { href: authority.url, target: '_blank', rel: 'noopener noreferrer' }, authority.linkLabel), '.'] : null)),
    h('div', { class: 'meta' },
      h('span', { class: 'privacy' }, icons.lock(), 'Read on this device. Nothing uploaded.'),
      h('span', null, 'Rules for 33 countries · tax years 2025 and 2025–26'),
      h('span', null, 'Bank connection: Plaid sandbox (test banks only)')));
}
