import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Wand2, Save, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { gradeAnswers } from "@/lib/ai.functions";
import { normalizeSections, toArabicDigits, totalMarks, type QuestionGrade } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/exams/$id/grade")({
  head: () => ({
    meta: [
      { title: "تصحيح الإجابات | منصة نجم للامتحانات" },
      { name: "description", content: "أدخل إجابات الطالب وصحّحها تلقائيًا بالذكاء الاصطناعي." },
      { property: "og:title", content: "تصحيح الإجابات | منصة نجم للامتحانات" },
      { property: "og:description", content: "تصحيح الأسئلة الموضوعية والمقالية مع تعليق لكل إجابة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GradePage,
});

const norm = (s: string) => s.replace(/[\u064B-\u0652\s]/g, "").trim();

function GradePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const grade = useServerFn(gradeAnswers);
  const { data: exam } = useQuery({
    queryKey: ["exam", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: results = [] } = useQuery({
    queryKey: ["results", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("results").select("*").eq("exam_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const sections = useMemo(() => normalizeSections(exam?.sections), [exam]);
  const total = totalMarks(sections);

  const [student, setStudent] = useState("");
  const [cls, setCls] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, QuestionGrade>>({});
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);

  const score = Object.values(grades).reduce((a, g) => a + (Number(g.score) || 0), 0);

  async function correct() {
    const g: Record<string, QuestionGrade> = {};
    const items: any[] = [];
    for (const s of sections)
      for (const q of s.questions) {
        const a = answers[q.id] ?? "";
        if (q.type === "mcq" || q.type === "tf") {
          const ok = a && norm(a) === norm(q.answer);
          g[q.id] = { score: ok ? q.marks : 0, feedback: ok ? "إجابة صحيحة" : `الإجابة الصحيحة: ${q.answer}` };
        } else if (!a.trim()) {
          g[q.id] = { score: 0, feedback: "لم يُجب الطالب" };
        } else {
          items.push({ id: q.id, type: q.type, text: q.text, passage: s.passage, modelAnswer: q.answer, marks: q.marks, studentAnswer: a });
        }
      }
    setBusy("ai");
    try {
      if (items.length) {
        const r = await grade({ data: { grade: exam!.grade, items } });
        Object.assign(g, r.grades);
      }
      setGrades(g);
      toast.success("تم التصحيح، راجع الدرجات ثم احفظ");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر التصحيح");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!student.trim()) return toast.error("اكتب اسم الطالب");
    if (!Object.keys(grades).length) return toast.error("صحّح الإجابات أولًا");
    setBusy("save");
    const { error } = await supabase.from("results").insert({
      exam_id: id, student_name: student.trim(), class_name: cls || null, answers, grading: grades as any, score,
    });
    setBusy(null);
    if (error) return toast.error("تعذر الحفظ");
    toast.success(`تم حفظ نتيجة ${student}`);
    setStudent(""); setAnswers({}); setGrades({});
    qc.invalidateQueries({ queryKey: ["results", id] });
    qc.invalidateQueries({ queryKey: ["exams"] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeResult(rid: string) {
    if (!confirm("حذف نتيجة الطالب؟")) return;
    await supabase.from("results").delete().eq("id", rid);
    qc.invalidateQueries({ queryKey: ["results", id] });
  }

  if (!exam) return <p className="text-muted-foreground">جارٍ التحميل...</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <Link to="/exams/$id" params={{ id }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-ink">
          <ArrowRight className="size-4" /> {exam.title}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">تصحيح إجابات طالب</h1>

        <div className="surface-card mt-5 grid gap-3 p-5 sm:grid-cols-2">
          <Input placeholder="اسم الطالب" value={student} onChange={(e) => setStudent(e.target.value)} />
          <Input placeholder="الفصل (مثال: ٢/٣)" value={cls} onChange={(e) => setCls(e.target.value)} />
        </div>

        {sections.map((s) => (
          <div key={s.id} className="surface-card mt-5 p-5">
            <h2 className="font-display font-bold text-ink">{s.title}</h2>
            {s.passage && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{s.passage}</p>}
            <div className="mt-4 space-y-4">
              {s.questions.map((q, i) => {
                const g = grades[q.id];
                return (
                  <div key={q.id} className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-sm leading-relaxed text-ink">
                      <b>{toArabicDigits(i + 1)}.</b> {q.text} <span className="text-muted-foreground">({toArabicDigits(q.marks)})</span>
                    </p>
                    {q.type === "mcq" || q.type === "tf" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {q.options?.map((o) => (
                          <button
                            key={o}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                            className={`rounded-lg border px-3 py-1.5 text-sm ${answers[q.id] === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Textarea className="mt-2" rows={q.type === "essay" ? 5 : 2} placeholder="إجابة الطالب" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                    )}
                    {g && (
                      <div className={`mt-3 flex items-start gap-3 rounded-lg p-3 text-sm ${g.score >= q.marks ? "bg-accent/60" : g.score > 0 ? "bg-secondary" : "bg-destructive/10"}`}>
                        <Input type="number" min={0} max={q.marks} step={0.5} className="h-8 w-16 shrink-0" value={g.score}
                          onChange={(e) => setGrades((gs) => ({ ...gs, [q.id]: { ...g, score: Math.min(q.marks, Number(e.target.value)) } }))} />
                        <p className="leading-relaxed text-ink">{g.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lift backdrop-blur">
          <Button onClick={correct} disabled={!!busy} className="bg-gradient-ink">
            {busy === "ai" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} صحّح بالذكاء الاصطناعي
          </Button>
          <Button variant="outline" onClick={save} disabled={!!busy}>
            <Save className="size-4" /> حفظ النتيجة
          </Button>
          {Object.keys(grades).length > 0 && (
            <span className="ms-auto font-display font-bold text-ink">{toArabicDigits(score)} / {toArabicDigits(total)}</span>
          )}
        </div>
      </div>

      <aside className="surface-card h-fit p-5 lg:sticky lg:top-24">
        <h3 className="font-display font-bold text-ink">الطلاب المصحَّحون ({toArabicDigits(results.length)})</h3>
        <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto text-sm">
          {results.map((r: any) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2">
              <span>{r.student_name}{r.class_name ? ` — ${r.class_name}` : ""}</span>
              <span className="flex items-center gap-2 font-semibold">
                {toArabicDigits(r.score)}
                <button onClick={() => removeResult(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
              </span>
            </li>
          ))}
          {!results.length && <li className="text-muted-foreground">لا توجد نتائج بعد.</li>}
        </ul>
        {results.length > 0 && (
          <Button asChild size="sm" variant="outline" className="mt-4 w-full">
            <Link to="/results" search={{ exam: id }}>تحليل النتائج</Link>
          </Button>
        )}
      </aside>
    </div>
  );
}
