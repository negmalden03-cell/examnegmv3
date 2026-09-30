// Server-only: streams an OpenAI Responses call through the Lovable AI Gateway and returns parsed JSON.
const MODEL = "openai/gpt-6-astra";

export type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

export async function callResponsesJSON(system: string, parts: ContentPart[]): Promise<any> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: system,
      input: [{ role: "user", content: parts }],
    }),
  });
  if (res.status === 429) throw new Error("تم تجاوز حد الطلبات، حاول بعد قليل");
  if (res.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي، يرجى إضافة رصيد");
  if (res.status === 403) throw new Error("خدمة الذكاء الاصطناعي غير متاحة لهذا الحساب حاليًا");
  if (!res.ok || !res.body) {
    console.error("AI error", res.status, await res.text().catch(() => ""));
    throw new Error("تعذر الاتصال بخدمة الذكاء الاصطناعي");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let failed = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          else if (ev.type === "response.failed" || ev.type === "error") failed = ev.error?.message ?? ev.response?.error?.message ?? "failed";
        } catch {
          /* ignore partial */
        }
      }
    }
  }
  if (failed && !text) {
    console.error("AI stream failed", failed);
    throw new Error("تعذر إكمال طلب الذكاء الاصطناعي");
  }
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("لم يُرجع الذكاء الاصطناعي ردًا صالحًا");
  return JSON.parse(cleaned.slice(s, e + 1));
}

export function fileToPart(mime: string, filename: string, base64: string): ContentPart {
  if (mime === "application/pdf") return { type: "input_file", filename, file_data: `data:application/pdf;base64,${base64}` };
  return { type: "input_image", image_url: `data:${mime};base64,${base64}` };
}
