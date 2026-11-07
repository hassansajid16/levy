// Realistic sample transactions for one tax year, per country. Deterministic (seeded), so the
// demo and the tests always see the same statement. Merchant and employer names are invented.
import { taxYearWindow, countryByCode } from '../data/registry.js';
import { worldByCode } from '../data/world.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PROFILES = {
  US: {
    salary: { name: 'NORTHWIND LOGISTICS PAYROLL DIRECT DEP', net: 2420, perYear: 24 },
    freelance: ['INVOICE 10{n} CLIENT PAYMENT HALCYON STUDIO', 'STRIPE PAYOUT FREELANCE DESIGN', 'CONSULTING FEE - RIVERBEND CO'],
    freelanceAmount: [900, 2600], freelanceCount: 9,
    interest: ['INTEREST PAID SAVINGS', 2.1, 11.5], dividends: ['DIVIDEND PAYMENT BROKERAGE', 95, 180],
    rent: ['RENT - ELMWOOD PROPERTY MANAGEMENT', 1650], retirement: ['IRA CONTRIBUTION BROKERAGE', 350],
    tax: ['IRS USATAXPYMT ESTIMATED TAX', 900, [4, 6, 9]], charity: ['DONATION CITY FOOD BANK', 50],
    groceries: ['GREENLEAF GROCERY #{n}', 'HARVEST MARKET', 'CORNER FRESH FOODS'], groceriesAmt: [45, 140],
    dining: ['BLUE DOOR CAFE', 'LANTERN NOODLE BAR', 'MAPLE STREET PIZZA', 'RIVERSIDE GRILL'], diningAmt: [12, 68],
    transport: ['CITY TRANSIT FARE', 'QUICKFUEL GAS STATION', 'DOWNTOWN PARKING'], transportAmt: [3, 60],
    utilities: [['CITY POWER & LIGHT ELECTRIC', 85], ['FIBERLINE INTERNET', 65], ['CELLWAVE MOBILE', 45]],
    subscriptions: [['STREAMBOX SUBSCRIPTION', 15.99], ['PULSE GYM MEMBERSHIP', 39]],
    business: [['HOSTLY WEB HOSTING', 24], ['THE COMMONS COWORKING', 180]],
    shopping: ['OAK & IRON HARDWARE STORE', 'PAGEBOUND BOOKS', 'BRIGHTLINE ELECTRONICS'], shoppingAmt: [15, 220],
    medical: ['WELLSPRING PHARMACY', 25],
    transfer: 'TRANSFER TO SAVINGS',
  },
  GB: {
    salary: { name: 'HARTWELL ENGINEERING LTD SALARY', net: 2780, perYear: 12 },
    freelance: ['INV-10{n} WREN & CO LTD', 'CLIENT PAYMENT FERNHILL STUDIO', 'FREELANCE COPY PROJECT FEE'],
    freelanceAmount: [450, 1500], freelanceCount: 6,
    interest: ['GROSS INTEREST EASY SAVER', 6, 14], dividends: ['DIVIDEND INVESTMENT ISA', 0, 0],
    rent: ['RENT FALCON LETTINGS', 1250], retirement: ['PERSONAL PENSION CONTRIBUTION', 160],
    tax: ['HMRC SELF ASSESSMENT', 650, [7]], charity: ['GIFT AID DONATION HOSPICE CHARITY', 20],
    groceries: ['GREENGROCER & CO', 'VALLEY SUPERMARKET', 'HIGH STREET FOOD HALL'], groceriesAmt: [18, 95],
    dining: ['COPPER KETTLE CAFE', 'THE ANCHOR PUB', 'SPICE ROUTE TAKEAWAY', 'NORTH STAR COFFEE'], diningAmt: [4, 46],
    transport: ['CITY RAIL TICKET', 'METRO BUS FARE', 'PARKFIELD PARKING'], transportAmt: [2.5, 48],
    utilities: [['BRIGHTSPARK ENERGY', 92], ['COUNCIL TAX', 148], ['SKYLINE BROADBAND', 32], ['TALKMORE MOBILE', 18]],
    subscriptions: [['STREAMBOX SUBSCRIPTION', 10.99], ['IRONWORKS GYM MEMBERSHIP', 32]],
    business: [['CLOUDNEST WEB HOSTING', 12], ['DOMAINLY DOMAIN RENEWAL', 9]],
    shopping: ['MARKET HALL CLOTHING', 'INKWELL BOOKS', 'HOMEWARE OUTLET'], shoppingAmt: [8, 140],
    medical: ['HIGH STREET CHEMIST', 9],
    transfer: 'TRANSFER TO SAVINGS',
  },
  CA: {
    salary: { name: 'TAMARACK SYSTEMS PAYROLL DEPOSIT', net: 2050, perYear: 26 },
    freelance: ['INVOICE 20{n} CLIENT PAYMENT', 'CONSULTING FEE - BIRCHWOOD INC', 'FREELANCE TRANSLATION PAYMENT'],
    freelanceAmount: [500, 1900], freelanceCount: 7,
    interest: ['INTEREST CREDIT HIGH INTEREST SAVINGS', 4, 16], dividends: ['DIVIDEND PAYMENT BROKERAGE', 60, 140],
    rent: ['RENT - LAKESHORE PROPERTY MANAGEMENT', 1900], retirement: ['RRSP CONTRIBUTION', 300],
    tax: ['CRA INSTALMENT RECEIVER GENERAL', 500, [3, 6, 9, 12]], charity: ['DONATION COMMUNITY FOOD BANK', 40],
    groceries: ['NORTHERN GROCER', 'FRESHWAY SUPERMARKET', 'MAPLE MARKET'], groceriesAmt: [35, 160],
    dining: ['TIMBERLINE CAFE', 'HARBOUR SUSHI', 'POUTINE KITCHEN', 'GOLDEN BISTRO'], diningAmt: [8, 70],
    transport: ['CITY TRANSIT PRESTO FARE', 'NORTHFUEL GAS STATION', 'PARKSIDE PARKING'], transportAmt: [3.3, 75],
    utilities: [['HYDRO ELECTRIC UTILITY', 95], ['FIBERNET INTERNET', 70], ['TELEMAX MOBILE', 55]],
    subscriptions: [['STREAMBOX SUBSCRIPTION', 16.99], ['SUMMIT GYM MEMBERSHIP', 45]],
    business: [['CLOUDNEST WEB HOSTING', 18], ['QUILL SOFTWARE LICENSE', 29]],
    shopping: ['CEDAR HARDWARE STORE', 'LANTERN BOOKS', 'NORTHSIDE ELECTRONICS'], shoppingAmt: [12, 260],
    medical: ['CORNERSTONE PHARMACY', 22],
    transfer: 'TRANSFER TO SAVINGS',
  },
  AU: {
    salary: { name: 'COASTLINE ANALYTICS PTY LTD SALARY', net: 2690, perYear: 26 },
    freelance: ['INVOICE 30{n} CLIENT PAYMENT', 'FREELANCE PHOTOGRAPHY FEE', 'CONSULTING - SALTBUSH CO'],
    freelanceAmount: [400, 1600], freelanceCount: 6,
    interest: ['INTEREST PAID ONLINE SAVER', 8, 22], dividends: ['DIVIDEND PAYMENT SHARE REGISTRY', 120, 260],
    rent: ['RENT - HARBOURVIEW REAL ESTATE PROPERTY MANAGEMENT', 2400], retirement: ['SUPER CONTRIBUTION PERSONAL', 0],
    tax: ['ATO PAYG INSTALMENT', 450, [10, 1, 4]], charity: ['DONATION BUSHFIRE RELIEF FUND', 50],
    groceries: ['SOUTHERN CROSS SUPERMARKET', 'GUM TREE FRESH FOODS', 'HARBOUR MARKET'], groceriesAmt: [30, 180],
    dining: ['FLAT WHITE CAFE', 'BONDI BURGER KITCHEN', 'KOOKABURRA PIZZA', 'SALT & PEPPER EATERY'], diningAmt: [6, 75],
    transport: ['OPAL TRANSIT FARE', 'BLUEGUM FUEL', 'CBD PARKING'], transportAmt: [3.2, 85],
    utilities: [['SUNSHINE ENERGY ELECTRIC', 110], ['BRIDGE INTERNET', 79], ['OUTBACK MOBILE', 45]],
    subscriptions: [['STREAMBOX SUBSCRIPTION', 18.99], ['TIDE GYM MEMBERSHIP', 55]],
    business: [['CLOUDNEST WEB HOSTING', 20]],
    shopping: ['WATTLE HARDWARE STORE', 'DUSTJACKET BOOKS', 'REEF ELECTRONICS'], shoppingAmt: [15, 240],
    medical: ['CORNER CHEMIST', 28],
    transfer: 'TRANSFER TO SAVINGS',
  },
};

