import { h, mount, icons, brandMark } from '../ui/dom.js';
import { countries, continents, continentCenters } from '../data/registry.js';
import { createGlobe } from '../ui/globe.js';
import { state, setProfile, country, region, locationComplete } from '../store.js';
import { rulesFor } from './location.js';
import { themeButton, placeLabel } from './shell.js';

// One canvas and globe for the life of the page, so re-renders never restart the animation.
let globeCanvas = null;
let globe = null;
let continentView = null;

function globeNode(code) {
  if (!globeCanvas) {
    globeCanvas = h('canvas', { class: 'globe', role: 'img', 'aria-label': 'A globe that turns to the country you choose. Drag to spin it.' });
    requestAnimationFrame(() => { globe = createGlobe(globeCanvas, { selected: code }); });
  } else if (globe && code) {
    globe.focus(code);
  }
  return globeCanvas;
}

export function renderStart(main, go) {
  const c = country();
  const r = region();
  const p = state.profile;

  continentView ||= c?.continent || 'Europe';
  const shown = countries.filter((x) => x.continent === continentView);
  const continentPicker = h('div', { class: 'chips continents', role: 'group', 'aria-label': 'Continent' },
    continents.map((name) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(name === continentView),
      onclick: () => { continentView = name; globe?.look(...continentCenters[name]); renderStart(main, go); } },
      name.replace('North ', 'N. ').replace('South ', 'S. '), h('span', { class: 'count' }, String(countries.filter((x) => x.continent === name).length)))));

  const countryField = h('fieldset', null,
    h('legend', null, 'Country'),
    continentPicker,
    h('div', { class: 'country-grid' }, shown.map((x) => h('label', { class: 'country' },
      h('input', { type: 'radio', name: 'country', value: x.code, checked: p.country === x.code, onchange: () => setProfile({ country: x.code }) }),
      h('span', { class: 'code', 'aria-hidden': 'true' }, x.code === 'GB' ? 'UK' : x.code),
      h('span', { class: 'name' }, x.name),
      h('span', { class: 'yr' }, x.taxYear)))),
    c && c.continent !== continentView ? h('p', { class: 'hint', style: { marginTop: '8px' } }, `Selected: ${c.name}`) : null);

  const regionField = c && c.regions.length ? h('div', { class: 'field' },
    h('label', { for: 'region' }, c.regionLabel),
    h('select', { class: 'input', id: 'region', name: 'region', autocomplete: 'address-level1', onchange: (e) => setProfile({ region: e.target.value || null }) },
      h('option', { value: '', selected: !p.region }, `Choose a ${c.regionLabel.toLowerCase()}`),
      c.regions.map((x) => h('option', { value: x.code, selected: p.region === x.code }, x.name))),
    r?.hint ? h('p', { class: 'hint' }, r.hint) : null) : null;

  const cityField = c && r && r.cities.length ? h('div', { class: 'field' },
    h('label', { for: 'city' }, c.cityLabel),
    h('select', { class: 'input', id: 'city', name: 'city', 'aria-describedby': 'city-hint', autocomplete: 'address-level2', onchange: (e) => setProfile({ city: e.target.value || null }) },
      h('option', { value: '', selected: !p.city }, r.cityRequired ? 'Choose where you live' : `Elsewhere in ${r.name}`),
      r.cities.map((x) => h('option', { value: x.id, selected: p.city === x.id }, x.name))),
    h('p', { class: 'hint', id: 'city-hint' }, r.cityRequired ? `Every ${r.name} resident pays a local income tax.` : 'Only these places add a local income tax.')) : null;

  const filingField = c?.filingStatuses ? h('fieldset', { class: 'field' },
    h('legend', null, 'Filing status'),
    h('div', { class: 'segmented' }, c.filingStatuses.map((f) => h('label', null,
      h('input', { type: 'radio', name: 'filing', value: f.id, checked: p.filingStatus === f.id, onchange: () => setProfile({ filingStatus: f.id }) }),
      h('span', null, f.label))))) : null;

  const depsField = c?.asksDependents ? h('div', { class: 'field' },
    h('label', { for: 'deps' }, 'Children under 17'),
    h('input', { class: 'input num', id: 'deps', name: 'dependents', autocomplete: 'off', type: 'number', inputmode: 'numeric', min: 0, max: 12, step: 1, value: p.dependents || 0, style: { width: '110px' },
      onchange: (e) => setProfile({ dependents: Math.max(0, Math.min(12, parseInt(e.target.value, 10) || 0)) }) })) : null;

  const ready = locationComplete();
  const rules = rulesFor(p);
  const card = c ? h('div', { class: 'globe-card', 'aria-live': 'polite' },
    h('span', { class: 'k' }, c.taxYearLabel),
    h('strong', null, placeLabel() || c.name),
    c.accuracy === 'simplified' ? h('span', { class: 'pill pill-warning', style: { justifySelf: 'start' } }, 'Simplified model') : null,
    rules.length ? h('ul', null, rules.map((x) => h('li', null, x.what))) : null) : null;

  mount(main, h('div', { class: 'landing' },
    h('div', { class: 'landing-top' },
      h('a', { class: 'brand', href: '#/start', 'aria-label': 'Levy' }, brandMark(), h('span', { class: 'brand-name', translate: 'no' }, 'Levy')),
      h('div', { class: 'appbar-tools' }, h('span', { class: 'privacy hide-sm' }, icons.lock(), 'Private by design'), themeButton())),
    h('div', { class: 'landing-grid' },
      h('section', { 'aria-labelledby': 'hero-h' },
        h('h1', { class: 'hero-word', id: 'hero-h' }, 'Let’s begin', h('span', { class: 'sig' }, '.')),
        h('p', { class: 'hero-lead' }, 'Tell Levy where you live. It reads your bank statements ', h('strong', null, 'on this device'), ' and estimates every tax you owe, line by line.'),
        h('div', { class: 'begin' },
          countryField,
          regionField ? h('div', { class: 'begin-row' }, regionField, cityField) : null,
          filingField || depsField ? h('div', { class: 'begin-row-auto' }, filingField, depsField) : null,
          h('div', { class: 'begin-go' },
            h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: !ready, onclick: () => go('statements') }, 'Begin', icons.arrow()),
            h('p', { class: 'hint' }, ready ? c.accuracy === 'simplified' ? 'Simplified model: national tax, main allowances and social contributions.' : 'Next: add a year of statements, or try the demo bank.' : c ? `Choose your ${c.regionLabel.toLowerCase()}${r?.cityRequired ? ' and area' : ''}.` : 'Pick your country to start.')))),
      h('div', { class: 'globe-wrap' }, globeNode(p.country), card, h('span', { class: 'globe-hint', 'aria-hidden': 'true' }, 'drag to spin')))));
}
