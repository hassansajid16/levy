import { parseDate, parseAmount, cleanDescription, makeId } from './normalize.js';

/** Read a tag value from OFX in either SGML (unclosed tags) or XML form. */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"');

/** Parse OFX / QFX statements (OFX 1.x SGML and 2.x XML). */
export function parseOFX(text, { source = 'OFX' } = {}) {
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) || [];
  const transactions = [];
  let skipped = 0;
  const currency = tag(text, 'CURDEF') || null;
  for (const b of blocks) {
    const date = parseDate(tag(b, 'DTPOSTED'), 'YMD');
    const amount = parseAmount(tag(b, 'TRNAMT'));
    const name = decode(tag(b, 'NAME'));
    const memo = decode(tag(b, 'MEMO'));
    const description = cleanDescription(name && memo && !memo.includes(name) ? `${name} ${memo}` : name || memo);
    if (!date || amount == null || amount === 0) { skipped++; continue; }
    transactions.push({ id: makeId(), date, description: description || '(no description)', amount, source, fitid: tag(b, 'FITID') || undefined });
  }
  if (!blocks.length) throw new Error('No transactions found in this OFX file.');
  return { transactions, skipped, currency };
}
