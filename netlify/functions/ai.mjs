import { json, parseBody } from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return json(503, { error: 'OPENROUTER_API_KEY not configured on server' });

  try {
    const body = parseBody(event);
    const model = body.model || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    const content = [{ type: 'text', text: body.prompt }];
    if (body.imageBase64) {
      content.push({ type: 'image_url', image_url: { url: body.imageBase64 } });
    }

    const payload = {
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
    if (!upstream.ok) return json(upstream.status, { error: text });

    const data = JSON.parse(text);
    return json(200, { content: data.choices?.[0]?.message?.content ?? null });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'AI failed' });
  }
};
