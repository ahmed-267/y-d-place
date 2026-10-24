import { supabase } from '../components/supabaseClient';

export class AIRequestError extends Error {}

/** Prefer the Vite / Netlify /api/ai proxy so keys stay server-side. */
const requestViaProxy = async (
  prompt: string,
  mode: 'json' | 'text',
  schema?: Record<string, unknown>,
  imageBase64?: string,
  signal?: AbortSignal,
  operation = 'product-assistance'
): Promise<string | null> => {
  try {
    const demo = Boolean(localStorage.getItem('previsio_demo_session'));
    const { data } = await supabase.auth.getSession();
    const localDemo = demo && import.meta.env.DEV;
    if (!localDemo && !data.session) throw new AIRequestError('Sign in to your business account to scan your own menu.');
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(localDemo ? { 'X-Previsio-Local-Demo': 'true' } : { Authorization: `Bearer ${data.session!.access_token}` }) },
      signal,
      body: JSON.stringify({ operation, prompt, schema, imageBase64, mode }),
    });
    if (!res.ok) {
      const failure = await res.json().catch(() => ({}));
      throw new AIRequestError(typeof failure.error === 'string' ? failure.error : 'The scanning service could not complete the request. Please try again.');
    }
    const response = (await res.json()) as { content?: string | null };
    return response.content ?? null;
  } catch (err) {
    if (err instanceof AIRequestError || (err as Error).name === 'AbortError') throw err;
    throw new AIRequestError('Could not connect to the scanning service. Check your connection and try again.');
  }
};

const requestOpenRouterJSON = async (
  prompt: string,
  schema: Record<string, unknown>,
  imageBase64?: string,
  signal?: AbortSignal,
  operation = 'product-assistance'
) => {
  const proxied = await requestViaProxy(prompt, 'json', schema, imageBase64, signal, operation);
  if (!proxied) return null;
  try {
    return JSON.parse(proxied);
  } catch {
    return null;
  }
};

const requestOpenRouterText = async (
  prompt: string,
  imageBase64?: string,
  signal?: AbortSignal,
  operation = 'brand-story'
) => {
  return requestViaProxy(prompt, 'text', undefined, imageBase64, signal, operation);
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

      if (!name || !Number.isFinite(price) || price < 0) return null;

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
              if (!ingredientName || !Number.isFinite(quantityUsed) || quantityUsed <= 0 || !unit) return null;
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
    "Read the entire image, including every column and section, from top to bottom. Return EVERY clearly readable priced menu item, not a sample or summary.",
    "Before finishing, check every section for omitted items. Include separately priced sizes or variants as separate items with descriptive names.",
    "Rules:",
    "- Do NOT invent items that are not visible.",
    "- Prices must be numbers only (no currency symbols).",
    "- Prefer the menu language for name if English is not printed; otherwise English.",
    "- category must be one of: Starters, Mains, Sides, Desserts, Drinks, Other.",
    "- emoji: a single relevant food/drink emoji.",
    "Return JSON with a top-level products array.",
  ].join("\n");

  try {
    const result = await requestOpenRouterJSON(primaryPrompt, schema, base64Image, signal, 'menu-scan');
    if (result) {
      const normalized = normalizeMenuResult(result as Record<string, unknown>);
      if (normalized) return normalized;
    }
  } catch (error) {
    if (error instanceof AIRequestError || (error as Error).name === "AbortError") throw error;
    console.warn("Structured menu scan failed, attempting fallback.", error);
  }

  try {
    const fallbackPrompt =
      "Extract menu items from this image. Return ONLY JSON: {\"products\":[{\"name\":\"...\",\"price\":0,\"category\":\"Mains\",\"emoji\":\"🍽️\"}]}. Include every readable priced item; do not invent items.";
    const raw = await requestOpenRouterText(fallbackPrompt, base64Image, signal, 'menu-scan');
    if (!raw) return null;
    const parsed = extractFirstJSONObject(raw);
    if (!parsed) return null;
    return normalizeMenuResult(parsed);
  } catch (error) {
    if (error instanceof AIRequestError || (error as Error).name === "AbortError") {
      throw error;
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

export type ReceiptExtraction = {
  name: string;
  amount: number;
  date: string;
  category: string;
};

export const extractReceiptExpense = async (
  imageBase64: string,
  signal?: AbortSignal
): Promise<ReceiptExtraction | null> => {
  const prompt =
    'Extract expense details from this receipt. Return JSON with fields: name (store/vendor name), amount (number), date (YYYY-MM-DD), and category (one of: Utilities, Rent, Supplies, Staff, Transport, Marketing, Insurance, Equipment, Other).';
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      amount: { type: 'number' },
      date: { type: 'string' },
      category: { type: 'string' },
    },
    required: ['name', 'amount', 'date', 'category'],
    additionalProperties: false,
  };
  const result = await requestOpenRouterJSON(prompt, schema, imageBase64, signal, 'receipt-scan');
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name.trim() || typeof r.amount !== 'number' || !Number.isFinite(r.amount) || r.amount < 0 || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date))) return null;
  return {
    name: String(r.name || ''),
    amount: Number(r.amount || 0),
    date: String(r.date || ''),
    category: String(r.category || 'Other'),
  };
};
