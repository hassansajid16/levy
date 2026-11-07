import { initBank } from './bank/provider.js';
import { state, subscribe, country, acknowledge } from './store.js';
import { renderShell, stepAvailable, STEPS } from './views/shell.js';
import { renderStart } from './views/start.js';
import { renderStatements } from './views/statements.js';
import { renderReview } from './views/review.js';
import { renderEstimate, askAcknowledgement } from './views/estimate.js';

const main = document.getElementById('main');
const views = { start: renderStart, statements: renderStatements, review: renderReview, estimate: renderEstimate };
let current = null;
let gating = false;

function routeFromHash() {
  const id = location.hash.replace(/^#\/?/, '') || 'start';
  return STEPS.some((s) => s.id === id) ? id : 'start';
}

function go(id) {
  if (location.hash !== `#/${id}`) location.hash = `#/${id}`;
  else render();
}

/** Re-render, keeping focus on the same control when the view is rebuilt. */
function render() {
  let id = routeFromHash();
  if (!stepAvailable(id)) id = [...STEPS].reverse().find((s) => stepAvailable(s.id)).id;

  if (id === 'estimate' && !state.acknowledged) {
    if (gating) return;
    gating = true;
    askAcknowledgement(document.getElementById('dialog'), country().authority.name).then((ok) => {
      gating = false;
      if (ok) { acknowledge(); } else { go('review'); }
    });
    if (current !== 'review') { current = 'review'; renderShell('review'); views.review(main, go); }
    return;
  }

  const active = document.activeElement;
  const focusKey = active && main.contains(active)
    ? (active.id ? `#${CSS.escape(active.id)}` : active.name && active.value ? `[name="${CSS.escape(active.name)}"][value="${CSS.escape(active.value)}"]` : null)
    : null;
  const selStart = active?.selectionStart;
  const changedView = id !== current;
  const scroll = window.scrollY;

  renderShell(id);
  views[id](main, go);
  document.title = `${STEPS.find((s) => s.id === id).label} · Levy`;

  if (changedView) {
    current = id;
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, scroll);
    if (focusKey) {
      const el = main.querySelector(focusKey);
      if (el) { el.focus({ preventScroll: true }); if (selStart != null && el.setSelectionRange) try { el.setSelectionRange(selStart, selStart); } catch { /* not a text input */ } }
    }
  }
}

window.addEventListener('hashchange', render);
subscribe(render);
initBank().finally(render);
