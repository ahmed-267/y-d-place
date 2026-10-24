import { json, parseBody } from './_shared.mjs';
import { requireMember, enforceLimit, validateAi, validateStructured } from './_security.mjs';

async function authorize(event, body) {
  const { admin, user, business } = await requireMember(event, ['owner', 'manager'], {
    allowSetup: ['menu-scan', 'product-assistance', 'brand-story'].includes(body.operation),
  });
  await enforceLimit(admin, `ai:user:${user.id}`, 20, 60);
  await enforceLimit(admin, `ai:business:${business.id}`, 200, 86400);
}

// The production export always uses authenticated, database-limited access.
export const createAiHandler = (authorizeRequest = authorize) => async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json(503, { error: 'OPENROUTER_API_KEY not configured on server' });

  try {
    const body = parseBody(event);
    await authorizeRequest(event, body);
    validateAi(body);
    const model = process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    const content = [{ type: 'text', text: body.prompt }];
    if (body.imageBase64) {
      content.push({ type: 'image_url', image_url: { url: body.imageBase64 } });
    }

    const payload = {
      model,
      max_tokens: body.operation === 'receipt-scan' ? 512 : 4096,
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
      signal: AbortSignal.timeout(45000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VITE_OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.VITE_OPENROUTER_APP_NAME || 'PreVisio',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    if (!upstream.ok) console.error('AI provider rejected request', { operation: body.operation, status: upstream.status });
    if (!upstream.ok) {
      if (upstream.status === 402) return json(402, {
        code: 'AI_CREDIT_LIMIT',
        error: 'The scanning account has reached its available AI credit limit. Wait for any other scans to finish and retry. If this continues, the account owner needs to add OpenRouter credits or increase the API key credit limit.',
      });
      return json(upstream.status === 429 ? 429 : 502, { error: upstream.status === 429
        ? 'The scanning service is busy. Please try again shortly.'
        : 'The scanning provider could not complete the request. Please try again.' });
    }

    const data = JSON.parse(text);
    const responseContent = data.choices?.[0]?.message?.content ?? null;
    if (body.mode === 'json' && body.schema && !validateStructured(JSON.parse(responseContent), body.schema)) return json(502, { error: 'The scan returned invalid data. Please try again.' });
    return json(200, { content: responseContent });
  } catch (err) {
    return json(err.status || (err instanceof SyntaxError ? 400 : 502), { error: err.status ? err.message : 'AI request failed. Please try again.' });
  }
};

export const handler = createAiHandler();
