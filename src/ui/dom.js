// A tiny element builder: h('button', { class: 'btn', onclick }, 'Label').
export function h(tag, attrs, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'rect' || tag === 'circle' || tag === 'polyline' || tag === 'line'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && !(el instanceof SVGElement) && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(target, ...nodes) {
  target.replaceChildren(...nodes.flat().filter(Boolean));
}

/** Inline SVG from a path string (16px outline icons, 1.5px stroke). */
export function icon(paths, size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths;
  return svg;
}

export const icons = {
  check: () => icon('<path d="m3.5 8.5 3 3 6-7"/>'),
  upload: () => icon('<path d="M8 10.5V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"/>'),
  bank: () => icon('<path d="M2 6.5 8 3l6 3.5M3 6.5v6M13 6.5v6M6 6.5v6M10 6.5v6M2 13.5h12"/>'),
  menu: () => icon('<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>', 20),
  close: () => icon('<path d="m4 4 8 8M12 4l-8 8"/>', 20),
  chevron: () => icon('<path d="m6 3.5 4.5 4.5L6 12.5"/>'),
  print: () => icon('<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z"/>'),
  download: () => icon('<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M2.5 13.5h11"/>'),
  lock: () => icon('<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
  file: () => icon('<path d="M9 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6L9 2.5Z"/><path d="M9 2.5V6h3.5"/>'),
  trash: () => icon('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5"/>'),
  arrow: () => icon('<path d="M3 8h10M9 4l4 4-4 4"/>'),
  back: () => icon('<path d="M13 8H3M7 4 3 8l4 4"/>'),
  sun: () => icon('<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>'),
  moon: () => icon('<path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z"/>'),
  reset: () => icon('<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v3h3"/>'),
  external: () => icon('<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3"/>', 12),
};

export function brandMark() {
  const svg = icon('', 22);
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('stroke', 'none');
  svg.classList.add('brand-mark');
  svg.innerHTML = '<rect width="32" height="32" rx="9" fill="var(--text)"/><rect x="8" y="8" width="4.5" height="16" rx="2.25" fill="var(--ground)"/><rect x="14.5" y="13" width="4.5" height="11" rx="2.25" fill="var(--accent)"/><rect x="21" y="18" width="4.5" height="6" rx="2.25" fill="var(--signal)"/>';
  return svg;
}
