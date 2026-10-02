import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codeSchema = z.string().trim().toUpperCase().regex(/^NJM-\d{4}$/);

const norm = (s: string) => s.replace(/[\u064B-\u0652\s]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

async function loadExam(code: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("exams")
    .select("id,user_id,title,grade,term,duration_minutes,total_marks,sections,accepting_responses")
    .eq("share_code", code)
    .maybeSingle();
  if (!data) throw new Error("كود الامتحان غير صحيح");
  if (!data.accepting_responses) throw new Error("هذا الامتحان مغلق حاليًا ولا يستقبل إجابات");
  return { exam: data, admin: supabaseAdmin };
}

export const getPublicExam = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: codeSchema }).parse(d))
  .handler(async ({ data }) => {
    const { exam } = await loadExam(data.code);
    const sections = (Array.isArray(exam.sections) ? exam.sections : []).map((s: any) => ({
      id: String(s.id),
      branch: String(s.branch ?? ""),
      title: String(s.title ?? ""),
      passage: s.passage ? String(s.passage) : null,
      questions: (Array.isArray(s.questions) ? s.questions : []).map((q: any) => ({
        id: String(q.id),
        type: String(q.type),
        text: String(q.text ?? ""),
        options: Array.isArray(q.options) ? q.options.map(String) : q.type === "tf" ? ["صواب", "خطأ"] : null,
        marks: Number(q.marks) || 0,
      })),
    }));
    return { title: exam.title, grade: exam.grade, term: exam.term, duration: exam.duration_minutes, total: exam.total_marks, sections };
  });

export const submitStudentAnswers = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        code: codeSchema,
        name: z.string().trim().min(2).max(80),
        className: z.string().trim().max(40).optional(),
        answers: z.record(z.string().max(40), z.string().max(5000)),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { exam, admin } = await loadExam(data.code);
    const sections: any[] = Array.isArray(exam.sections) ? exam.sections : [];
    const grading: Record<string, { score: number; feedback: string }> = {};
    const items: any[] = [];
    for (const s of sections)
      for (const q of s.questions ?? []) {
        const a = data.answers[q.id] ?? "";
        const marks = Number(q.marks) || 0;
        if (q.type === "mcq" || q.type === "tf") {
          const ok = !!a && norm(a) === norm(String(q.answer ?? ""));
          grading[q.id] = { score: ok ? marks : 0, feedback: ok ? "إجابة صحيحة" : `الإجابة الصحيحة: ${q.answer}` };
        } else if (!a.trim()) {
          grading[q.id] = { score: 0, feedback: "لم يُجب الطالب" };
        } else {
          items.push({ id: q.id, type: q.type, text: String(q.text ?? ""), passage: s.passage || undefined, modelAnswer: String(q.answer ?? ""), marks, studentAnswer: a });
        }
      }
    if (items.length) {
      try {
        const { aiGradeItems } = await import("./ai.functions");
        const r = await aiGradeItems(exam.grade, items.slice(0, 60));
        Object.assign(grading, r.grades);
      } catch (e) {
        console.error("AI grading failed", e);
        for (const it of items) grading[it.id] ??= { score: 0, feedback: "بانتظار تصحيح المعلم" };
      }
    }
    const score = Object.values(grading).reduce((a, g) => a + (Number(g.score) || 0), 0);
    const { error } = await admin.from("results").insert({
      user_id: exam.user_id,
      exam_id: exam.id,
      student_name: data.name,
      class_name: data.className || null,
      answers: data.answers,
      grading: grading as any,
      score,
      submitted_by: "student",
    });
    if (error) throw new Error("تعذر حفظ الإجابات، حاول مرة أخرى");
    return { ok: true };
  });
