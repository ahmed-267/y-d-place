
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Prefer the Vite /api/ai proxy so keys stay server-side in dev. */
const requestViaProxy = async (
  prompt: string,
  mode: 'json' | 'text',
  schema?: Record<string, unknown>,
  imageBase64?: string,
  signal?: AbortSignal
): Promise<string | null> => {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ prompt, schema, imageBase64, mode }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string | null };
    return data.content ?? null;
  } catch {
    return null;
  }
};

const getOpenRouterConfig = () => {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
  if (!apiKey) return null;

  const model =
    (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) ||
    "openai/gpt-4o-mini";
  const siteUrl = import.meta.env.VITE_OPENROUTER_SITE_URL as string | undefined;
  const appName = import.meta.env.VITE_OPENROUTER_APP_NAME as string | undefined;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;
  if (appName) headers["X-Title"] = appName;

  return { headers, model };
};

const requestOpenRouterJSON = async (
  prompt: string,
  schema: Record<string, unknown>,
  imageBase64?: string,
  signal?: AbortSignal
) => {
  const proxied = await requestViaProxy(prompt, 'json', schema, imageBase64, signal);
  if (proxied) {
    try {
      return JSON.parse(proxied);
    } catch {
      /* fall through */
    }
  }

  const config = getOpenRouterConfig();
  if (!config) {
    console.error("Missing OpenRouter API key. Set OPENROUTER_API_KEY (server) or VITE_OPENROUTER_API_KEY.");
    return null;
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: imageBase64 } });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: config.headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_response",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter request failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const contentText = data.choices?.[0]?.message?.content;
  if (!contentText) return null;
  return JSON.parse(contentText);
};

