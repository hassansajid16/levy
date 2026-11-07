import { usFederal } from '../data/us-federal.js';
import { usStateByCode } from '../data/us-states.js';
import { ukCommon, ukNations } from '../data/uk.js';
import { caFederal, caProvinces } from '../data/ca.js';
import { au } from '../data/au.js';
import { worldByCode } from '../data/world.js';
import { calcGeneric } from '../tax/generic.js';

/** The rule sets that will apply to this profile, for the preview panel. */
export function rulesFor(p) {
  const out = [];
  const add = (what, year, source, note) => out.push({ what, year, source, note });
  if (p.country === 'US') {
    add('Federal income tax', usFederal.taxYear, usFederal.sources[0]);
    add('Social Security and Medicare, or self-employment tax', usFederal.taxYear, usFederal.sources[2]);
    const s = usStateByCode[p.region];
    if (s) {
      if (s.none) add(`${s.name}: no state income tax on wages`, s.taxYear, s.sources[0]);
      else add(`${s.name} income tax`, s.taxYear, s.sources[0]);
      if (s.payroll) add(s.payroll.name, s.taxYear, { name: s.payroll.source[0], url: s.payroll.source[1] });
      const l = s.locals.find((x) => x.id === p.city);
      if (l) add(l.label, l.taxYear, l.sources[0], l.approximate ? 'Typical rate' : null);
    }
  } else if (p.country === 'GB') {
    const n = ukNations.find((x) => x.code === p.region);
    if (n) add(n.bands ? 'Income tax at Scottish rates' : 'Income tax', ukCommon.taxYear, n.sources[0]);
    add('National Insurance, Class 1 and Class 4', ukCommon.taxYear, ukCommon.sources[1]);
  } else if (p.country === 'CA') {
    add('Federal income tax', caFederal.taxYear, caFederal.sources[0]);
    const pr = caProvinces.find((x) => x.code === p.region);
    if (pr) {
      add(`${pr.name} income tax${pr.surtax ? ' and surtax' : ''}`, pr.taxYear, pr.sources[pr.sources.length - 1]);
      if (pr.healthPremium) add('Ontario Health Premium', pr.taxYear, pr.sources[1]);
      add(pr.quebec ? 'QPP, EI and QPIP' : 'CPP and EI', caFederal.taxYear, caFederal.sources[1]);
    }
  } else if (worldByCode[p.country]) {
    const def = worldByCode[p.country];
    const probe = calcGeneric(def, p, { wages: 1e6, selfEmployment: { income: 1e5, expenses: 0 }, interest: 1e4, dividends: 1e4 });
    for (const l of probe.lines) add(l.name, def.taxYear, def.sources[0]);
  } else if (p.country === 'AU') {
    add('Income tax with the low income tax offset', au.taxYear, au.sources[0]);
    add('Medicare levy', au.taxYear, au.sources[1]);
  }
  return out;
}
