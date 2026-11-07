// Runs a simplified country definition from src/data/world.js and returns the shared result shape.
import { applyBrackets } from './brackets.js';

const pos = (n) => Math.max(0, n);

export function calcGeneric(def, profile, inc) {
  const d = inc.deductions || {};
  const x = {
    wages: inc.wages || 0,
    seIncome: inc.selfEmployment?.income || 0,
    seExpenses: inc.selfEmployment?.expenses || 0,
    interest: inc.interest || 0,
    dividends: inc.dividends || 0,
    other: inc.otherIncome || 0,
    retirement: d.retirement || 0,
    charity: d.charity || 0,
  };
  x.se = pos(x.seIncome - x.seExpenses);

  // Savings: either taxed separately (flat rate, per-type rates or a schedule) or with ordinary income.
  const inv = def.investment;
  const separate = (type) => !!inv && (!inv.only || inv.only.includes(type));
  x.ordinaryInvest = (separate('interest') ? 0 : x.interest) + (separate('dividends') ? 0 : x.dividends);
  let investLine = null;
  if (inv) {
    const amounts = { interest: separate('interest') ? x.interest : 0, dividends: separate('dividends') ? x.dividends : 0 };
    const total = amounts.interest + amounts.dividends;
    const base = pos(total - (inv.allowance || 0));
    let tax = 0;
    if (inv.rates) {
      const share = total > 0 ? base / total : 0;
      tax = (amounts.interest * (inv.rates.interest || 0) + amounts.dividends * (inv.rates.dividends || 0)) * share;
    } else if (inv.schedule) tax = applyBrackets(base, inv.schedule).tax;
    else tax = base * (inv.rate || 0);
    if (tax > 0) investLine = { id: `${def.code.toLowerCase()}-inv`, name: inv.label, level: 'national', amount: tax, base, baseLabel: 'Interest and dividends' };
  }

  const u = {
    pos,
    br: applyBrackets,
    line: (id, name, level, amount, base, baseLabel, more = {}) => ({ id, name, level, amount: pos(amount), base: pos(base), baseLabel, ...more }),
  };
  const out = def.calc(x, u);
  const lines = [...out.lines, ...(investLine ? [investLine] : [])].map((l) => ({
    jurisdiction: def.name,
    taxYear: def.taxYear,
    sources: def.sources,
    ...l,
  }));

  return {
    lines,
    deductionsUsed: (out.deductionsUsed || []).filter((r) => r.amount > 0),
    totalIncome: x.wages + x.se + x.interest + x.dividends + x.other,
    taxableIncome: out.taxable,
    taxableLabel: 'Taxable income',
    sales: { name: def.sales.name, rate: def.sales.rate, source: def.sources[1] || def.sources[0], note: def.sales.note || 'Standard rate on eating out, shopping and subscriptions; reduced rates on food and essentials are ignored.' },
    notes: [
      `${def.name} uses a simplified model: national income tax, the main allowances and credits, employee social contributions${inv ? ' and the tax on savings' : ''}. Check it against ${def.authority.name}.`,
      'Salary deposits are assumed to be after tax and contributions withheld by the employer.',
      ...(def.notes || []),
    ],
    taxYearLabel: def.taxYearLabel,
    simplified: true,
  };
}
