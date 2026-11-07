import { h, mount } from '../ui/dom.js';

let timer;
/** A short status message; `action` adds one button such as Undo. */
export function toast(message, action) {
  const root = document.getElementById('toast-root');
  clearTimeout(timer);
  mount(root, h('div', { class: 'toast', role: 'status' },
    h('span', null, message),
    action ? h('button', { type: 'button', onclick: () => { action.run(); mount(root); } }, action.label) : null));
  timer = setTimeout(() => mount(root), action ? 7000 : 3500);
}
