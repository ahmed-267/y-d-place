
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  const config = getOpenRouterConfig();
  if (!config) {
    console.error("Missing OpenRouter API key. Set VITE_OPENROUTER_API_KEY.");
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
  try {
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
              preparedStockNeeds: {
                type: "array",
                items: { type: "string" },
              },
              ingredientLinks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    ingredientName: { type: "string" },
                    quantityUsed: { type: "number" },
                    unit: { type: "string" },
                  },
                  required: ["ingredientName", "quantityUsed", "unit"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name", "price", "category", "emoji", "translations", "preparedStockNeeds", "ingredientLinks"],
            additionalProperties: false,
          },
        },
      },
      required: ["products"],
      additionalProperties: false,
    };

    const result = await requestOpenRouterJSON(
      "Extract products from this menu image. For each item, provide: name (in English), price (as a number), category, a relevant emoji, translations (fr, nl, es, it, de, ar, pt, tr, pl, ro, zh, ja), typical ingredients (name, quantity, unit), and any prepped stock items needed. Return the results as a JSON object with a 'products' array.",
      schema,
      base64Image,
      signal
    );

    if (result) return result as ScanMenuResult;
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      console.log("Scan aborted by user");
    } else {
      console.error("Error scanning menu:", error);
    }
  }
  return null;
};

export const compressImage = (base64: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
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
