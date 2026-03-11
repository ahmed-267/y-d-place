
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface AIAssistanceResult {
  emoji: string;
  translations: Record<string, string>;
}

export const getAIAssistance = async (nameEN: string): Promise<AIAssistanceResult | null> => {
  if (!nameEN || nameEN.length < 3) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest a single food emoji and translate the product name "${nameEN}" into French (fr), Dutch (nl), Spanish (es), Italian (it), German (de), Arabic (ar), Portuguese (pt), Turkish (tr), Polish (pl), Romanian (ro), Chinese (zh), and Japanese (ja). Return as JSON with an 'emoji' field and a 'translations' object where keys are the language codes.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emoji: { type: Type.STRING, description: "A single relevant food emoji" },
            translations: {
              type: Type.OBJECT,
              properties: {
                fr: { type: Type.STRING },
                nl: { type: Type.STRING },
                es: { type: Type.STRING },
                it: { type: Type.STRING },
                de: { type: Type.STRING },
                ar: { type: Type.STRING },
                pt: { type: Type.STRING },
                tr: { type: Type.STRING },
                pl: { type: Type.STRING },
                ro: { type: Type.STRING },
                zh: { type: Type.STRING },
                ja: { type: Type.STRING },
              },
              required: ["fr", "nl", "es", "it", "de", "ar", "pt", "tr", "pl", "ro", "zh", "ja"],
            },
          },
          required: ["emoji", "translations"],
        },
      },
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as AIAssistanceResult;
    }
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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: "Extract products from this menu image. For each item, provide: name (in English), price (as a number), category, a relevant emoji, translations (fr, nl, es, it, de, ar, pt, tr, pl, ro, zh, ja), typical ingredients (name, quantity, unit), and any prepped stock items needed. Return the results as a JSON object with a 'products' array." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  emoji: { type: Type.STRING },
                  translations: {
                    type: Type.OBJECT,
                    properties: {
                      fr: { type: Type.STRING },
                      nl: { type: Type.STRING },
                      es: { type: Type.STRING },
                      it: { type: Type.STRING },
                      de: { type: Type.STRING },
                      ar: { type: Type.STRING },
                      pt: { type: Type.STRING },
                      tr: { type: Type.STRING },
                      pl: { type: Type.STRING },
                      ro: { type: Type.STRING },
                      zh: { type: Type.STRING },
                      ja: { type: Type.STRING }
                    }
                  },
                  preparedStockNeeds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  ingredientLinks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        ingredientName: { type: Type.STRING },
                        quantityUsed: { type: Type.NUMBER },
                        unit: { type: Type.STRING }
                      },
                      required: ["ingredientName", "quantityUsed", "unit"]
                    }
                  }
                },
                required: ["name", "price", "category", "emoji", "translations", "preparedStockNeeds", "ingredientLinks"]
              }
            }
          },
          required: ["products"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as ScanMenuResult;
    }
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
