// Levy — tiny zero-dependency local server.
// Serves the app and the vendored PDF reader. Uploaded statements never reach it: they are parsed
// in the browser. /api/bank/* talks to Plaid when PLAID_CLIENT_ID and PLAID_SECRET are set (in the
// environment or in .env); otherwise it reports that only the demo bank is available.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { createPlaid, plaidConfig, loadDotEnv } from './server/plaid.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const envFile = join(root, '.env');
if (existsSync(envFile)) loadDotEnv(readFileSync(envFile, 'utf8'));
const port = Number(process.env.PORT) || 5173;
// HOST=0.0.0.0 when hosting; PUBLIC_ORIGIN is the address people use (e.g. https://levy.example.com).
const host = process.env.HOST || '127.0.0.1';
const publicOrigin = (process.env.PUBLIC_ORIGIN || '').replace(/\/+$/, '');
const plaidCfg = plaidConfig();
const plaid = plaidCfg ? createPlaid(plaidCfg) : null;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.ofx': 'application/x-ofx',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

// URL prefix -> folder on disk. Only these are reachable.
const mounts = [
  ['/vendor/pdfjs/', join(root, 'node_modules', 'pdfjs-dist', 'build')],
  ['/src/', join(root, 'src')],
  ['/samples/', join(root, 'samples')],
  ['/public/', join(root, 'public')],
];

const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://cdn.plaid.com; frame-src https://cdn.plaid.com https://*.plaid.com; worker-src 'self' blob:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.plaid.com; frame-ancestors 'none'",
};

function resolvePath(urlPath) {
  if (urlPath === '/' || urlPath === '/index.html') return join(root, 'index.html');
  for (const [prefix, dir] of mounts) {
    if (urlPath.startsWith(prefix)) {
      const file = normalize(join(dir, urlPath.slice(prefix.length)));
      return file.startsWith(dir) ? file : null;
    }
  }
  return null;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...security });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 64 * 1024) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('Bad JSON')); } });
    req.on('error', reject);
  });
}

// Only the app's own pages may use the bank routes.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return req.method === 'GET';
  if (publicOrigin && origin === publicOrigin) return true;
  try { const o = new URL(origin); return ['localhost', '127.0.0.1'].includes(o.hostname) && Number(o.port || 80) === port; } catch { return false; }
}

async function handleBank(req, res, url, path) {
  if (!sameOrigin(req)) return sendJson(res, 403, { error: 'forbidden', message: 'Requests must come from the Levy app.' });
  const route = path.slice('/api/bank/'.length);
  if (route === 'status' && req.method === 'GET') {
    return sendJson(res, 200, plaid ? plaid.status() : { provider: 'demo', message: 'Add PLAID_CLIENT_ID and PLAID_SECRET to .env to enable Plaid.' });
  }
  if (!plaid) return sendJson(res, 501, { error: 'not_configured', message: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env and restart.' });
  try {
    if (route === 'link-token' && req.method === 'POST') {
      const body = await readBody(req);
      return sendJson(res, 200, await plaid.linkToken(String(body.country || '')));
    }
    if (route === 'exchange' && req.method === 'POST') {
      const body = await readBody(req);
      return sendJson(res, 200, await plaid.exchange(body.publicToken, body.institutionName));
    }
    if (route === 'transactions' && req.method === 'GET') {
      return sendJson(res, 200, await plaid.transactions(url.searchParams.get('connection'), url.searchParams.get('from'), url.searchParams.get('to')));
    }
    if (route.startsWith('connection/') && req.method === 'DELETE') {
      return sendJson(res, 200, await plaid.remove(decodeURIComponent(route.slice('connection/'.length))));
    }
    return sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    return sendJson(res, err.status && err.status < 500 ? err.status : 502, { error: err.code || 'plaid_error', message: err.message });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);

  if (path.startsWith('/api/bank/')) {
    await handleBank(req, res, url, path);
    return;
  }

  const file = resolvePath(path);
  if (!file) { res.writeHead(404, security); res.end('Not found'); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...security,
    });
    res.end(body);
  } catch {
    res.writeHead(404, security);
    res.end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`\n  Levy is running at ${publicOrigin || `http://localhost:${port}`}\n  Statements are parsed in your browser; nothing is uploaded.\n  Bank connection: ${plaid ? `Plaid (${plaidCfg.env})` : 'demo only (add Plaid keys to .env to enable Plaid)'}\n`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  Port ${port} is already in use: Levy is probably already running at http://localhost:${port}\n`);
  else console.error(err);
  process.exit(1);
});
