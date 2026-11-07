// Rule-based categoriser. Rules run in order; the first match wins. Each match carries a
// confidence so the review screen can surface the guesses worth checking first.
import { categoryById } from './categories.js';

const R = (category, pattern, confidence = 0.9, direction) => ({ category, pattern, confidence, direction });

const rules = [
  // Tax authorities: payments out are prepayments; payments in are refunds.
  R('tax-payment', /\b(revenue commissioners|finanzamt|dgfip|impots?|agencia tributaria|aeat|agenzia entrate|f24|belastingdienst|spf finances|autoridade tributaria|urzad skarbowy|income tax department|challan|zeimusho|national tax|iras|inland revenue|state taxation|federal tax authority|fbr|bir tax|lhdn|hasil|sars|internal revenue|kra|itax|egyptian tax|receita federal|darf|tesoreria|dian|sat pago|ird|irs|us treasury tax|treas tax|hmrc|self assessment|canada revenue|cra |receiver general|\bato\b|australian taxation|franchise tax|dept of revenue|department of revenue|state tax payment|estimated tax)\b/i, 0.95, 'out'),
  R('tax-refund', /\b(irs treas 310|tax ref|tax refund|hmrc refund|cra refund|ato refund|receiver general.*refund)\b/i, 0.95, 'in'),
  R('tax-refund', /\b(irs|hmrc|canada revenue|receiver general|australian taxation|\bato\b)\b/i, 0.85, 'in'),

  // Income
  R('salary', /\b(gehalt|lohn|salaire|n[oó]mina|stipendio|salaris|loon|wynagrodzenie|salario|sueldo|sal[aá]rio|kyuyo|payroll|salary|salaries|wages?|pay ?roll|direct dep(osit)?|net pay|paye|employer|pay from|monthly pay|bacs.*pay)\b/i, 0.92, 'in'),
  R('interest', /\b(interest (paid|earned|credit|payment)|int(erest)? pd|credit interest|gross interest|savings interest|^interest$|interest)\b/i, 0.9, 'in'),
  R('dividends', /\b(dividend|div(idend)? (pmt|payment|reinvest)|distribution)\b/i, 0.9, 'in'),
  R('freelance', /\b(invoice|inv[- ]?\d+|client|consulting|freelance|contract(or)? payment|stripe payout|payout|upwork|fiverr|commission|design fee|project fee|retainer)\b/i, 0.8, 'in'),
  R('refund', /\b(refund|reversal|return credit|chargeback|cashback)\b/i, 0.8, 'in'),
  R('transfer-in', /\b(transfer from|tfr from|from savings|from checking|internal transfer|own account|xfer from|zelle from|venmo from)\b/i, 0.85, 'in'),
  R('other-income', /\b(rental income|rent received|royalt(y|ies)|prize|award|benefit|pension payment|annuity)\b/i, 0.7, 'in'),

  // Deductible and tax-relevant spending
  R('retirement', /\b(401\s?k|403b|\bira\b|roth|rrsp|pension contribution|sipp|super(annuation)? contribution|personal pension|retirement)\b/i, 0.9, 'out'),
  R('charity', /\b(donation|charity|charitable|foundation|red cross|gift aid|church|tithe|relief fund|food bank)\b/i, 0.85, 'out'),
  R('student-loan-interest', /\b(student loan|navient|nelnet|sallie|fedloan)\b/i, 0.6, 'out'),
  R('housing', /\b(mortgage|home loan)\b/i, 0.75, 'out'),
  R('medical', /\b(pharmacy|chemist|clinic|dental|dentist|hospital|medical|doctor|optician|physio|health centre|health center)\b/i, 0.8, 'out'),
  R('business', /\b(coworking|co-working|web hosting|hosting|domain|software licen[cs]e|adobe|figma|office supplies|accountant|bookkeep|business|professional membership|stationery|printer ink)\b/i, 0.7, 'out'),

  // Everyday spending
  R('transfer-out', /\b(transfer to|tfr to|to savings|xfer to|internal transfer|own account|zelle to|venmo to|credit card payment|card payment thank you|autopay payment)\b/i, 0.85, 'out'),
  R('housing', /\b(rent|letting|lettings|property management|landlord|strata|hoa)\b/i, 0.8, 'out'),
  R('utilities', /\b(electric|energy|power|gas bill|water|utility|utilities|broadband|internet|mobile|phone|telecom|council tax|insurance)\b/i, 0.8, 'out'),
  R('groceries', /\b(grocer|greengrocer|grocery|groceries|supermarket|market|fresh foods|food hall|butcher|bakery)\b/i, 0.8, 'out'),
  R('dining', /\b(cafe|café|coffee|restaurant|bistro|diner|pizza|burger|takeaway|kitchen|grill|sushi|bar & |pub|noodle|eatery|tacos?)\b/i, 0.8, 'out'),
  R('transport', /\b(transit|metro|rail|train|bus|taxi|cab|rideshare|parking|fuel|petrol|gas station|toll|airline|flight)\b/i, 0.8, 'out'),
  R('subscriptions', /\b(subscription|streaming|monthly plan|membership|gym|music|news|cloud storage)\b/i, 0.75, 'out'),
  R('fees', /\b(fee|overdraft|service charge|atm|monthly account)\b/i, 0.75, 'out'),
  R('shopping', /\b(store|shop|outlet|retail|books|electronics|hardware|clothing|apparel|home goods|department)\b/i, 0.65, 'out'),
];

/**
 * @param {{description:string, amount:number}} tx
 * @returns {{category:string, confidence:number, rule?: string}}
 */
export function categorize(tx, { country } = {}) {
  const dir = tx.amount >= 0 ? 'in' : 'out';
  for (const r of rules) {
    if (r.direction && r.direction !== dir) continue;
    if (!r.pattern.test(tx.description)) continue;
    const c = categoryById[r.category];
    if (c.countries && country && !c.countries.includes(country)) continue;
    return { category: r.category, confidence: r.confidence };
  }
  return dir === 'in' ? { category: 'transfer-in', confidence: 0.3 } : { category: 'other-spend', confidence: 0.3 };
}

/** A merchant key for "apply to similar": the description with numbers and dates removed. */
export function merchantKey(description) {
  return description.toLowerCase().replace(/\d+/g, '').replace(/[^a-z& ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
}

export function categorizeAll(transactions, opts) {
  return transactions.map((t) => (t.category ? t : { ...t, ...categorize(t, opts) }));
}