// For the simplified countries: the US template in local currency, with a local tax office.
function scaledProfile(def) {
  if (!def) return null;
  const k = def.sample.scale;
  const r = (n) => Math.round(n * k * 100) / 100;
  const pair = ([a, b]) => [r(a), r(b)];
  const base = PROFILES.US;
  return {
    ...base,
    salary: { name: 'NORTHWIND LOGISTICS SALARY', net: def.sample.netMonthly, perYear: 12 },
    freelanceAmount: pair(base.freelanceAmount).map((v) => v * 0.8), freelanceCount: 6,
    interest: [base.interest[0], r(base.interest[1]), r(base.interest[2])],
    dividends: [base.dividends[0], r(base.dividends[1]), r(base.dividends[2])],
    rent: [base.rent[0], r(base.rent[1] * 0.8)],
    retirement: ['PENSION CONTRIBUTION', r(150)],
    tax: [`${def.sample.payee} TAX PAYMENT`, r(500), [6, 12]],
    charity: [base.charity[0], r(base.charity[1])],
    groceriesAmt: pair(base.groceriesAmt), diningAmt: pair(base.diningAmt), transportAmt: pair(base.transportAmt), shoppingAmt: pair(base.shoppingAmt),
    utilities: base.utilities.map(([n, a]) => [n, r(a)]),
    subscriptions: base.subscriptions.map(([n, a]) => [n, r(a)]),
    business: base.business.map(([n, a]) => [n, r(a)]),
    medical: [base.medical[0], r(base.medical[1])],
    fee: r(5), transferAmount: r(200),
  };
}

