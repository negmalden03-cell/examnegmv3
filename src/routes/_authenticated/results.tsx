import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeResults } from "@/lib/ai.functions";
import { normalizeSections, toArabicDigits, totalMarks, type QuestionGrade } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/results")({
  validateSearch: z.object({ exam: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "النتائج والتحليل | منصة نجم للامتحانات" },
      { name: "description", content: "نتائج الطلاب ونسب الإتقان لكل فرع مع تحليل ذكي وخطة علاجية." },
      { property: "og:title", content: "النتائج والتحليل | منصة نجم للامتحانات" },
      { property: "og:description", content: "تحليل نتائج طلاب اللغة العربية بالذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

type Analysis = { summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[]; attention: string[] };

function ResultsPage() {
  const { exam: examId } = Route.useSearch();
  const navigate = useNavigate({ from: "/results" });
  const analyze = useServerFn(analyzeResults);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: exams = [] } = useQuery({
    queryKey: ["exams-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const exam = exams.find((e) => e.id === examId) ?? exams[0];
  const { data: results = [] } = useQuery({
    queryKey: ["results", exam?.id],
    enabled: !!exam,
    queryFn: async () => {
      const { data, error } = await supabase.from("results").select("*").eq("exam_id", exam!.id).order("score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    if (!exam) return null;
    const sections = normalizeSections(exam.sections);
    const total = totalMarks(sections);
    const byBranch = new Map<string, { got: number; max: number }>();
    for (const r of results) {
      const g = (r.grading ?? {}) as Record<string, QuestionGrade>;
      for (const s of sections)
        for (const q of s.questions) {
          const b = byBranch.get(s.branch) ?? { got: 0, max: 0 };
          b.got += Number(g[q.id]?.score) || 0;
          b.max += q.marks;
          byBranch.set(s.branch, b);
        }
    }
    const branchStats = [...byBranch].map(([branch, v]) => ({ branch, percent: v.max ? Math.round((v.got / v.max) * 100) : 0 }));
    const scores = results.map((r) => Number(r.score));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const passed = scores.filter((s) => s >= total / 2).length;
    return { total, branchStats, avg, passed, max: Math.max(0, ...scores), min: scores.length ? Math.min(...scores) : 0 };
  }, [exam, results]);

  async function runAnalysis() {
    if (!exam || !stats) return;
    setBusy(true);
    try {
      const r = await analyze({
        data: {
          examTitle: exam.title, grade: exam.grade, totalMarks: stats.total, branchStats: stats.branchStats,
          students: results.map((x) => ({ name: x.student_name, score: Number(x.score) })),
        },
      });
      setAnalysis(r);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر التحليل");
    } finally {
      setBusy(false);
    }
  }

  if (!exams.length) return <div className="surface-card p-10 text-center text-muted-foreground">أنشئ امتحانًا وصحّح إجابات الطلاب أولًا لعرض النتائج.</div>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">النتائج والتحليل</h1>
          <p className="mt-1 text-sm text-muted-foreground">مستوى الطلاب ونسب الإتقان لكل فرع من فروع اللغة.</p>
        </div>
        <select
          value={exam?.id}
          onChange={(e) => { setAnalysis(null); navigate({ search: { exam: e.target.value } }); }}
          className="h-10 max-w-xs rounded-md border border-input bg-card px-3 text-sm"
        >
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {stats && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["عدد الطلاب", results.length],
              ["المتوسط", `${stats.avg.toFixed(1)} / ${stats.total}`],
              ["نسبة النجاح", results.length ? `${Math.round((stats.passed / results.length) * 100)}٪` : "—"],
              ["أعلى / أقل", `${stats.max} / ${stats.min}`],
            ].map(([k, v]) => (
              <div key={k as string} className="surface-card p-5">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-1 font-display text-xl font-bold text-ink">{toArabicDigits(v as string)}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="surface-card p-5">
              <h2 className="font-display font-bold text-ink">الإتقان حسب الفرع</h2>
              <div className="mt-4 space-y-3">
                {stats.branchStats.map((b) => (
                  <div key={b.branch}>
                    <div className="flex justify-between text-sm"><span>{b.branch}</span><span className="font-semibold">{toArabicDigits(b.percent)}٪</span></div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${b.percent >= 75 ? "bg-primary" : b.percent >= 50 ? "bg-brass" : "bg-destructive"}`} style={{ width: `${b.percent}%` }} />
                    </div>
                  </div>
                ))}
                {!results.length && <p className="text-sm text-muted-foreground">لا توجد نتائج لهذا الامتحان بعد.</p>}
              </div>
            </div>
            <div className="surface-card p-5">
              <h2 className="font-display font-bold text-ink">ترتيب الطلاب</h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 text-muted-foreground">{toArabicDigits(i + 1)}</td>
                      <td className="py-2">{r.student_name}</td>
                      <td className="py-2 text-muted-foreground">{r.class_name}</td>
                      <td className={`py-2 text-end font-semibold ${Number(r.score) < stats.total / 2 ? "text-destructive" : "text-ink"}`}>{toArabicDigits(Number(r.score))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-card mt-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display font-bold text-ink">التحليل الذكي والخطة العلاجية</h2>
              <Button onClick={runAnalysis} disabled={busy || !results.length} className="bg-gradient-ink">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} حلّل النتائج
              </Button>
            </div>
            {analysis && (
              <div className="mt-5 space-y-5 leading-loose">
                <p className="text-ink">{analysis.summary}</p>
                {([["نقاط القوة", analysis.strengths], ["نقاط الضعف", analysis.weaknesses], ["التوصيات والتدريبات العلاجية", analysis.recommendations], ["طلاب يحتاجون متابعة", analysis.attention]] as const).map(
                  ([h, list]) => list.length > 0 && (
                    <div key={h}>
                      <h3 className="font-display text-sm font-bold text-primary">{h}</h3>
                      <ul className="mt-1 list-disc space-y-1 ps-6 text-sm text-ink">{list.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
