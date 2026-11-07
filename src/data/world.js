// Simplified rule sets for 29 more countries.
//
// Each country models one resident individual filing alone: national income tax brackets, the
// main allowances and credits, employee social contributions, a flat tax on savings where one
// applies, and the standard VAT or GST rate. Regional and local taxes, family situations and
// most special regimes are not modelled; each country's `notes` says what is left out and the
// UI labels these countries "Simplified". Figures are for the tax year in `taxYear`, compiled
// from the national tax authority and cross-checked against PwC Worldwide Tax Summaries.
//
// calc(x, u) receives:
//   x.wages, x.se (self-employed profit), x.seIncome, x.seExpenses, x.other,
//   x.ordinaryInvest (interest and dividends taxed with ordinary income), x.retirement, x.charity
// and returns { lines, deductionsUsed, taxable }.

const pwc = (slug, name) => ({ name: `PwC Worldwide Tax Summaries: ${name}`, url: `https://taxsummaries.pwc.com/${slug}/individual/taxes-on-personal-income` });
const cal = (y) => ({ start: `${y}-01-01`, end: `${y}-12-31` });
const label = (y) => `Tax year ${y} (1 Jan – 31 Dec ${y})`;

export const world = [
  // ───────────────────────── Europe ─────────────────────────
  {
    code: 'IE', name: 'Ireland', continent: 'Europe', currency: 'EUR', locale: 'en-IE', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [-8, 53.3], radius: 2.4 },
    authority: { name: 'Revenue', url: 'https://www.revenue.ie/', linkLabel: 'Go to Revenue.ie' },
    sources: [{ name: 'Revenue: Tax rates, bands and reliefs', url: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx' }, pwc('ireland', 'Ireland')],
    sales: { name: 'VAT', rate: 0.23 }, investment: { only: ['interest'], rate: 0.33, label: 'DIRT on deposit interest' },
    sample: { netMonthly: 3100, scale: 0.92, payee: 'REVENUE COMMISSIONERS' },
    notes: ['Single person; the €44,000 standard rate band for one earner.', 'PRSI uses 4.125%, the 2025 average of 4.1% (Jan–Sep) and 4.2% (Oct–Dec).', 'Dividends are taxed with other income; deposit interest pays DIRT at 33%.'],
    calc(x, u) {
      const earned = x.wages + x.se;
      const income = earned + x.other + x.ordinaryInvest;
      const pension = Math.min(x.retirement, 0.2 * earned);
      const taxable = u.pos(income - pension);
      const it = u.br(taxable, [[0, 0.20], [44000, 0.40]]);
      const credits = 2000 + (earned > 0 ? 2000 : 0);
      const usc = income <= 13000 ? { tax: 0, parts: [] } : u.br(income, [[0, 0.005], [12012, 0.02], [27382, 0.03], [70044, 0.08]]);
      const prsi = earned * 0.04125;
      return {
        taxable,
        lines: [
          u.line('ie-it', 'Income tax', 'national', u.pos(it.tax - credits), taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax at 20% and 40%', it.tax], ['Personal and employee credits', -Math.min(credits, it.tax)]] }),
          u.line('ie-usc', 'Universal Social Charge', 'national', usc.tax, income, 'Total income', { parts: usc.parts }),
          u.line('ie-prsi', 'PRSI', 'social', prsi, earned, 'Earnings', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Personal and employee tax credits', amount: credits, kind: 'Credit' }, ...(pension ? [{ label: 'Pension contributions', amount: pension, kind: 'Relief' }] : [])],
      };
    },
  },
  {
    code: 'DE', name: 'Germany', continent: 'Europe', currency: 'EUR', locale: 'de-DE', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [10.4, 51.2], radius: 3.6 },
    authority: { name: 'your Finanzamt', url: 'https://www.bundesfinanzministerium.de/', linkLabel: 'Go to the Federal Ministry of Finance' },
    sources: [{ name: 'EStG §32a: Einkommensteuertarif', url: 'https://www.gesetze-im-internet.de/estg/__32a.html' }, pwc('germany', 'Germany')],
    sales: { name: 'VAT (MwSt)', rate: 0.19 }, investment: { rate: 0.26375, allowance: 1000, label: 'Abgeltungsteuer with solidarity surcharge' },
    sample: { netMonthly: 2900, scale: 0.92, payee: 'FINANZAMT' },
    notes: ['Tax class I (single, no children). Church tax is not included.', 'Employee social contributions use 2025 rates and ceilings, with the childless care surcharge and the average health add-on of 2.5%.', 'Self-employed people are not charged statutory social insurance here.'],
    calc(x, u) {
      const pensionC = Math.min(x.wages, 96600) * 0.093;
      const unemployC = Math.min(x.wages, 96600) * 0.013;
      const healthC = Math.min(x.wages, 66150) * 0.0855;
      const careC = Math.min(x.wages, 66150) * 0.024;
      const social = pensionC + unemployC + healthC + careC;
      const werbung = x.wages > 0 ? Math.min(x.wages, 1230) : 0;
      const taxable = Math.floor(u.pos(x.wages - werbung + x.se + x.other + x.ordinaryInvest - 36 - pensionC - healthC - careC - x.retirement - x.charity));
      const tax = germanTariff2025(taxable);
      const soli = tax > 19950 ? Math.min(tax * 0.055, (tax - 19950) * 0.119) : 0;
      return {
        taxable,
        lines: [
          u.line('de-est', 'Income tax (Einkommensteuer)', 'national', tax, taxable, 'Taxable income', { marginal: germanTariff2025(taxable + 1) - tax, details: [['Basic allowance (Grundfreibetrag)', 12096], ['Tax from the §32a formula', tax]] }),
          u.line('de-soli', 'Solidarity surcharge', 'national', soli, tax, 'Income tax'),
          u.line('de-sv', 'Social insurance', 'social', social, x.wages, 'Wages', { withheldOnWages: true, details: [['Pension 9.3%', pensionC], ['Health 8.55%', healthC], ['Long-term care 2.4%', careC], ['Unemployment 1.3%', unemployC]] }),
        ],
        deductionsUsed: [{ label: 'Work expenses flat rate', amount: werbung, kind: 'Deduction' }, { label: 'Deductible social contributions', amount: pensionC + healthC + careC, kind: 'Deduction' }, { label: 'Special expenses flat rate', amount: 36, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'FR', name: 'France', continent: 'Europe', currency: 'EUR', locale: 'fr-FR', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [2.5, 46.6], radius: 4.2 },
    authority: { name: 'the DGFiP (impots.gouv.fr)', url: 'https://www.impots.gouv.fr/', linkLabel: 'Go to impots.gouv.fr' },
    sources: [{ name: 'Service-Public.fr: Barème de l’impôt sur le revenu', url: 'https://www.service-public.fr/particuliers/vosdroits/F1419' }, pwc('france', 'France')],
    sales: { name: 'VAT (TVA)', rate: 0.20 }, investment: { rate: 0.30, label: 'Flat tax (PFU) on savings' },
    sample: { netMonthly: 2600, scale: 0.92, payee: 'DGFIP IMPOT' },
    notes: ['One tax share (single, no children). Uses the scale published in the 2025 finance law; the scale for 2025 income may be indexed slightly.', 'Employee contributions are approximated: pension and Agirc-Arrco up to and above the social security ceiling, plus CSG and CRDS.', 'Self-employed income uses the micro-BNC 34% allowance and a 24.6% social rate on takings.'],
    calc(x, u) {
      const pss = 47100;
      const contrib = Math.min(x.wages, pss) * (0.069 + 0.0315) + x.wages * 0.004 + u.pos(Math.min(x.wages, 8 * pss) - pss) * 0.0864;
      const csg = x.wages * 0.9825 * 0.097;
      const csgDeductible = x.wages * 0.9825 * 0.068;
      const netTaxableSalary = u.pos(x.wages - contrib - csgDeductible);
      const abatement = netTaxableSalary > 0 ? Math.min(14171, Math.max(504, netTaxableSalary * 0.1)) : 0;
      const seProfit = x.seIncome * 0.66;
      const seSocial = x.seIncome * 0.246;
      const taxable = u.pos(netTaxableSalary - abatement + seProfit + x.other + x.ordinaryInvest - x.retirement);
      const it = u.br(taxable, [[0, 0], [11497, 0.11], [29315, 0.30], [83823, 0.41], [180294, 0.45]]);
      const decote = it.tax < 1964 ? Math.min(it.tax, u.pos(889 - 0.4525 * it.tax)) : 0;
      const donation = Math.min(x.charity * 0.66, taxable * 0.2 * 0.66);
      return {
        taxable,
        lines: [
          u.line('fr-ir', 'Income tax (impôt sur le revenu)', 'national', u.pos(it.tax - decote - donation), taxable, 'Net taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ...(decote ? [['Décote', -decote]] : []), ...(donation ? [['Donation reduction (66%)', -donation]] : [])] }),
          u.line('fr-csg', 'CSG and CRDS', 'social', csg, x.wages * 0.9825, '98.25% of salary', { withheldOnWages: true }),
          u.line('fr-sal', 'Employee social contributions', 'social', contrib, x.wages, 'Salary', { withheldOnWages: true }),
          u.line('fr-se', 'Self-employed social contributions', 'social', seSocial, x.seIncome, 'Takings'),
        ],
        deductionsUsed: [{ label: '10% allowance for work expenses', amount: abatement, kind: 'Deduction' }, ...(seProfit ? [{ label: 'Micro-BNC 34% allowance', amount: x.seIncome - seProfit, kind: 'Deduction' }] : [])],
      };
    },
  },
  {
    code: 'ES', name: 'Spain', continent: 'Europe', currency: 'EUR', locale: 'es-ES', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [-3.7, 40.2], radius: 4.2 },
    authority: { name: 'the Agencia Tributaria', url: 'https://sede.agenciatributaria.gob.es/', linkLabel: 'Go to the Agencia Tributaria' },
    sources: [{ name: 'Agencia Tributaria: IRPF tax scale', url: 'https://sede.agenciatributaria.gob.es/' }, pwc('spain', 'Spain')],
    sales: { name: 'VAT (IVA)', rate: 0.21 },
    investment: { schedule: [[0, 0.19], [6000, 0.21], [50000, 0.23], [200000, 0.27], [300000, 0.30]], label: 'Tax on savings (base del ahorro)' },
    sample: { netMonthly: 2000, scale: 0.78, payee: 'AGENCIA TRIBUTARIA AEAT' },
    notes: ['Combines the state scale with the standard regional scale; each region sets its own half, so your figure can differ.', 'Self-employed (autónomo) contributions are approximated as 31.3% of net profit.'],
    calc(x, u) {
      const ss = Math.min(x.wages, 58914) * 0.0648;
      const netWork = u.pos(x.wages - ss - (x.wages > 0 ? 2000 : 0));
      let reduction = 0;
      if (x.wages > 0) {
        if (netWork <= 14852) reduction = 7302;
        else if (netWork <= 17673.52) reduction = 7302 - 1.75 * (netWork - 14852);
        else if (netWork <= 19747.5) reduction = 2364.34 - 1.14 * (netWork - 17673.52);
      }
      const seSocial = x.se * 0.313;
      const taxable = u.pos(netWork - reduction + u.pos(x.se - seSocial) + x.other + x.ordinaryInvest - Math.min(x.retirement, 1500));
      const sched = [[0, 0.19], [12450, 0.24], [20200, 0.30], [35200, 0.37], [60000, 0.45], [300000, 0.47]];
      const it = u.br(taxable, sched);
      const minimum = u.br(5550, sched).tax;
      return {
        taxable,
        lines: [
          u.line('es-irpf', 'Income tax (IRPF)', 'national', u.pos(it.tax - minimum), taxable, 'General taxable base', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ['Personal minimum (€5,550)', -minimum]] }),
          u.line('es-ss', 'Social security', 'social', ss, Math.min(x.wages, 58914), 'Contribution base', { withheldOnWages: true }),
          u.line('es-reta', 'Self-employed contributions (RETA)', 'social', seSocial, x.se, 'Net profit'),
        ],
        deductionsUsed: [...(x.wages ? [{ label: 'Other employment expenses', amount: 2000, kind: 'Deduction' }] : []), ...(reduction ? [{ label: 'Employment income reduction', amount: reduction, kind: 'Reduction' }] : [])],
      };
    },
  },
  {
    code: 'IT', name: 'Italy', continent: 'Europe', currency: 'EUR', locale: 'it-IT', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [12.5, 42.8], radius: 4 },
    authority: { name: 'the Agenzia delle Entrate', url: 'https://www.agenziaentrate.gov.it/', linkLabel: 'Go to the Agenzia delle Entrate' },
    sources: [{ name: 'Agenzia delle Entrate: IRPEF', url: 'https://www.agenziaentrate.gov.it/' }, pwc('italy', 'Italy')],
    sales: { name: 'VAT (IVA)', rate: 0.22 }, investment: { rate: 0.26, label: 'Substitute tax on savings' },
    sample: { netMonthly: 1900, scale: 0.85, payee: 'AGENZIA ENTRATE F24' },
    notes: ['Regional and municipal surcharges vary; a typical combined 2.5% is used.', 'The 2025 tax-wedge measures for lower earners are not included.', 'Self-employed contributions use the Gestione Separata rate of 26.07%.'],
    calc(x, u) {
      const inps = Math.min(x.wages, 120607) * 0.0919;
      const seInps = x.se * 0.2607;
      const taxable = u.pos(x.wages - inps + x.se - seInps + x.other + x.ordinaryInvest - Math.min(x.retirement, 5164.57));
      const it = u.br(taxable, [[0, 0.23], [28000, 0.35], [50000, 0.43]]);
      let detr = 0;
      if (x.wages > 0) {
        if (taxable <= 15000) detr = 1955;
        else if (taxable <= 28000) detr = 1910 + 1190 * (28000 - taxable) / 13000;
        else if (taxable <= 50000) detr = 1910 * (50000 - taxable) / 22000;
      }
      const local = taxable * 0.025;
      return {
        taxable,
        lines: [
          u.line('it-irpef', 'Income tax (IRPEF)', 'national', u.pos(it.tax - detr - x.charity * 0.19), taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ['Employment credit', -Math.min(detr, it.tax)]] }),
          u.line('it-add', 'Regional and municipal surcharges', 'local', local, taxable, 'Taxable income', { approximate: true }),
          u.line('it-inps', 'INPS contributions', 'social', inps + seInps, x.wages + x.se, 'Earnings', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Employment tax credit (detrazione)', amount: detr, kind: 'Credit' }],
      };
    },
  },
  {
    code: 'NL', name: 'Netherlands', continent: 'Europe', currency: 'EUR', locale: 'nl-NL', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [5.3, 52.2], radius: 1.6 },
    authority: { name: 'the Belastingdienst', url: 'https://www.belastingdienst.nl/', linkLabel: 'Go to the Belastingdienst' },
    sources: [{ name: 'Belastingdienst: Box 1 rates and tax credits', url: 'https://www.belastingdienst.nl/' }, pwc('netherlands', 'Netherlands')],
    sales: { name: 'VAT (BTW)', rate: 0.21 },
    sample: { netMonthly: 3100, scale: 0.95, payee: 'BELASTINGDIENST' },
    notes: ['Box 1 rates include national insurance contributions for people under state pension age.', 'Box 3 tax on savings is not included; savings under €57,684 owe none.', 'Self-employed profit gets the 2025 self-employed deduction (€2,470) and the 12.7% SME exemption.'],
    calc(x, u) {
      const seProfit = x.se > 0 ? u.pos(x.se - 2470) * (1 - 0.127) : 0;
      const income = x.wages + seProfit + x.other + x.ordinaryInvest;
      const taxable = u.pos(income - x.retirement);
      const it = u.br(taxable, [[0, 0.3582], [38441, 0.3748], [76817, 0.495]]);
      const general = u.pos(3068 - 0.06337 * u.pos(taxable - 28406));
      const work = x.wages + x.se;
      let labour = 0;
      if (work <= 12169) labour = 0.08053 * work;
      else if (work <= 26288) labour = 980 + 0.3003 * (work - 12169);
      else if (work <= 43071) labour = 5220 + 0.02258 * (work - 26288);
      else if (work <= 129078) labour = 5599 - 0.0651 * (work - 43071);
      const credits = Math.min(it.tax, general + labour);
      return {
        taxable,
        lines: [u.line('nl-box1', 'Income tax and national insurance (box 1)', 'national', it.tax - credits, taxable, 'Box 1 income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the box 1 rates', it.tax], ['General tax credit', -general], ['Labour tax credit', -labour]] })],
        deductionsUsed: [{ label: 'General tax credit', amount: general, kind: 'Credit' }, { label: 'Labour tax credit', amount: labour, kind: 'Credit' }],
      };
    },
  },
  {
    code: 'BE', name: 'Belgium', continent: 'Europe', currency: 'EUR', locale: 'fr-BE', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [4.6, 50.6], radius: 1.4 },
    authority: { name: 'FPS Finance', url: 'https://finances.belgium.be/', linkLabel: 'Go to FPS Finance' },
    sources: [{ name: 'FPS Finance: Personal income tax', url: 'https://finances.belgium.be/' }, pwc('belgium', 'Belgium')],
    sales: { name: 'VAT', rate: 0.21 }, investment: { rate: 0.30, allowance: 1020, label: 'Withholding tax on savings' },
    sample: { netMonthly: 2700, scale: 0.92, payee: 'SPF FINANCES' },
    notes: ['Municipal surcharges vary; a typical 7% of income tax is used.', 'Employee social security is 13.07%; self-employed contributions are approximated at 20.5% of profit.'],
    calc(x, u) {
      const ss = x.wages * 0.1307;
      const seSocial = x.se * 0.205;
      const prof = x.wages > 0 ? Math.min(5930, 0.3 * (x.wages - ss)) : 0;
      const taxable = u.pos(x.wages - ss - prof + x.se - seSocial + x.other + x.ordinaryInvest);
      const sched = [[0, 0.25], [16320, 0.40], [28800, 0.45], [49840, 0.50]];
      const it = u.br(taxable, sched);
      const free = u.br(10910, sched).tax;
      const fed = u.pos(it.tax - free - x.charity * 0.45);
      return {
        taxable,
        lines: [
          u.line('be-ipp', 'Personal income tax', 'national', fed, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ['Tax-free sum (€10,910)', -free]] }),
          u.line('be-mun', 'Municipal surcharge', 'local', fed * 0.07, fed, 'Income tax', { approximate: true }),
          u.line('be-ss', 'Social security', 'social', ss + seSocial, x.wages + x.se, 'Earnings', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Flat-rate professional expenses', amount: prof, kind: 'Deduction' }, { label: 'Tax-free sum', amount: 10910, kind: 'Allowance' }],
      };
    },
  },
  {
    code: 'PT', name: 'Portugal', continent: 'Europe', currency: 'EUR', locale: 'pt-PT', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [-8.2, 39.6], radius: 1.9 },
    authority: { name: 'the Autoridade Tributária', url: 'https://info.portaldasfinancas.gov.pt/', linkLabel: 'Go to Portal das Finanças' },
    sources: [{ name: 'Portal das Finanças: IRS rates', url: 'https://info.portaldasfinancas.gov.pt/' }, pwc('portugal', 'Portugal')],
    sales: { name: 'VAT (IVA)', rate: 0.23 }, investment: { rate: 0.28, label: 'Special rate on savings' },
    sample: { netMonthly: 1300, scale: 0.6, payee: 'AUTORIDADE TRIBUTARIA' },
    notes: ['Uses the 2025 IRS brackets after the mid-year reduction; withholding during the year used older tables.', 'Self-employed income uses the simplified regime (75% of takings) and 21.4% social security on 70% of takings.'],
    calc(x, u) {
      const ss = x.wages * 0.11;
      const specific = x.wages > 0 ? Math.max(4104, Math.min(ss, x.wages)) : 0;
      const seTaxable = x.seIncome * 0.75;
      const seSocial = x.seIncome * 0.7 * 0.214;
      const taxable = u.pos(x.wages - specific + seTaxable + x.other + x.ordinaryInvest);
      const it = u.br(taxable, [[0, 0.13], [8059, 0.165], [12160, 0.22], [17233, 0.25], [22306, 0.32], [28400, 0.355], [41629, 0.435], [44987, 0.45], [83696, 0.48]]);
      const solidarity = u.pos(Math.min(taxable, 250000) - 80000) * 0.025 + u.pos(taxable - 250000) * 0.05;
      return {
        taxable,
        lines: [
          u.line('pt-irs', 'Income tax (IRS)', 'national', it.tax + solidarity, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ...(solidarity ? [['Solidarity surcharge', solidarity]] : [])] }),
          u.line('pt-ss', 'Social security', 'social', ss + seSocial, x.wages + x.seIncome, 'Earnings', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Specific deduction for employment income', amount: specific, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'AT', name: 'Austria', continent: 'Europe', currency: 'EUR', locale: 'de-AT', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [14.5, 47.6], radius: 2 },
    authority: { name: 'the Federal Ministry of Finance (BMF)', url: 'https://www.bmf.gv.at/', linkLabel: 'Go to bmf.gv.at' },
    sources: [{ name: 'BMF: Income tax rates', url: 'https://www.bmf.gv.at/' }, pwc('austria', 'Austria')],
    sales: { name: 'VAT (USt)', rate: 0.20 }, investment: { rate: 0.275, label: 'Capital gains tax (KESt)' },
    sample: { netMonthly: 2700, scale: 0.92, payee: 'FINANZAMT OESTERREICH' },
    notes: ['The favourable 6% rate on the 13th and 14th salaries is not modelled; all pay uses the scale, so the estimate runs high for employees.', 'Employee social security 18.07% up to the annual ceiling; self-employed contributions approximated at 27%.'],
    calc(x, u) {
      const ss = Math.min(x.wages, 90300) * 0.1807;
      const seSocial = x.se * 0.27;
      const werbung = x.wages > 0 ? 132 : 0;
      const taxable = u.pos(x.wages - ss - werbung + x.se - seSocial + x.other + x.ordinaryInvest - x.charity);
      const it = u.br(taxable, [[0, 0], [13308, 0.20], [21617, 0.30], [35836, 0.40], [69166, 0.48], [103072, 0.50], [1000000, 0.55]]);
      const credit = x.wages > 0 ? Math.min(487, it.tax) : 0;
      return {
        taxable,
        lines: [
          u.line('at-est', 'Income tax', 'national', it.tax - credit, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ['Commuter credit (Verkehrsabsetzbetrag)', -credit]] }),
          u.line('at-sv', 'Social security', 'social', ss + seSocial, x.wages + x.se, 'Earnings', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Work expenses flat rate', amount: werbung, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'PL', name: 'Poland', continent: 'Europe', currency: 'PLN', locale: 'pl-PL', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025), plaid: true,
    globe: { center: [19.4, 52], radius: 3.5 },
    authority: { name: 'the National Revenue Administration (KAS)', url: 'https://www.podatki.gov.pl/', linkLabel: 'Go to podatki.gov.pl' },
    sources: [{ name: 'podatki.gov.pl: PIT scale', url: 'https://www.podatki.gov.pl/' }, pwc('poland', 'Poland')],
    sales: { name: 'VAT', rate: 0.23 }, investment: { rate: 0.19, label: 'Flat tax on savings (Belka)' },
    sample: { netMonthly: 6800, scale: 3.6, payee: 'URZAD SKARBOWY' },
    notes: ['Employment on a standard contract at the general scale. Self-employed ZUS contributions are not included.', 'Health insurance (9%) is not deductible from 2022 onwards.'],
    calc(x, u) {
      const pensionDis = Math.min(x.wages, 260190) * (0.0976 + 0.015);
      const sick = x.wages * 0.0245;
      const zus = pensionDis + sick;
      const health = u.pos(x.wages - zus) * 0.09;
      const costs = x.wages > 0 ? 3000 : 0;
      const taxable = u.pos(x.wages - zus - costs + x.se + x.other + x.ordinaryInvest);
      const it = u.br(taxable, [[0, 0.12], [120000, 0.32]]);
      return {
        taxable,
        lines: [
          u.line('pl-pit', 'Income tax (PIT)', 'national', u.pos(it.tax - 3600), taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ['Tax-reducing amount', -Math.min(3600, it.tax)]] }),
          u.line('pl-zus', 'Social insurance (ZUS)', 'social', zus, x.wages, 'Wages', { withheldOnWages: true }),
          u.line('pl-nfz', 'Health insurance (NFZ)', 'social', health, x.wages - zus, 'Wages after ZUS', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Costs of earning income', amount: costs, kind: 'Deduction' }, { label: 'Tax-reducing amount (30,000 tax-free)', amount: 3600, kind: 'Credit' }],
      };
    },
  },

  // ───────────────────────── Asia ─────────────────────────
  {
    code: 'IN', name: 'India', continent: 'Asia', currency: 'INR', locale: 'en-IN', dateOrder: 'DMY',
    taxYear: '2025–26', taxYearLabel: 'Financial year 2025–26 (1 Apr 2025 – 31 Mar 2026)', window: { start: '2025-04-01', end: '2026-03-31' },
    globe: { center: [79, 22], radius: 9 },
    authority: { name: 'the Income Tax Department', url: 'https://www.incometax.gov.in/', linkLabel: 'Go to incometax.gov.in' },
    sources: [{ name: 'Income Tax Department: New tax regime slabs', url: 'https://www.incometax.gov.in/' }, pwc('india', 'India')],
    sales: { name: 'GST', rate: 0.18 },
    sample: { netMonthly: 95000, scale: 40, payee: 'INCOME TAX DEPARTMENT CHALLAN' },
    notes: ['New tax regime (the default from FY 2023–24), with the ₹75,000 standard deduction and the section 87A rebate up to ₹12 lakh, with marginal relief.', 'Provident Fund contributions are savings, not tax, and are not shown.'],
    calc(x, u) {
      const std = x.wages > 0 ? Math.min(75000, x.wages) : 0;
      const taxable = u.pos(x.wages - std + x.se + x.other + x.ordinaryInvest);
      const it = u.br(taxable, [[0, 0], [400000, 0.05], [800000, 0.10], [1200000, 0.15], [1600000, 0.20], [2000000, 0.25], [2400000, 0.30]]);
      let tax = taxable <= 1200000 ? 0 : Math.min(it.tax, taxable - 1200000);
      const rebate = it.tax - tax;
      const surcharge = taxable > 20000000 ? 0.25 : taxable > 10000000 ? 0.15 : taxable > 5000000 ? 0.10 : 0;
      tax += tax * surcharge;
      const cess = tax * 0.04;
      return {
        taxable,
        lines: [
          u.line('in-it', 'Income tax', 'national', tax, taxable, 'Total income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the slabs', it.tax], ...(rebate ? [['Rebate under section 87A', -rebate]] : []), ...(surcharge ? [['Surcharge', tax - it.tax + rebate]] : [])] }),
          u.line('in-cess', 'Health and education cess', 'national', cess, tax, 'Income tax'),
        ],
        deductionsUsed: [{ label: 'Standard deduction', amount: std, kind: 'Deduction' }, ...(rebate ? [{ label: 'Section 87A rebate', amount: rebate, kind: 'Rebate' }] : [])],
      };
    },
  },
  {
    code: 'JP', name: 'Japan', continent: 'Asia', currency: 'JPY', locale: 'ja-JP', dateOrder: 'YMD',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [138, 36.5], radius: 5 },
    authority: { name: 'the National Tax Agency', url: 'https://www.nta.go.jp/english/', linkLabel: 'Go to the National Tax Agency' },
    sources: [{ name: 'National Tax Agency: Income tax rates', url: 'https://www.nta.go.jp/english/' }, pwc('japan', 'Japan')],
    sales: { name: 'Consumption tax', rate: 0.10 }, investment: { rate: 0.20315, label: 'Separate tax on interest and dividends' },
    sample: { netMonthly: 330000, scale: 110, payee: 'ZEIMUSHO NATIONAL TAX' },
    notes: ['Uses the 2025 reform: employment income deduction minimum ¥650,000 and the raised basic deduction.', 'Resident tax (10%) is charged the following year on this year’s income; it is shown here as part of this year’s cost.', 'Social insurance is approximated at 14.7% (health, pension, employment insurance), with pension capped.'],
    calc(x, u) {
      const w = x.wages;
      let eid = 0;
      if (w > 0) eid = w <= 1900000 ? Math.min(w, 650000) : w <= 3600000 ? w * 0.3 + 80000 : w <= 6600000 ? w * 0.2 + 440000 : w <= 8500000 ? w * 0.1 + 1100000 : 1950000;
      const social = Math.min(w, 7800000) * 0.0915 + w * 0.0555;
      const income = u.pos(w - eid) + x.se + x.other + x.ordinaryInvest;
      const basic = income <= 1320000 ? 950000 : income <= 3360000 ? 880000 : income <= 4890000 ? 680000 : income <= 6550000 ? 630000 : income <= 23500000 ? 580000 : 0;
      const taxable = Math.floor(u.pos(income - social - basic - x.retirement) / 1000) * 1000;
      const it = u.br(taxable, [[0, 0.05], [1950000, 0.10], [3300000, 0.20], [6950000, 0.23], [9000000, 0.33], [18000000, 0.40], [40000000, 0.45]]);
      const reconstruction = it.tax * 0.021;
      const residentBase = u.pos(income - social - 430000);
      const resident = residentBase > 0 ? residentBase * 0.10 + 5000 : 0;
      return {
        taxable,
        lines: [
          u.line('jp-it', 'National income tax', 'national', it.tax + reconstruction, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ['Reconstruction surtax 2.1%', reconstruction]] }),
          u.line('jp-res', 'Resident tax (prefecture and city)', 'local', resident, residentBase, 'Taxable for resident tax'),
          u.line('jp-si', 'Social insurance', 'social', social, w, 'Salary', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Employment income deduction', amount: eid, kind: 'Deduction' }, { label: 'Basic deduction', amount: basic, kind: 'Deduction' }, { label: 'Social insurance premiums', amount: social, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'SG', name: 'Singapore', continent: 'Asia', currency: 'SGD', locale: 'en-SG', dateOrder: 'DMY',
    taxYear: 'YA 2026', taxYearLabel: 'Year of assessment 2026 (income from 1 Jan – 31 Dec 2025)', window: cal(2025),
    globe: { center: [103.8, 1.35], radius: 0.9 },
    authority: { name: 'IRAS', url: 'https://www.iras.gov.sg/', linkLabel: 'Go to IRAS' },
    sources: [{ name: 'IRAS: Individual income tax rates', url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates' }, pwc('singapore', 'Singapore')],
    sales: { name: 'GST', rate: 0.09 }, investment: { rate: 0, label: 'Exempt' },
    sample: { netMonthly: 5600, scale: 1.3, payee: 'IRAS' },
    notes: ['Assumes a Singapore citizen or permanent resident aged 55 or under, paying employee CPF at 20% up to the 2025 ordinary wage ceiling ($7,400 a month).', 'Interest and Singapore dividends are tax-exempt for individuals.'],
    calc(x, u) {
      const cpf = Math.min(x.wages, 88800) * 0.20;
      const eir = x.wages + x.se > 0 ? 1000 : 0;
      const taxable = u.pos(x.wages + x.se + x.other - cpf - eir - x.charity * 2.5);
      const it = u.br(taxable, [[0, 0], [20000, 0.02], [30000, 0.035], [40000, 0.07], [80000, 0.115], [120000, 0.15], [160000, 0.18], [200000, 0.19], [240000, 0.195], [280000, 0.20], [320000, 0.22], [500000, 0.23], [1000000, 0.24]]);
      return {
        taxable,
        lines: [
          u.line('sg-it', 'Income tax', 'national', it.tax, taxable, 'Chargeable income', { parts: it.parts, marginal: it.marginal }),
          u.line('sg-cpf', 'CPF (employee share)', 'social', cpf, Math.min(x.wages, 88800), 'Ordinary wages', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'CPF relief', amount: cpf, kind: 'Relief' }, { label: 'Earned income relief', amount: eir, kind: 'Relief' }, ...(x.charity ? [{ label: 'Donations (250%)', amount: x.charity * 2.5, kind: 'Deduction' }] : [])],
      };
    },
  },
  {
    code: 'HK', name: 'Hong Kong', continent: 'Asia', currency: 'HKD', locale: 'en-HK', dateOrder: 'DMY',
    taxYear: '2025/26', taxYearLabel: 'Year of assessment 2025/26 (1 Apr 2025 – 31 Mar 2026)', window: { start: '2025-04-01', end: '2026-03-31' },
    globe: { center: [114.2, 22.3], radius: 0.8 },
    authority: { name: 'the Inland Revenue Department', url: 'https://www.ird.gov.hk/', linkLabel: 'Go to the IRD' },
    sources: [{ name: 'IRD: Tax rates of salaries tax', url: 'https://www.ird.gov.hk/' }, pwc('hong-kong-sar', 'Hong Kong SAR')],
    sales: { name: 'Sales tax', rate: 0, note: 'Hong Kong has no VAT or general sales tax.' }, investment: { rate: 0, label: 'Exempt' },
    sample: { netMonthly: 33000, scale: 7.8, payee: 'INLAND REVENUE DEPT' },
    notes: ['Salaries tax is the lower of progressive rates on net chargeable income and the standard rate (15%, 16% over HK$5 million) on net income.', 'Mandatory Provident Fund contributions are 5% up to HK$1,500 a month.', 'Interest and dividends are not taxed.'],
    calc(x, u) {
      const mpf = Math.min(x.wages * 0.05, 18000);
      const net = u.pos(x.wages + x.se + x.other - mpf - Math.min(x.charity, 0.35 * (x.wages + x.se)));
      const chargeable = u.pos(net - 132000);
      const prog = u.br(chargeable, [[0, 0.02], [50000, 0.06], [100000, 0.10], [150000, 0.14], [200000, 0.17]]);
      const standard = Math.min(net, 5000000) * 0.15 + u.pos(net - 5000000) * 0.16;
      const tax = Math.min(prog.tax, standard);
      return {
        taxable: chargeable,
        lines: [
          u.line('hk-sal', 'Salaries tax', 'national', tax, chargeable, 'Net chargeable income', { parts: prog.parts, marginal: prog.tax <= standard ? prog.marginal : 0.15, details: [['Progressive rates', prog.tax], ['Standard rate cap', standard]] }),
          u.line('hk-mpf', 'MPF (employee share)', 'social', mpf, x.wages, 'Relevant income', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Basic allowance', amount: 132000, kind: 'Allowance' }, { label: 'MPF contributions', amount: mpf, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'KR', name: 'South Korea', continent: 'Asia', currency: 'KRW', locale: 'ko-KR', dateOrder: 'YMD',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [127.8, 36.3], radius: 2.2 },
    authority: { name: 'the National Tax Service', url: 'https://www.nts.go.kr/english/main.do', linkLabel: 'Go to the National Tax Service' },
    sources: [{ name: 'National Tax Service: Income tax rates', url: 'https://www.nts.go.kr/english/main.do' }, pwc('republic-of-korea', 'Korea')],
    sales: { name: 'VAT', rate: 0.10 }, investment: { rate: 0.154, label: 'Separate tax on interest and dividends' },
    sample: { netMonthly: 3300000, scale: 1350, payee: 'NATIONAL TAX SERVICE' },
    notes: ['Employment income deduction, basic deduction, social insurance deductions and the earned income tax credit are applied; other credits are not.', 'Local income tax is 10% of national income tax.'],
    calc(x, u) {
      const w = x.wages;
      const eid = w <= 5e6 ? w * 0.7 : w <= 15e6 ? 3.5e6 + (w - 5e6) * 0.4 : w <= 45e6 ? 7.5e6 + (w - 15e6) * 0.15 : w <= 100e6 ? 12e6 + (w - 45e6) * 0.05 : Math.min(20e6, 14.75e6 + (w - 100e6) * 0.02);
      const nps = Math.min(w, 76440000) * 0.045;
      const health = w * 0.03545;
      const care = health * 0.1295;
      const emp = w * 0.009;
      const social = nps + health + care + emp;
      const taxable = u.pos(w - eid + x.se + x.other + x.ordinaryInvest - 1.5e6 - nps - health - care - emp);
      const it = u.br(taxable, [[0, 0.06], [14e6, 0.15], [50e6, 0.24], [88e6, 0.35], [150e6, 0.38], [300e6, 0.40], [500e6, 0.42], [1e9, 0.45]]);
      let credit = 0;
      if (w > 0) {
        credit = it.tax <= 1.3e6 ? it.tax * 0.55 : 715000 + (it.tax - 1.3e6) * 0.3;
        const cap = w <= 33e6 ? 740000 : w <= 70e6 ? Math.max(660000, 740000 - (w - 33e6) * 0.008) : w <= 120e6 ? Math.max(500000, 660000 - (w - 70e6) * 0.5) : Math.max(200000, 500000 - (w - 120e6) * 0.5);
        credit = Math.min(credit, cap) + 130000;
      }
      const tax = u.pos(it.tax - credit);
      return {
        taxable,
        lines: [
          u.line('kr-it', 'National income tax', 'national', tax, taxable, 'Tax base', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ['Earned income and standard credits', -Math.min(credit, it.tax)]] }),
          u.line('kr-local', 'Local income tax', 'local', tax * 0.1, tax, 'National income tax'),
          u.line('kr-si', 'Social insurance', 'social', social, w, 'Salary', { withheldOnWages: true, details: [['National pension 4.5%', nps], ['Health 3.545%', health], ['Long-term care', care], ['Employment insurance 0.9%', emp]] }),
        ],
        deductionsUsed: [{ label: 'Employment income deduction', amount: eid, kind: 'Deduction' }, { label: 'Basic deduction', amount: 1.5e6, kind: 'Deduction' }, { label: 'Social insurance', amount: social, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'CN', name: 'China', continent: 'Asia', currency: 'CNY', locale: 'zh-CN', dateOrder: 'YMD',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [104, 35], radius: 12 },
    authority: { name: 'the State Taxation Administration', url: 'https://www.chinatax.gov.cn/', linkLabel: 'Go to chinatax.gov.cn' },
    sources: [{ name: 'State Taxation Administration: IIT rates', url: 'https://www.chinatax.gov.cn/' }, pwc('peoples-republic-of-china', 'China')],
    sales: { name: 'VAT', rate: 0.13 }, investment: { only: ['dividends'], rate: 0.20, label: 'Tax on dividends' },
    sample: { netMonthly: 13000, scale: 4.8, payee: 'STATE TAXATION ADMINISTRATION' },
    notes: ['Comprehensive income of a resident. Social insurance and housing fund are approximated at 17.5% of salary with no city ceiling.', 'Interest on bank deposits is currently exempt. Special additional deductions (children, housing, elderly care) are not included.', 'Self-employed business income is taxed with salary here; it normally has its own 5–35% scale.'],
    calc(x, u) {
      const shf = x.wages * 0.175;
      const taxable = u.pos(x.wages - shf + x.se + x.other - 60000 - Math.min(x.charity, 0.3 * x.wages));
      const it = u.br(taxable, [[0, 0.03], [36000, 0.10], [144000, 0.20], [300000, 0.25], [420000, 0.30], [660000, 0.35], [960000, 0.45]]);
      return {
        taxable,
        lines: [
          u.line('cn-iit', 'Individual income tax', 'national', it.tax, taxable, 'Taxable comprehensive income', { parts: it.parts, marginal: it.marginal }),
          u.line('cn-shf', 'Social insurance and housing fund', 'social', shf, x.wages, 'Salary', { withheldOnWages: true, approximate: true }),
        ],
        deductionsUsed: [{ label: 'Basic deduction', amount: 60000, kind: 'Deduction' }, { label: 'Social insurance and housing fund', amount: shf, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'AE', name: 'United Arab Emirates', continent: 'Asia', currency: 'AED', locale: 'en-AE', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [54.3, 24], radius: 2 },
    authority: { name: 'the Federal Tax Authority', url: 'https://tax.gov.ae/', linkLabel: 'Go to the Federal Tax Authority' },
    sources: [{ name: 'Federal Tax Authority', url: 'https://tax.gov.ae/' }, pwc('united-arab-emirates', 'United Arab Emirates')],
    sales: { name: 'VAT', rate: 0.05 }, investment: { rate: 0, label: 'Exempt' },
    sample: { netMonthly: 18000, scale: 3.7, payee: 'FEDERAL TAX AUTHORITY' },
    notes: ['There is no personal income tax. Corporate tax (9%) can apply to sole traders with business turnover over AED 1 million; that is not modelled.', 'UAE nationals pay pension contributions to their emirate’s fund; expatriates do not.'],
    calc(x, u) {
      return { taxable: 0, lines: [u.line('ae-pit', 'Personal income tax', 'national', 0, x.wages + x.se + x.other, 'Income', { details: [['The UAE does not tax personal income', 0]] })], deductionsUsed: [] };
    },
  },
  {
    code: 'PK', name: 'Pakistan', continent: 'Asia', currency: 'PKR', locale: 'en-PK', dateOrder: 'DMY',
    taxYear: '2025–26', taxYearLabel: 'Tax year 2026 (1 Jul 2025 – 30 Jun 2026)', window: { start: '2025-07-01', end: '2026-06-30' },
    globe: { center: [69.5, 30], radius: 5.5 },
    authority: { name: 'the Federal Board of Revenue', url: 'https://www.fbr.gov.pk/', linkLabel: 'Go to the FBR' },
    sources: [{ name: 'FBR: Income tax rates for salaried individuals', url: 'https://www.fbr.gov.pk/' }, pwc('pakistan', 'Pakistan')],
    sales: { name: 'Sales tax', rate: 0.18 }, investment: { rates: { interest: 0.20, dividends: 0.15 }, label: 'Final tax on profit on debt and dividends' },
    sample: { netMonthly: 180000, scale: 120, payee: 'FBR INCOME TAX' },
    notes: ['Uses the salaried scale from the Finance Act 2025, including the 9% surcharge over Rs 10 million.', 'Business income normally uses a separate, higher scale; here it is added to salary.'],
    calc(x, u) {
      const taxable = u.pos(x.wages + x.se + x.other + x.ordinaryInvest - x.charity);
      const it = u.br(taxable, [[0, 0], [600000, 0.01], [1200000, 0.11], [2200000, 0.23], [3200000, 0.30], [4100000, 0.35]]);
      const surcharge = taxable > 10000000 ? it.tax * 0.09 : 0;
      return {
        taxable,
        lines: [u.line('pk-it', 'Income tax', 'national', it.tax + surcharge, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal * (surcharge ? 1.09 : 1), details: [['Tax from the slabs', it.tax], ...(surcharge ? [['Surcharge 9%', surcharge]] : [])] })],
        deductionsUsed: [{ label: 'Tax-free threshold', amount: Math.min(taxable, 600000), kind: 'Threshold' }],
      };
    },
  },
  {
    code: 'PH', name: 'Philippines', continent: 'Asia', currency: 'PHP', locale: 'en-PH', dateOrder: 'MDY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [122, 12], radius: 4.5 },
    authority: { name: 'the Bureau of Internal Revenue', url: 'https://www.bir.gov.ph/', linkLabel: 'Go to the BIR' },
    sources: [{ name: 'BIR: Income tax rates (TRAIN law, 2023 onwards)', url: 'https://www.bir.gov.ph/' }, pwc('philippines', 'Philippines')],
    sales: { name: 'VAT', rate: 0.12 }, investment: { rates: { interest: 0.20, dividends: 0.10 }, label: 'Final tax on interest and dividends' },
    sample: { netMonthly: 48000, scale: 38, payee: 'BIR TAX PAYMENT' },
    notes: ['Employee SSS, PhilHealth and Pag-IBIG use 2025 rates and ceilings. The 13th-month pay exemption (up to ₱90,000) assumes one month of salary.', 'Self-employed people may elect an 8% tax on gross receipts; the graduated rates are used here.'],
    calc(x, u) {
      const sss = Math.min(x.wages, 420000) * 0.05;
      const phil = Math.min(x.wages, 1200000) * 0.025;
      const pagibig = Math.min(x.wages * 0.02, 2400);
      const contrib = sss + phil + pagibig;
      const thirteenth = Math.min(x.wages / 13, 90000);
      const taxable = u.pos(x.wages - contrib - thirteenth + x.se + x.other);
      const it = u.br(taxable, [[0, 0], [250000, 0.15], [400000, 0.20], [800000, 0.25], [2000000, 0.30], [8000000, 0.35]]);
      return {
        taxable,
        lines: [
          u.line('ph-it', 'Income tax', 'national', it.tax, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal }),
          u.line('ph-contrib', 'SSS, PhilHealth and Pag-IBIG', 'social', contrib, x.wages, 'Salary', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: '13th-month pay exemption', amount: thirteenth, kind: 'Exemption' }, { label: 'Mandatory contributions', amount: contrib, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'MY', name: 'Malaysia', continent: 'Asia', currency: 'MYR', locale: 'en-MY', dateOrder: 'DMY',
    taxYear: 'YA 2025', taxYearLabel: 'Year of assessment 2025 (1 Jan – 31 Dec 2025)', window: cal(2025),
    globe: { center: [102, 4], radius: 3.5 },
    authority: { name: 'the Inland Revenue Board (LHDN)', url: 'https://www.hasil.gov.my/', linkLabel: 'Go to LHDN' },
    sources: [{ name: 'LHDN: Individual tax rates', url: 'https://www.hasil.gov.my/' }, pwc('malaysia', 'Malaysia')],
    sales: { name: 'Sales and service tax', rate: 0.08, note: 'Service tax is 8% on most services; sales tax is 5–10% on many goods.' }, investment: { rate: 0, label: 'Exempt' },
    sample: { netMonthly: 6200, scale: 3.4, payee: 'LHDN HASIL' },
    notes: ['Individual relief (RM9,000), EPF relief up to RM4,000 and SOCSO/EIS relief are applied; other reliefs are not.', 'Interest from Malaysian banks and single-tier dividends are exempt.'],
    calc(x, u) {
      const epf = x.wages * 0.11;
      const socso = Math.min(x.wages, 72000) * 0.005 + Math.min(x.wages, 72000) * 0.002;
      const reliefs = 9000 + Math.min(epf, 4000) + Math.min(socso, 350) + Math.min(x.retirement, 3000);
      const taxable = u.pos(x.wages + x.se + x.other - reliefs - Math.min(x.charity, 0.1 * (x.wages + x.se)));
      const it = u.br(taxable, [[0, 0], [5000, 0.01], [20000, 0.03], [35000, 0.06], [50000, 0.11], [70000, 0.19], [100000, 0.25], [400000, 0.26], [600000, 0.28], [2000000, 0.30]]);
      const rebate = taxable <= 35000 ? Math.min(400, it.tax) : 0;
      return {
        taxable,
        lines: [
          u.line('my-it', 'Income tax', 'national', it.tax - rebate, taxable, 'Chargeable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ...(rebate ? [['Individual rebate', -rebate]] : [])] }),
          u.line('my-epf', 'EPF, SOCSO and EIS', 'social', epf + socso, x.wages, 'Salary', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Personal reliefs', amount: reliefs, kind: 'Relief' }],
      };
    },
  },

  // ───────────────────────── Africa ─────────────────────────
  {
    code: 'ZA', name: 'South Africa', continent: 'Africa', currency: 'ZAR', locale: 'en-ZA', dateOrder: 'YMD',
    taxYear: '2025/26', taxYearLabel: 'Tax year 2026 (1 Mar 2025 – 28 Feb 2026)', window: { start: '2025-03-01', end: '2026-02-28' },
    globe: { center: [24.5, -29], radius: 6 },
    authority: { name: 'SARS', url: 'https://www.sars.gov.za/', linkLabel: 'Go to SARS' },
    sources: [{ name: 'SARS: Rates of tax for individuals', url: 'https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/' }, pwc('south-africa', 'South Africa')],
    sales: { name: 'VAT', rate: 0.15 }, investment: { only: ['dividends'], rate: 0.20, label: 'Dividends tax' },
    sample: { netMonthly: 31000, scale: 11, payee: 'SARS EFILING' },
    notes: ['Taxpayer under 65. Interest is exempt up to R23,800; the primary rebate is R17,235.', 'Medical scheme credits are not included.'],
    calc(x, u) {
      const uif = Math.min(x.wages, 212544) * 0.01;
      const income = x.wages + x.se + x.other;
      const interestExempt = Math.min(x.ordinaryInvest, 23800);
      const ret = Math.min(x.retirement, 0.275 * income, 350000);
      const taxable = u.pos(income + x.ordinaryInvest - interestExempt - ret);
      const it = u.br(taxable, [[0, 0.18], [237100, 0.26], [370500, 0.31], [512800, 0.36], [673000, 0.39], [857900, 0.41], [1817000, 0.45]]);
      return {
        taxable,
        lines: [
          u.line('za-it', 'Income tax', 'national', u.pos(it.tax - 17235), taxable, 'Taxable income', { parts: it.parts, marginal: it.tax > 17235 ? it.marginal : 0, details: [['Tax from the table', it.tax], ['Primary rebate', -Math.min(17235, it.tax)]] }),
          u.line('za-uif', 'UIF', 'social', uif, Math.min(x.wages, 212544), 'Remuneration', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Interest exemption', amount: interestExempt, kind: 'Exemption' }, ...(ret ? [{ label: 'Retirement fund contributions', amount: ret, kind: 'Deduction' }] : []), { label: 'Primary rebate', amount: 17235, kind: 'Rebate' }],
      };
    },
  },
  {
    code: 'NG', name: 'Nigeria', continent: 'Africa', currency: 'NGN', locale: 'en-NG', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [8, 9.5], radius: 4.5 },
    authority: { name: 'your State Internal Revenue Service or FIRS', url: 'https://www.firs.gov.ng/', linkLabel: 'Go to FIRS' },
    sources: [{ name: 'FIRS: Personal Income Tax Act', url: 'https://www.firs.gov.ng/' }, pwc('nigeria', 'Nigeria')],
    sales: { name: 'VAT', rate: 0.075 }, investment: { rate: 0.10, label: 'Final withholding tax on interest and dividends' },
    sample: { netMonthly: 480000, scale: 650, payee: 'STATE INTERNAL REVENUE' },
    notes: ['Uses the Personal Income Tax Act rules for 2025. The Nigeria Tax Act 2025 replaces them from 1 January 2026.', 'Pension (8%) and National Housing Fund (2.5%) contributions are deducted; the 1% minimum tax is applied.'],
    calc(x, u) {
      const gross = x.wages + x.se + x.other;
      const pension = x.wages * 0.08;
      const nhf = x.wages * 0.025;
      const cra = gross > 0 ? Math.max(200000, gross * 0.01) + gross * 0.2 : 0;
      const taxable = u.pos(gross - cra - pension - nhf);
      const it = u.br(taxable, [[0, 0.07], [300000, 0.11], [600000, 0.15], [1100000, 0.19], [1600000, 0.21], [3200000, 0.24]]);
      const minimum = gross > 360000 ? gross * 0.01 : 0;
      const tax = Math.max(it.tax, minimum);
      return {
        taxable,
        lines: [
          u.line('ng-pit', 'Personal income tax', 'state', tax, taxable, 'Chargeable income', { parts: it.parts, marginal: it.tax >= minimum ? it.marginal : 0.01, details: [['Tax from the bands', it.tax], ['Minimum tax (1% of gross)', minimum]] }),
          u.line('ng-pen', 'Pension and housing fund', 'social', pension + nhf, x.wages, 'Salary', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'Consolidated relief allowance', amount: cra, kind: 'Relief' }, { label: 'Pension and NHF', amount: pension + nhf, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'KE', name: 'Kenya', continent: 'Africa', currency: 'KES', locale: 'en-KE', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [37.9, 0.2], radius: 3.5 },
    authority: { name: 'the Kenya Revenue Authority', url: 'https://www.kra.go.ke/', linkLabel: 'Go to KRA' },
    sources: [{ name: 'KRA: PAYE rates', url: 'https://www.kra.go.ke/' }, pwc('kenya', 'Kenya')],
    sales: { name: 'VAT', rate: 0.16 }, investment: { rates: { interest: 0.15, dividends: 0.05 }, label: 'Final withholding tax on interest and dividends' },
    sample: { netMonthly: 115000, scale: 75, payee: 'KRA ITAX' },
    notes: ['NSSF uses the February 2025 upper earnings limit (KSh 72,000 a month) for the whole year. SHIF (2.75%) and the housing levy (1.5%) are deductible from December 2024.'],
    calc(x, u) {
      const nssf = Math.min(x.wages, 864000) * 0.06;
      const shif = x.wages * 0.0275;
      const ahl = x.wages * 0.015;
      const taxable = u.pos(x.wages - nssf - shif - ahl + x.se + x.other);
      const it = u.br(taxable, [[0, 0.10], [288000, 0.25], [388000, 0.30], [6000000, 0.325], [9600000, 0.35]]);
      const relief = Math.min(28800, it.tax);
      return {
        taxable,
        lines: [
          u.line('ke-paye', 'Income tax (PAYE)', 'national', it.tax - relief, taxable, 'Taxable pay', { parts: it.parts, marginal: it.marginal, details: [['Tax from the bands', it.tax], ['Personal relief', -relief]] }),
          u.line('ke-stat', 'NSSF, SHIF and housing levy', 'social', nssf + shif + ahl, x.wages, 'Gross pay', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: 'NSSF, SHIF and housing levy', amount: nssf + shif + ahl, kind: 'Deduction' }, { label: 'Personal relief', amount: 28800, kind: 'Relief' }],
      };
    },
  },
  {
    code: 'EG', name: 'Egypt', continent: 'Africa', currency: 'EGP', locale: 'en-EG', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [30, 26.5], radius: 4.5 },
    authority: { name: 'the Egyptian Tax Authority', url: 'https://www.eta.gov.eg/', linkLabel: 'Go to the ETA' },
    sources: [{ name: 'Egyptian Tax Authority', url: 'https://www.eta.gov.eg/' }, pwc('egypt', 'Egypt')],
    sales: { name: 'VAT', rate: 0.14 }, investment: { only: ['dividends'], rate: 0.10, label: 'Tax on dividends' },
    sample: { netMonthly: 26000, scale: 22, payee: 'EGYPTIAN TAX AUTHORITY' },
    notes: ['Higher earners (over about EGP 600,000) lose the lower bands; that rule is not applied, so their estimate runs low.', 'Social insurance is 11% up to an approximate 2025 ceiling of EGP 14,500 a month. Bank deposit interest is exempt.'],
    calc(x, u) {
      const si = Math.min(x.wages, 174000) * 0.11;
      const taxable = u.pos(x.wages - si - (x.wages > 0 ? 20000 : 0) + x.se + x.other);
      const it = u.br(taxable, [[0, 0], [40000, 0.10], [55000, 0.15], [70000, 0.20], [200000, 0.225], [400000, 0.25], [1200000, 0.275]]);
      return {
        taxable,
        lines: [
          u.line('eg-it', 'Salary tax', 'national', it.tax, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal }),
          u.line('eg-si', 'Social insurance', 'social', si, Math.min(x.wages, 174000), 'Insurable salary', { withheldOnWages: true, approximate: true }),
        ],
        deductionsUsed: [{ label: 'Personal exemption', amount: x.wages > 0 ? 20000 : 0, kind: 'Exemption' }],
      };
    },
  },

  // ───────────────────────── Latin America ─────────────────────────
  {
    code: 'MX', name: 'Mexico', continent: 'North America', currency: 'MXN', locale: 'es-MX', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [-102, 23.5], radius: 7 },
    authority: { name: 'the SAT', url: 'https://www.sat.gob.mx/', linkLabel: 'Go to the SAT' },
    sources: [{ name: 'SAT: Annual ISR table', url: 'https://www.sat.gob.mx/' }, pwc('mexico', 'Mexico')],
    sales: { name: 'VAT (IVA)', rate: 0.16 },
    sample: { netMonthly: 27000, scale: 18, payee: 'SAT PAGO REFERENCIADO' },
    notes: ['Annual ISR table for individuals. IMSS employee contributions are approximated at 2.4%.', 'Interest withholding on capital is not modelled; interest and dividends are added to income.'],
    calc(x, u) {
      const imss = x.wages * 0.024;
      const taxable = u.pos(x.wages + x.se + x.other + x.ordinaryInvest - Math.min(x.retirement, 0.1 * (x.wages + x.se)));
      const it = u.br(taxable, [[0, 0.0192], [8952.5, 0.064], [75984.56, 0.1088], [133536.08, 0.16], [155229.81, 0.1792], [185852.58, 0.2136], [374837.89, 0.2352], [590795, 0.30], [1127926.85, 0.32], [1503902.47, 0.34], [4511707.38, 0.35]]);
      return {
        taxable,
        lines: [
          u.line('mx-isr', 'Income tax (ISR)', 'national', it.tax, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal }),
          u.line('mx-imss', 'IMSS contributions', 'social', imss, x.wages, 'Salary', { withheldOnWages: true, approximate: true }),
        ],
        deductionsUsed: [],
      };
    },
  },
  {
    code: 'BR', name: 'Brazil', continent: 'South America', currency: 'BRL', locale: 'pt-BR', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [-52, -10], radius: 12 },
    authority: { name: 'the Receita Federal', url: 'https://www.gov.br/receitafederal/', linkLabel: 'Go to the Receita Federal' },
    sources: [{ name: 'Receita Federal: IRPF tables', url: 'https://www.gov.br/receitafederal/' }, pwc('brazil', 'Brazil')],
    sales: { name: 'Consumption taxes (ICMS)', rate: 0.17, note: 'ICMS varies by state (17–23%), with ISS on services; 17% is a typical rate.' },
    investment: { only: ['interest'], rate: 0.15, label: 'Tax on fixed-income returns' },
    sample: { netMonthly: 6800, scale: 4.2, payee: 'RECEITA FEDERAL DARF' },
    notes: ['Monthly tables from May 2025 applied across 12 months; the 13th salary is taxed separately and is not included.', 'The simplified discount (R$607.20 a month) is used when it beats the INSS deduction. Dividends are exempt in 2025.', 'Self-employed contributions are approximated at 20% up to the INSS ceiling.'],
    calc(x, u) {
      const monthly = x.wages / 12;
      const inssM = u.br(Math.min(monthly, 8157.41), [[0, 0.075], [1518, 0.09], [2793.88, 0.12], [4190.83, 0.14]]).tax;
      const seM = x.se / 12;
      const seInss = Math.min(seM, 8157.41) * 0.20 * 12;
      const deduction = Math.max(inssM, 607.20);
      const baseM = u.pos(monthly + seM + x.other / 12 - deduction - x.retirement / 12);
      const sched = [[0, 0], [2428.80, 0.075], [2826.65, 0.15], [3751.05, 0.225], [4664.68, 0.275]];
      const it = u.br(baseM, sched);
      return {
        taxable: baseM * 12,
        lines: [
          u.line('br-irpf', 'Income tax (IRPF)', 'national', it.tax * 12, baseM * 12, 'Taxable income', { parts: it.parts.map((p) => ({ ...p, from: p.from * 12, to: p.to == null ? null : p.to * 12, amount: p.amount * 12, tax: p.tax * 12 })), marginal: it.marginal }),
          u.line('br-inss', 'INSS', 'social', inssM * 12 + seInss, x.wages + x.se, 'Earnings', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: deduction === 607.2 ? 'Simplified monthly discount' : 'INSS contributions', amount: deduction * 12, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'CL', name: 'Chile', continent: 'South America', currency: 'CLP', locale: 'es-CL', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [-71, -32], radius: 4 },
    authority: { name: 'the SII', url: 'https://www.sii.cl/', linkLabel: 'Go to the SII' },
    sources: [{ name: 'SII: Global complementary tax', url: 'https://www.sii.cl/' }, pwc('chile', 'Chile')],
    sales: { name: 'VAT (IVA)', rate: 0.19 },
    sample: { netMonthly: 1350000, scale: 900, payee: 'TESORERIA SII' },
    notes: ['Brackets are set in tax units; an average 2025 annual tax unit of CLP 822,000 is used, so thresholds are approximate.', 'Employee AFP pension, health (7%) and unemployment insurance are approximated at 18.8% up to the 2025 ceiling.'],
    calc(x, u) {
      const UTA = 822000;
      const social = Math.min(x.wages, 41000000) * 0.188;
      const taxable = u.pos(x.wages - social + x.se + x.other + x.ordinaryInvest);
      const it = u.br(taxable, [[0, 0], [13.5 * UTA, 0.04], [30 * UTA, 0.08], [50 * UTA, 0.135], [70 * UTA, 0.23], [90 * UTA, 0.304], [120 * UTA, 0.35], [310 * UTA, 0.40]]);
      return {
        taxable,
        lines: [
          u.line('cl-it', 'Income tax', 'national', it.tax, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal, approximate: true }),
          u.line('cl-soc', 'AFP, health and unemployment', 'social', social, x.wages, 'Salary', { withheldOnWages: true, approximate: true }),
        ],
        deductionsUsed: [{ label: 'Mandatory social contributions', amount: social, kind: 'Deduction' }],
      };
    },
  },
  {
    code: 'CO', name: 'Colombia', continent: 'South America', currency: 'COP', locale: 'es-CO', dateOrder: 'DMY',
    taxYear: '2025', taxYearLabel: label(2025), window: cal(2025),
    globe: { center: [-73, 4.5], radius: 5 },
    authority: { name: 'the DIAN', url: 'https://www.dian.gov.co/', linkLabel: 'Go to the DIAN' },
    sources: [{ name: 'DIAN: Income tax for individuals (UVT 2025 = COP 49,799)', url: 'https://www.dian.gov.co/' }, pwc('colombia', 'Colombia')],
    sales: { name: 'VAT (IVA)', rate: 0.19 },
    sample: { netMonthly: 5200000, scale: 3800, payee: 'DIAN PAGO IMPUESTOS' },
    notes: ['Labour income gets the 25% exempt portion (capped at 790 UVT); total deductions and exemptions are capped at 40% of income or 1,340 UVT.', 'Dividends normally have their own schedule; here they are added to income.'],
    calc(x, u) {
      const UVT = 49799;
      const social = x.wages * 0.08;
      const net = u.pos(x.wages - social + x.se);
      const exempt = Math.min(0.25 * net, 790 * UVT);
      const capped = Math.min(exempt + x.retirement, 0.4 * (x.wages + x.se), 1340 * UVT);
      const taxable = u.pos(net - capped + x.other + x.ordinaryInvest);
      const it = u.br(taxable, [[0, 0], [1090 * UVT, 0.19], [1700 * UVT, 0.28], [4100 * UVT, 0.33], [8670 * UVT, 0.35], [18970 * UVT, 0.37], [31000 * UVT, 0.39]]);
      return {
        taxable,
        lines: [
          u.line('co-renta', 'Income tax', 'national', it.tax, taxable, 'Taxable income', { parts: it.parts, marginal: it.marginal }),
          u.line('co-ss', 'Pension and health', 'social', social, x.wages, 'Salary', { withheldOnWages: true }),
        ],
        deductionsUsed: [{ label: '25% exempt labour income (capped)', amount: capped, kind: 'Exemption' }],
      };
    },
  },

  // ───────────────────────── Oceania ─────────────────────────
  {
    code: 'NZ', name: 'New Zealand', continent: 'Oceania', currency: 'NZD', locale: 'en-NZ', dateOrder: 'DMY',
    taxYear: '2025–26', taxYearLabel: 'Tax year 2026 (1 Apr 2025 – 31 Mar 2026)', window: { start: '2025-04-01', end: '2026-03-31' },
    globe: { center: [172.5, -41.5], radius: 4.5 },
    authority: { name: 'Inland Revenue (IRD)', url: 'https://www.ird.govt.nz/', linkLabel: 'Go to ird.govt.nz' },
    sources: [{ name: 'IRD: Tax rates for individuals', url: 'https://www.ird.govt.nz/income-tax/income-tax-for-individuals/tax-codes-and-tax-rates-for-individuals/tax-rates-for-individuals' }, pwc('new-zealand', 'New Zealand')],
    sales: { name: 'GST', rate: 0.15 },
    sample: { netMonthly: 5300, scale: 1.6, payee: 'INLAND REVENUE IRD' },
    notes: ['Uses the thresholds in force from 31 July 2024. The independent earner tax credit is applied; KiwiSaver contributions are savings, not tax.'],
    calc(x, u) {
      const income = x.wages + x.se + x.other + x.ordinaryInvest;
      const it = u.br(income, [[0, 0.105], [15600, 0.175], [53500, 0.30], [78100, 0.33], [180000, 0.39]]);
      const ietc = income >= 24000 && income <= 70000 ? (income <= 66000 ? 520 : u.pos(520 - 0.13 * (income - 66000))) : 0;
      const acc = Math.min(x.wages + x.se, 152790) * 0.0167;
      const donation = Math.min(x.charity, income) / 3;
      return {
        taxable: income,
        lines: [
          u.line('nz-it', 'Income tax', 'national', u.pos(it.tax - ietc - donation), income, 'Taxable income', { parts: it.parts, marginal: it.marginal, details: [['Tax from the scale', it.tax], ...(ietc ? [['Independent earner credit', -ietc]] : []), ...(donation ? [['Donation credit (one third)', -donation]] : [])] }),
          u.line('nz-acc', 'ACC earners’ levy', 'social', acc, Math.min(x.wages + x.se, 152790), 'Earnings', { withheldOnWages: true }),
        ],
        deductionsUsed: ietc ? [{ label: 'Independent earner tax credit', amount: ietc, kind: 'Credit' }] : [],
      };
    },
  },
];

/** Germany's 2025 income tax formula (EStG §32a). */
export function germanTariff2025(zvE) {
  const x = Math.floor(Math.max(0, zvE));
  if (x <= 12096) return 0;
  if (x <= 17443) { const y = (x - 12096) / 10000; return Math.floor((932.30 * y + 1400) * y); }
  if (x <= 68480) { const z = (x - 17443) / 10000; return Math.floor((176.64 * z + 2397) * z + 1015.13); }
  if (x <= 277825) return Math.floor(0.42 * x - 10911.92);
  return Math.floor(0.45 * x - 19246.67);
}

export const worldByCode = Object.fromEntries(world.map((c) => [c.code, c]));