const pad = (n) => String(n).padStart(2, '0');
const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const money = (n) => Math.round(n * 100) / 100;

/** @returns {{date:string, description:string, amount:number}[]} sorted by date */
export function generateSample(country = 'US', seed = 2025) {
  const p = PROFILES[country] || scaledProfile(worldByCode[country]) || PROFILES.US;
  const rand = rng(seed + country.charCodeAt(0) * 31 + country.charCodeAt(1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + rand() * (b - a);
  const { start, end } = taxYearWindow(country);
  const out = [];
  const clampDate = (d) => (d < start ? start : d > end ? end : d);
  const add = (date, description, amount) => out.push({ date: clampDate(date), description, amount: money(amount) });

  // Twelve monthly anchors from the start of the tax year.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i, 1);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  });
  const day = (ym, dd) => `${ym}-${pad(dd)}`;

  // Salary
  const step = 365 / p.salary.perYear;
  for (let i = 0; i < p.salary.perYear; i++) {
    const date = addDays(start, Math.round(i * step) + (p.salary.perYear === 12 ? 24 : 6));
    add(date, p.salary.name, p.salary.net);
  }
  // Freelance
  for (let i = 0; i < p.freelanceCount; i++) {
    const m = months[Math.floor((i * 12) / p.freelanceCount + rand() * 1.2) % 12];
    add(day(m, 3 + Math.floor(rand() * 24)), pick(p.freelance).replace('{n}', String(10 + i)), Math.round(between(...p.freelanceAmount) / 10) * 10);
  }
  months.forEach((m, i) => {
    add(day(m, 1), p.rent[0], -p.rent[1]);
    add(day(m, 28), p.interest[0], between(p.interest[1], p.interest[2]));
    if (p.dividends[1] && i % 3 === 2) add(day(m, 15), p.dividends[0], between(p.dividends[1], p.dividends[2]));
    if (p.retirement[1]) add(day(m, 2), p.retirement[0], -p.retirement[1]);
    for (const [name, amt] of p.utilities) add(day(m, 8 + Math.floor(rand() * 10)), name, -money(amt * between(0.9, 1.12)));
    for (const [name, amt] of p.subscriptions) add(day(m, 12), name, -amt);
    for (const [name, amt] of p.business) add(day(m, 5), name, -amt);
    for (let w = 0; w < 4; w++) add(day(m, 3 + w * 7), pick(p.groceries).replace('{n}', String(100 + Math.floor(rand() * 50))), -between(...p.groceriesAmt));
    for (let k = 0; k < 5; k++) add(day(m, 1 + Math.floor(rand() * 27)), pick(p.dining), -between(...p.diningAmt));
    for (let k = 0; k < 4; k++) add(day(m, 1 + Math.floor(rand() * 27)), pick(p.transport), -between(...p.transportAmt));
    if (rand() > 0.35) add(day(m, 1 + Math.floor(rand() * 27)), pick(p.shopping), -between(...p.shoppingAmt));
    if (i % 4 === 1) add(day(m, 19), p.medical[0], -p.medical[1]);
    if (i % 3 === 0) add(day(m, 20), p.charity[0], -p.charity[1]);
    if (i % 2 === 0) add(day(m, 26), p.transfer, -(p.transferAmount || 200));
    add(day(m, 27), 'MONTHLY ACCOUNT FEE', -(p.fee || (country === 'GB' ? 3 : 5)));
  });
  // Tax prepayments on the given calendar months.
  for (const mm of p.tax[2]) {
    const m = months.find((x) => +x.slice(5) === mm);
    if (m) add(day(m, 14), p.tax[0], -p.tax[1]);
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/** The same sample as a bank-style CSV (Date, Description, Amount, Balance). */
export function sampleCSV(country = 'US', seed) {
  const rows = generateSample(country, seed);
  let balance = 4200;
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-');
    const order = countryByCode[country]?.dateOrder || 'DMY';
    return order === 'MDY' ? `${m}/${d}/${y}` : order === 'YMD' ? iso : `${d}/${m}/${y}`;
  };
  const lines = ['Date,Description,Amount,Balance'];
  for (const r of rows) {
    balance = money(balance + r.amount);
    lines.push(`${fmtDate(r.date)},"${r.description}",${r.amount.toFixed(2)},${balance.toFixed(2)}`);
  }
  return lines.join('\n');
}