const requestOpenRouterText = async (
  prompt: string,
  imageBase64?: string,
  signal?: AbortSignal
) => {
  const proxied = await requestViaProxy(prompt, 'text', undefined, imageBase64, signal);
  if (proxied != null) return proxied;

  const config = getOpenRouterConfig();
  if (!config) {
    console.error("Missing OpenRouter API key. Set OPENROUTER_API_KEY (server) or VITE_OPENROUTER_API_KEY.");
    return null;
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (imageBase64) {
    content.push({ type: "image_url", image_url: { url: imageBase64 } });
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: config.headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter request failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || null;
};

const extractFirstJSONObject = (text: string): Record<string, unknown> | null => {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try {
          return JSON.parse(slice) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
};

const normalizeMenuResult = (raw: Record<string, unknown>): ScanMenuResult | null => {
  const productsRaw = Array.isArray(raw.products) ? raw.products : [];
  if (!productsRaw.length) return null;

  const languages = ["fr", "nl", "es", "it", "de", "ar", "pt", "tr", "pl", "ro", "zh", "ja"] as const;

  const normalized = productsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      const priceValue = obj.price;
      const price =
        typeof priceValue === "number"
          ? priceValue
          : typeof priceValue === "string"
            ? Number(priceValue.replace(/[^0-9.,-]/g, "").replace(",", "."))
            : NaN;

      if (!name || !Number.isFinite(price)) return null;

      const category = typeof obj.category === "string" && obj.category.trim() ? obj.category.trim() : "Other";
      const emoji = typeof obj.emoji === "string" && obj.emoji.trim() ? obj.emoji.trim() : "🍽️";

      const translationsObj = obj.translations && typeof obj.translations === "object" ? (obj.translations as Record<string, unknown>) : {};
      const translations = languages.reduce<Record<string, string>>((acc, lang) => {
        const value = translationsObj[lang];
        acc[lang] = typeof value === "string" && value.trim() ? value.trim() : name;
        return acc;
      }, {});

      const preparedStockNeeds = Array.isArray(obj.preparedStockNeeds)
        ? obj.preparedStockNeeds.filter((v) => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : [];

      const ingredientLinks = Array.isArray(obj.ingredientLinks)
        ? obj.ingredientLinks
            .map((link) => {
              if (!link || typeof link !== "object") return null;
              const linkObj = link as Record<string, unknown>;
              const ingredientName =
                typeof linkObj.ingredientName === "string" && linkObj.ingredientName.trim()
                  ? linkObj.ingredientName.trim()
                  : "";
              const quantityValue = linkObj.quantityUsed;
              const quantityUsed =
                typeof quantityValue === "number"
                  ? quantityValue
                  : typeof quantityValue === "string"
                    ? Number(quantityValue.replace(/[^0-9.,-]/g, "").replace(",", "."))
                    : NaN;
              const unit = typeof linkObj.unit === "string" && linkObj.unit.trim() ? linkObj.unit.trim() : "";
              if (!ingredientName || !Number.isFinite(quantityUsed) || !unit) return null;
              return { ingredientName, quantityUsed, unit };
            })
            .filter(Boolean)
        : [];

      return {
        name,
        price,
        category,
        emoji,
        translations,
        preparedStockNeeds,
        ingredientLinks: ingredientLinks as ScanMenuResult["products"][number]["ingredientLinks"],
      };
    })
    .filter(Boolean) as ScanMenuResult["products"];

  if (!normalized.length) return null;
  return { products: normalized };
};

export interface AIAssistanceResult {
  emoji: string;
  translations: Record<string, string>;
}

export const getAIAssistance = async (nameEN: string): Promise<AIAssistanceResult | null> => {
  if (!nameEN || nameEN.length < 3) return null;

  try {
    const schema = {
      type: "object",
      properties: {
        emoji: { type: "string" },
        translations: {
          type: "object",
          properties: {
            fr: { type: "string" },
            nl: { type: "string" },
            es: { type: "string" },
            it: { type: "string" },
            de: { type: "string" },
            ar: { type: "string" },
            pt: { type: "string" },
            tr: { type: "string" },
            pl: { type: "string" },
            ro: { type: "string" },
            zh: { type: "string" },
            ja: { type: "string" },
          },
          required: ["fr", "nl", "es", "it", "de", "ar", "pt", "tr", "pl", "ro", "zh", "ja"],
          additionalProperties: false,
        },
      },
      required: ["emoji", "translations"],
      additionalProperties: false,
    };

    const result = await requestOpenRouterJSON(
      `Suggest a single food emoji and translate the product name "${nameEN}" into French (fr), Dutch (nl), Spanish (es), Italian (it), German (de), Arabic (ar), Portuguese (pt), Turkish (tr), Polish (pl), Romanian (ro), Chinese (zh), and Japanese (ja). Return as JSON with an 'emoji' field and a 'translations' object where keys are the language codes.`,
      schema
    );

    if (result) return result as AIAssistanceResult;
  } catch (error) {
    console.error("AI Assistance error:", error);
  }

  return null;
};

export interface ScanMenuResult {
  products: {
    name: string;
    price: number;
    category: string;
    emoji: string;
    translations: Record<string, string>;
    preparedStockNeeds: string[];
    ingredientLinks: {
      ingredientName: string;
      quantityUsed: number;
      unit: string;
    }[];
  }[];
}

export const scanMenu = async (base64Image: string, signal?: AbortSignal): Promise<ScanMenuResult | null> => {
  // Lean schema: name/price/category/emoji only. Translations & stock links
  // used to force huge structured outputs and stall progress ~60% for a long time.
  const schema = {
    type: "object",
    properties: {
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            category: { type: "string" },
            emoji: { type: "string" },
          },
          required: ["name", "price", "category", "emoji"],
          additionalProperties: false,
        },
      },
    },
    required: ["products"],
    additionalProperties: false,
  };

  const primaryPrompt = [
    "You are extracting a restaurant/café menu from a photo.",
    "Return every clearly readable menu item with its price.",
    "Rules:",
    "- Do NOT invent items that are not visible.",
    "- Prices must be numbers only (no currency symbols).",
    "- Prefer the menu language for name if English is not printed; otherwise English.",
    "- category must be one of: Starters, Mains, Sides, Desserts, Drinks, Other.",
    "- emoji: a single relevant food/drink emoji.",
    "Return JSON with a top-level products array.",
  ].join("\n");

  try {
    const result = await requestOpenRouterJSON(primaryPrompt, schema, base64Image, signal);
    if (result) {
      const normalized = normalizeMenuResult(result as Record<string, unknown>);
      if (normalized) return normalized;
    }
  } catch (error) {
    if ((error as any).name === "AbortError") {
      console.log("Scan aborted by user");
      return null;
    }
    console.warn("Structured menu scan failed, attempting fallback.", error);
  }

  try {
    const fallbackPrompt =
      "Extract menu items from this image. Return ONLY JSON: {\"products\":[{\"name\":\"...\",\"price\":0,\"category\":\"Mains\",\"emoji\":\"🍽️\"}]}. Include every readable priced item; do not invent items.";
    const raw = await requestOpenRouterText(fallbackPrompt, base64Image, signal);
    if (!raw) return null;
    const parsed = extractFirstJSONObject(raw);
    if (!parsed) return null;
    return normalizeMenuResult(parsed);
  } catch (error) {
    if ((error as any).name === "AbortError") {
      console.log("Scan aborted by user");
    } else {
      console.error("Error scanning menu:", error);
    }
  }
  return null;
};

export const compressImage = (base64: string, maxWidth = 768, quality = 0.62): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
  });
};

export const refineBrandStory = async (
  rawNotes: string,
  restaurantName: string,
  cuisineType: string,
  colorTheme: string
): Promise<string | null> => {
  if (!rawNotes.trim()) return null;
  const prompt = [
    'Act as a professional copywriter.',
    `Restaurant name: ${restaurantName}`,
    `Cuisine type: ${cuisineType}`,
    `Color theme: ${colorTheme}`,
    `Turn these notes into a compelling 3-paragraph brand narrative: ${rawNotes}`,
    'Return ONLY the narrative body text.',
    'Do NOT include titles, headers, markdown, "About Us", or bold formatting.'
  ].join('\n');
  try {
    const response = await requestOpenRouterText(prompt);
    const cleaned = (response || '')
      .replace(/\*\*/g, '')
      .split('\n')
      .filter(line => {
        const trimmed = line.trim().toLowerCase();
        if (!trimmed) return false;
        if (trimmed.includes('about us')) return false;
        if (/^#{1,6}\s*/.test(trimmed)) return false;
        return true;
      })
      .join('\n')
      .trim();
    return cleaned || null;
  } catch (error) {
    console.error('Refine brand story error:', error);
    return null;
  }
};
