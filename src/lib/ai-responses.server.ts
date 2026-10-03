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

export async function callResponsesJSON(system: string, parts: ContentPart[]): Promise<any> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("مفتاح الذكاء الاصطناعي غير مهيأ");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: parts.map(toGeminiPart) }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      }),
    },
  );
  if (res.status === 429) throw new Error("تم تجاوز حد الطلبات، حاول بعد قليل");
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
