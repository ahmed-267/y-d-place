/** Production handlers plus loopback-only local demo scanning. */
import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const routes: Record<string, string> = {
  '/api/ai': 'ai', '/api/invite-staff': 'invite-staff',
  '/api/public-order': 'public-order', '/api/public-menu': 'public-menu',
  '/api/billing/checkout': 'billing-checkout', '/api/billing/portal': 'billing-portal',
  '/api/stripe-webhook': 'stripe-webhook',
};
async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 6_000_000) throw new Error('Request too large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function apiProxyPlugin(): Plugin {
  return {
    name: 'previsio-api-proxy',
    configureServer(server) {
      let demoWindowStart = Date.now();
      let demoRequests = 0;

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const route = routes[url.pathname];
        if (!route) return next();
        try {
          const module = await import(/* @vite-ignore */ pathToFileURL(resolve(process.cwd(), 'netlify/functions', `${route}.mjs`)).href);
          let handler = module.handler;
          if (route === 'ai' && req.headers['x-previsio-local-demo'] === 'true') {
            const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '');
            const origin = req.headers.origin;
            const sameOrigin = origin === `http://${req.headers.host}`;
            if (!loopback || !sameOrigin) {
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Local demo scanning is available only from this computer.' }));
              return;
            }
            handler = module.createAiHandler(async () => {
              if (Date.now() - demoWindowStart >= 60000) { demoWindowStart = Date.now(); demoRequests = 0; }
              if (++demoRequests > 20) throw Object.assign(new Error('Please wait a minute before scanning again.'), { status: 429 });
            });
          }
          const result = await handler({
            httpMethod: req.method, headers: req.headers,
            queryStringParameters: Object.fromEntries(url.searchParams),
            body: await readBody(req), isBase64Encoded: false,
          });
          res.writeHead(result.statusCode, result.headers);
          res.end(result.body);
        } catch (error) {
          res.writeHead(error instanceof Error && error.message === 'Request too large' ? 413 : 500,
            { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request could not be processed' }));
        }
      });
    },
  };
}
export const aiProxyPlugin = apiProxyPlugin;
