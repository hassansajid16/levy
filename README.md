# Levy

A private, in-browser personal tax estimator. Pick where you live, add a year of bank statements
(or use the demo bank connection), check how each transaction is categorised, and see what you
probably owe: national, state or provincial, local and social taxes, with every bracket, tax year
and source shown.

> **Estimates only.** Levy may contain mistakes, is not tax, legal, accounting or financial advice,
> and its makers accept no responsibility or liability for decisions based on it. Check with a
> qualified tax professional or the official tax authority before you file or pay.

## Run it

Needs Node 20 or later.

```bash
npm install     # one dependency: pdfjs-dist, used to read PDF statements
npm start       # http://localhost:5173
```

Without `npm install` everything except PDF reading still works.

**On Windows**, double-click `start.cmd`: it installs what's needed the first time, starts the
server and opens the browser. If PowerShell says "running scripts is disabled", type `npm.cmd`
instead of `npm` (for example `npm.cmd start`), or just run `node server.mjs`.

```bash
npm test        # 80 unit tests: worked tax examples, parsers, categoriser, Plaid (mocked), end to end
npm run samples # regenerate the sample statements in samples/
```

## How it works

1. **Where you live.** Country, then state, province or nation, then city or county where a local
   income tax applies (for example New York City, Philadelphia, Ohio cities, Maryland counties,
   Detroit, Portland). US filers also choose a filing status and the number of children.
2. **Statements.** Upload CSV, OFX/QFX or text-based PDF statements, or connect the demo bank.
   Files are parsed in the browser. Transactions are kept in `sessionStorage` and cleared when the
   tab closes. Nothing is sent to the server.
3. **Review categories.** A rule-based categoriser labels each transaction (salary, freelance,
   interest, dividends, business expenses, pension contributions, donations, tax payments and so
   on). Changing one transaction can also change the others from the same merchant, and there's an
   undo. Salary on a statement is take-home pay, so Levy either works out gross pay from it or uses
   the figures from your W-2, P60, T4 or income statement.
4. **Disclaimer.** You have to acknowledge the disclaimer before you see your first results.
5. **Estimate.** Shows the balance to pay or the refund, a bar of where your income goes, total and
   taxable income, effective and marginal rates, each tax with its brackets, the deductions used,
   tax already paid, sales tax or VAT paid (for information only), assumptions and sources. You can
   print it, save it as a PDF or download it as a CSV.

## What is real and what is demo

| Part | Status |
| --- | --- |
| Tax calculations | Real rules, coded from the published schedules. Each jurisdiction carries its tax year and source. |
| CSV, OFX and PDF parsing | Real. Runs in the browser. PDF needs a text layer, so scanned statements won't work. |
| Categorisation | Real but heuristic: keyword rules with a confidence score. Low-confidence guesses are flagged. |
| Bank connection | **Plaid** when you add Plaid keys (sandbox or production), for the countries Plaid covers. Otherwise a **demo** that runs the same steps and returns generated sample transactions with invented bank names. |
| Sample data | Generated and deterministic. Every employer, merchant and bank name is invented. |

### Connecting real banks with Plaid

