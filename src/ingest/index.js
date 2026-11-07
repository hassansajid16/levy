// One entry point for every statement file. Everything runs in the browser.
import { parseCSV } from './csv.js';
import { parseOFX } from './ofx.js';
import { dedupe } from './normalize.js';

export const ACCEPTED = '.csv,.ofx,.qfx,.pdf,.txt';
export const MAX_BYTES = 20 * 1024 * 1024;

export function kindOf(name) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'ofx' || ext === 'qfx') return 'ofx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'csv' || ext === 'txt') return 'csv';
  return null;
}

/** @param {File} file */
export async function readStatement(file, { dateOrder }) {
  const kind = kindOf(file.name);
  if (!kind) throw new Error(`${file.name}: use a CSV, OFX, QFX or PDF statement.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 20 MB.`);
  const source = file.name;
  if (kind === 'pdf') {
    const { parsePDF } = await import('./pdf.js');
    return { kind, ...(await parsePDF(await file.arrayBuffer(), { dateOrder, source })) };
  }
  const text = await file.text();
  if (kind === 'ofx' || /<OFX>/i.test(text)) return { kind: 'ofx', ...parseOFX(text, { source }) };
  return { kind, ...parseCSV(text, { dateOrder, source }) };
}

export { dedupe };
