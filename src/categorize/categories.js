// Transaction categories and how each feeds the estimate.
// `feeds` names the field in the engine's IncomeInput that the category adds to.

export const categories = [
  // Money in
  { id: 'salary', label: 'Salary and wages', group: 'income', direction: 'in', feeds: 'wages' },
  { id: 'freelance', label: 'Freelance and self-employed', group: 'income', direction: 'in', feeds: 'selfEmployment.income' },
  { id: 'interest', label: 'Interest', group: 'income', direction: 'in', feeds: 'interest' },
  { id: 'dividends', label: 'Dividends', group: 'income', direction: 'in', feeds: 'dividends' },
  { id: 'other-income', label: 'Other taxable income', group: 'income', direction: 'in', feeds: 'otherIncome' },
  { id: 'tax-refund', label: 'Tax refund', group: 'excluded', direction: 'in', feeds: null },
  { id: 'transfer-in', label: 'Transfer in (not income)', group: 'excluded', direction: 'in', feeds: null },
  { id: 'refund', label: 'Purchase refund', group: 'excluded', direction: 'in', feeds: null },

  // Money out that changes the tax
  { id: 'business', label: 'Business expense', group: 'deductible', direction: 'out', feeds: 'selfEmployment.expenses' },
  { id: 'retirement', label: 'Pension or retirement contribution', group: 'deductible', direction: 'out', feeds: 'deductions.retirement' },
  { id: 'charity', label: 'Charitable donation', group: 'deductible', direction: 'out', feeds: 'deductions.charity' },
  { id: 'mortgage-interest', label: 'Mortgage interest', group: 'deductible', direction: 'out', feeds: 'deductions.mortgageInterest', countries: ['US'] },
  { id: 'student-loan-interest', label: 'Student loan interest', group: 'deductible', direction: 'out', feeds: 'deductions.studentLoanInterest', countries: ['US'] },
  { id: 'medical', label: 'Medical costs', group: 'spending', direction: 'out', feeds: 'deductions.medical' },
  { id: 'work-expense', label: 'Work-related expense', group: 'deductible', direction: 'out', feeds: 'deductions.workExpenses', countries: ['AU'] },
  { id: 'tax-payment', label: 'Tax payment to the authority', group: 'tax', direction: 'out', feeds: 'prepaid' },

  // Everyday spending (information only; some categories carry sales tax or VAT)
  { id: 'groceries', label: 'Groceries', group: 'spending', direction: 'out', feeds: null },
  { id: 'dining', label: 'Eating out', group: 'spending', direction: 'out', feeds: 'taxableSpend' },
  { id: 'shopping', label: 'Shopping', group: 'spending', direction: 'out', feeds: 'taxableSpend' },
  { id: 'subscriptions', label: 'Subscriptions', group: 'spending', direction: 'out', feeds: 'taxableSpend' },
  { id: 'transport', label: 'Transport', group: 'spending', direction: 'out', feeds: null },
  { id: 'utilities', label: 'Bills and utilities', group: 'spending', direction: 'out', feeds: null },
  { id: 'housing', label: 'Rent or mortgage payment', group: 'spending', direction: 'out', feeds: null },
  { id: 'fees', label: 'Bank fees', group: 'spending', direction: 'out', feeds: null },
  { id: 'transfer-out', label: 'Transfer out', group: 'excluded', direction: 'out', feeds: null },
  { id: 'other-spend', label: 'Other spending', group: 'spending', direction: 'out', feeds: 'taxableSpend' },
];

export const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

export const groups = [
  { id: 'income', label: 'Taxable income' },
  { id: 'deductible', label: 'Deductible' },
  { id: 'tax', label: 'Tax paid' },
  { id: 'spending', label: 'Spending' },
  { id: 'excluded', label: 'Not counted' },
];

/** Categories that make sense for a country and a money direction. */
export function categoriesFor(country, amount) {
  const dir = amount >= 0 ? 'in' : 'out';
  return categories.filter((c) => c.direction === dir && (!c.countries || c.countries.includes(country)));
}