1. Create a free account at [dashboard.plaid.com](https://dashboard.plaid.com/) and copy your
   **client ID** and **Sandbox secret** from Developers → Keys.
2. Copy `.env.example` to `.env` in this folder and fill in `PLAID_CLIENT_ID` and `PLAID_SECRET`
   (keep `PLAID_ENV=sandbox`).
3. Restart Levy. The terminal prints `Bank connection: Plaid (sandbox)`, and the Import page shows
   **Connect with Plaid**.
4. In Plaid's window choose any bank and sign in with Plaid's test login `user_good` / `pass_good`.
   Sandbox banks hold fake transactions that Plaid generates.

For real banks, switch to `PLAID_ENV=production` with a production secret; Plaid has to approve
your app first. Most UK and EU banks use OAuth, which needs `PLAID_REDIRECT_URI` registered in the
dashboard.

How it's built: the secret and the access tokens stay in the local server (`server/plaid.mjs`);
the browser only gets a short-lived Link token and an opaque connection id. Access tokens are kept
in memory, so they're gone when the server stops, and `/api/bank/*` answers only the app's own
pages. Plaid covers the US, Canada, the UK and these EU/EEA countries: Ireland, France, Spain, the
Netherlands, Germany, Italy, Poland, Belgium, Austria, Portugal, Denmark, Finland, Norway, Sweden,
Estonia, Lithuania and Latvia. Other countries fall back to the demo.

`src/bank/provider.js` defines the provider interface, so another aggregator (TrueLayer, Basiq,
Flinks...) can be added the same way.

### Hosting it for other people

Out of the box Levy listens only on your own computer. To put it online, run it on any Node host
(Render, Railway, Fly.io, a VPS) with `npm install` and `npm start`, and set these environment
variables in the host's dashboard rather than in a file:

- `HOST=0.0.0.0`, and `PORT` if the host doesn't set it
- `PUBLIC_ORIGIN`: the HTTPS address people use, for example `https://levy.example.com`
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, plus `PLAID_REDIRECT_URI` for OAuth banks

Real users' banks need `PLAID_ENV=production`, which Plaid grants after reviewing your app, and
production use of bank data comes with Plaid's privacy and security requirements.

## Tax data

| Jurisdiction | Year | Covers |
| --- | --- | --- |
| US federal | 2025 (as amended by P.L. 119-21) | Brackets for single, married filing jointly and head of household; standard deduction; qualified dividends at 0/15/20%; Social Security and Medicare including the additional 0.9%; self-employment tax; NIIT; QBI deduction (below the threshold); child tax credit; itemised deductions with the $40k SALT cap |
| US states | 2025 | All 50 states and DC: brackets, standard deductions, exemptions, credits, CA SDI |
| US local | 2025 | NYC, Yonkers, Ohio cities, Philadelphia, Pittsburgh, Detroit and other Michigan cities, Maryland counties, Indiana counties, Louisville, Lexington, Kansas City, St. Louis, Wilmington, Birmingham, Denver OPT, Portland Metro and Multnomah taxes |
| UK | 2025/26 | Personal allowance and taper; rUK and Scottish bands; savings starting rate and personal savings allowance; dividend allowance and rates; Class 1 and Class 4 NI; trading allowance; relief-at-source band extension |
| Canada | 2025 (14.5% blended lowest federal rate) | Federal and all 13 provinces and territories; BPA and its phase-down; CPP, CPP2, QPP, EI and QPIP; Ontario surtax and health premium; Quebec abatement; eligible dividend gross-up and credit |
| Australia | 2025–26 | Resident brackets, low income tax offset, Medicare levy with the low-income shade-in |

**Simplified countries (29).** Europe: Ireland, Germany, France, Spain, Italy, Netherlands, Belgium,
Portugal, Austria, Poland. Asia: India, Japan, Singapore, Hong Kong, South Korea, China, UAE,
Pakistan, Philippines, Malaysia. Africa: South Africa, Nigeria, Kenya, Egypt. Latin America: Mexico,
Brazil, Chile, Colombia. Oceania: New Zealand. Each models a single resident: national brackets,
the main allowances and credits, employee social contributions, flat taxes on savings and the VAT
rate, with its tax year and sources (the national tax authority and PwC Worldwide Tax Summaries).
Regional and local taxes, family situations and special regimes are not modelled; each country's
notes list its gaps, and the app labels these countries "Simplified model". They live in
`src/data/world.js` and run through `src/tax/generic.js`.

Why these years: they are the most recent complete tax years, which is the period a full year of
bank statements covers.

The rules live in `src/data/` and the calculators in `src/tax/`. The simplifications each one
makes are listed in its `notes` and shown under the result. Some figures need checking against
the source before you rely on them:

- Australia's 2025–26 Medicare low-income threshold ($28,011) was announced in the 2026–27 Budget
  and may not be law yet.
- State sales tax rates are combined state and average local rates, used for the information panel
  only.
- Indiana, Pennsylvania and Maryland offer a "typical rate" option for areas not listed.

### Adding a country

The quick way is one entry in `src/data/world.js`: its currency, tax year window, sources, VAT
rate, a centre and radius for the globe, and a `calc(x, u)` that returns its tax lines. Then add
a worked example to `tests/world.test.js`. For a fully detailed country with regions, write
`src/data/<country>.js` and `src/tax/<country>.js` and register both in `src/data/registry.js`
and `src/tax/engine.js`, as the US, UK, Canada and Australia are.

## Project layout

```
server.mjs            zero-dependency static server (+ /api/bank seam)
index.html
src/main.js           router and render loop
src/store.js          state, persistence, estimate wiring
src/views/            location, statements, review, estimate, shell (nav, footer, disclaimer)
src/tax/              engine + per-country calculators
src/data/             jurisdiction rules with tax years and sources
src/ingest/           CSV, OFX and PDF readers
src/categorize/       categories, rules, summary into engine input
src/bank/             provider interface, demo provider, aggregator template
src/sample/           deterministic sample statement generator
tests/                node:test suites
samples/              sample CSV, OFX and PDF statements to upload
```
