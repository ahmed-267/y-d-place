/**
 * Vite middleware: proxy AI requests so the OpenRouter key stays server-side.
 * Client calls POST /api/ai with { prompt, schema?, imageBase64?, mode: 'json' | 'text' }.
 */
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

export function aiProxyPlugin(): Plugin {
  return {
    name: 'previsio-ai-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/ai') || req.method !== 'POST') {
          next();
          return;
        }

        const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
        if (!apiKey) {
          sendJson(res, 503, { error: 'OPENROUTER_API_KEY not configured on server' });
          return;
        }

        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            prompt: string;
            schema?: Record<string, unknown>;
            imageBase64?: string;
            mode?: 'json' | 'text';
            model?: string;
          };

          const model = body.model || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
          const content: Array<Record<string, unknown>> = [{ type: 'text', text: body.prompt }];
          if (body.imageBase64) {
            content.push({ type: 'image_url', image_url: { url: body.imageBase64 } });
          }

          const payload: Record<string, unknown> = {
            model,
            messages: [{ role: 'user', content }],
          };

          if (body.mode !== 'text' && body.schema) {
            payload.response_format = {
              type: 'json_schema',
              json_schema: {
                name: 'structured_response',
                strict: true,
                schema: body.schema,
              },
            };
          }

          const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.VITE_OPENROUTER_SITE_URL || 'http://localhost:3000',
              'X-Title': process.env.VITE_OPENROUTER_APP_NAME || 'PreVisio',
            },
            body: JSON.stringify(payload),
          });

          const text = await upstream.text();
          if (!upstream.ok) {
            sendJson(res, upstream.status, { error: text });
            return;
          }

          const data = JSON.parse(text) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const contentText = data.choices?.[0]?.message?.content ?? null;
          sendJson(res, 200, { content: contentText });
        } catch (err) {
          sendJson(res, 500, { error: err instanceof Error ? err.message : 'AI proxy failed' });
        }
      });
    },
  };
}
