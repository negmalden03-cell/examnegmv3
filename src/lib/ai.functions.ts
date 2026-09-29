import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `أنت خبير في مناهج اللغة العربية للمرحلة الإعدادية في مصر (وزارة التربية والتعليم) وفي بناء الامتحانات وفق مواصفات الورقة الامتحانية الرسمية.
اكتب بالعربية الفصحى السليمة مع ضبط الكلمات المهمة بالشكل عند الحاجة. التزم بمستوى الصف المطلوب.
أعد دائمًا JSON صالحًا فقط دون أي نص إضافي أو علامات markdown.`;

async function callAI(prompt: string): Promise<any> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("خدمة الذكاء الاصطناعي غير مهيأة");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("تم تجاوز حد الطلبات، حاول بعد قليل");
  if (res.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي، يرجى إضافة رصيد");
  if (!res.ok) throw new Error("تعذر الاتصال بخدمة الذكاء الاصطناعي");
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const QUESTION_SHAPE = `كل سؤال: {"type": "mcq"|"tf"|"short"|"essay", "text": "نص السؤال", "options": ["..."] (للاختيار فقط، ٤ بدائل), "answer": "الإجابة النموذجية أو البديل الصحيح نصًا (للصواب والخطأ: صواب أو خطأ)", "marks": رقم}`;

export const generateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        grade: z.string(),
        term: z.string(),
        branches: z.array(z.string()).min(1),
        difficulty: z.string(),
        totalMarks: z.number().min(5).max(200),
        duration: z.number(),
        notes: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const out = await callAI(`أنشئ امتحانًا كاملًا في اللغة العربية.
الصف: ${data.grade} — ${data.term}
الفروع المطلوبة: ${data.branches.join("، ")}
مستوى الصعوبة: ${data.difficulty}
الدرجة الكلية: ${data.totalMarks} (يجب أن يساوي مجموع درجات الأسئلة هذه الدرجة تمامًا)
زمن الامتحان: ${data.duration} دقيقة
${data.notes ? `ملاحظات المعلم / الدروس المقررة:\n${data.notes}` : ""}
اجعل لكل فرع قسمًا مستقلًا. لأقسام القراءة والنصوص ضع قطعة أو أبياتًا في passage وأسئلة عليها. نوّع أنواع الأسئلة وتدرّج في المستويات المعرفية.
أعد: {"title": "عنوان الامتحان", "sections": [{"branch": "اسم الفرع", "title": "عنوان السؤال مثل: السؤال الأول (القراءة)", "passage": "اختياري", "questions": [...]}]}
${QUESTION_SHAPE}`);
    return { title: String(out.title ?? `امتحان اللغة العربية — ${data.grade}`), sections: out.sections ?? [] };
  });

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        grade: z.string(),
        branch: z.string(),
        type: z.enum(["mcq", "tf", "short", "essay"]),
        count: z.number().min(1).max(15),
        topic: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const out = await callAI(`ولّد ${data.count} من الأسئلة من نوع "${data.type}" في فرع ${data.branch} لطلاب ${data.grade}.
${data.topic ? `الموضوع / النص:\n${data.topic}` : ""}
أعد: {"questions": [...]}
${QUESTION_SHAPE}`);
    return { questions: out.questions ?? [] };
  });

export const gradeAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        grade: z.string(),
        items: z
          .array(
            z.object({
              id: z.string(),
              type: z.string(),
              text: z.string(),
              passage: z.string().optional(),
              modelAnswer: z.string(),
              marks: z.number(),
              studentAnswer: z.string(),
            }),
          )
          .max(60),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.items.length) return { grades: {} as Record<string, { score: number; feedback: string }> };
    const out = await callAI(`صحّح إجابات طالب في ${data.grade}. قيّم كل إجابة مقارنة بالإجابة النموذجية بعدل، وامنح درجات جزئية عند الصواب الجزئي، وراعِ سلامة اللغة والإملاء في التعبير.
الأسئلة:
${JSON.stringify(data.items)}
أعد: {"grades": {"<id>": {"score": رقم لا يتجاوز marks, "feedback": "تعليق قصير يوضح سبب الدرجة وكيف يتحسن الطالب"}}}`);
    const grades: Record<string, { score: number; feedback: string }> = {};
    for (const it of data.items) {
      const g = out.grades?.[it.id];
      const score = Math.max(0, Math.min(it.marks, Number(g?.score) || 0));
      grades[it.id] = { score, feedback: String(g?.feedback ?? "") };
    }
    return { grades };
  });

export const analyzeResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        examTitle: z.string(),
        grade: z.string(),
        totalMarks: z.number(),
        branchStats: z.array(z.object({ branch: z.string(), percent: z.number() })),
        students: z.array(z.object({ name: z.string(), score: z.number() })).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const out = await callAI(`حلّل نتائج امتحان "${data.examTitle}" لطلاب ${data.grade} (الدرجة الكلية ${data.totalMarks}).
نسب الإتقان لكل فرع: ${JSON.stringify(data.branchStats)}
درجات الطلاب: ${JSON.stringify(data.students)}
أعد: {"summary": "فقرة تلخص المستوى العام", "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["تدريبات وأنشطة علاجية محددة"], "attention": ["أسماء الطلاب الذين يحتاجون متابعة مع السبب"]}`);
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    return {
      summary: String(out.summary ?? ""),
      strengths: arr(out.strengths),
      weaknesses: arr(out.weaknesses),
      recommendations: arr(out.recommendations),
      attention: arr(out.attention),
    };
  });
