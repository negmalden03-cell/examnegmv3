// Server-only: calls Google Gemini directly with the teacher's own API key and returns parsed JSON.
const MODEL = "gemini-3-flash-preview";

export type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

function toGeminiPart(p: ContentPart): GeminiPart {
  if (p.type === "input_text") return { text: p.text };
  const url = p.type === "input_image" ? p.image_url : p.file_data;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (!m) throw new Error("صيغة الملف غير مدعومة");
  return { inline_data: { mime_type: m[1]!, data: m[2]! } };
}

function parseJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("لم يُرجع الذكاء الاصطناعي ردًا صالحًا");
  return JSON.parse(cleaned.slice(s, e + 1));
}

// نماذج بديلة لكل منها حد طلبات مستقل في Google — نجرّبها بالترتيب عند تجاوز الحد
const MODELS = [MODEL, "gemini-3.8-flash", "gemini-3.5-flash-lite"];

export async function callResponsesJSON(system: string, parts: ContentPart[]): Promise<any> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("مفتاح الذكاء الاصطناعي غير مهيأ");
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: parts.map(toGeminiPart) }],
    generationConfig: { responseMimeType: "application/json" },
  });
  let res: Response | null = null;
  let hit429 = false;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (res.status !== 429 && res.status < 500 && res.status !== 404) break;
      console.error("Gemini retry", model, res.status, (await res.clone().text().catch(() => "")).slice(0, 300));
      if (res.status === 429) hit429 = true;
      if (res.status === 404) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
    }
    if (res && (res.ok || (res.status !== 429 && res.status < 500 && res.status !== 404))) break;
  }
  if (!res) throw new Error("تعذر الاتصال بخدمة الذكاء الاصطناعي");
  if (res.status === 429 || (hit429 && !res.ok))
    throw new Error("انتهى الحد المجاني اليومي لمفتاح Gemini. انتظر حتى الغد أو فعّل الفوترة في Google AI Studio");
  if (res.status === 400 || res.status === 403) {
    console.error("Gemini error", res.status, await res.text().catch(() => ""));
    throw new Error("مفتاح الذكاء الاصطناعي غير صالح أو الخدمة غير مفعّلة له");
  }
  if (!res.ok) {
    console.error("Gemini error", res.status, await res.text().catch(() => ""));
    throw new Error("تعذر الاتصال بخدمة الذكاء الاصطناعي");
  }
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p?.text ?? "")
    .join("");
  if (!text) throw new Error("لم يُرجع الذكاء الاصطناعي ردًا");
  return parseJson(text);
}

export function fileToPart(mime: string, filename: string, base64: string): ContentPart {
  if (mime === "application/pdf") return { type: "input_file", filename, file_data: `data:application/pdf;base64,${base64}` };
  return { type: "input_image", image_url: `data:${mime};base64,${base64}` };
}
