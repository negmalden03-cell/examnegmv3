import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Wand2, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateExam } from "@/lib/ai.functions";
import { BRANCHES, GRADES, TERMS, normalizeSections, totalMarks } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/exams/new")({
  head: () => ({
    meta: [
      { title: "امتحان جديد | منصة نجم للامتحانات" },
      { name: "description", content: "أنشئ امتحان لغة عربية كاملًا بالذكاء الاصطناعي." },
      { property: "og:title", content: "امتحان جديد | منصة نجم للامتحانات" },
      { property: "og:description", content: "حدّد الصف والفروع والدرجات وولّد امتحانًا كاملًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewExam,
});

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function NewExam() {
  const navigate = useNavigate();
  const gen = useServerFn(generateExam);
  const [grade, setGrade] = useState(GRADES[0]);
  const [term, setTerm] = useState(TERMS[0]);
  const [branches, setBranches] = useState<string[]>(["القراءة", "النصوص", "النحو", "التعبير"]);
  const [difficulty, setDifficulty] = useState("متوسط");
  const [marks, setMarks] = useState(40);
  const [duration, setDuration] = useState(120);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"ai" | "blank" | null>(null);

  const toggle = (b: string) => setBranches((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));

  async function save(title: string, sections: unknown) {
    const secs = normalizeSections(sections);
    const { data, error } = await supabase
      .from("exams")
      .insert({ title, grade, term, duration_minutes: duration, sections: secs as any, total_marks: totalMarks(secs) })
      .select("id")
      .single();
    if (error) throw error;
    navigate({ to: "/exams/$id", params: { id: data.id } });
  }

  async function runAI() {
    if (!branches.length) return toast.error("اختر فرعًا واحدًا على الأقل");
    setBusy("ai");
    try {
      const r = await gen({ data: { grade, term, branches, difficulty, totalMarks: marks, duration, notes } });
      await save(r.title, r.sections);
      toast.success("تم توليد الامتحان، راجعه وعدّل ما تريد");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر توليد الامتحان");
    } finally {
      setBusy(null);
    }
  }

  async function blank() {
    setBusy("blank");
    try {
      await save(`امتحان اللغة العربية — ${grade}`, branches.map((b, i) => ({ branch: b, title: `السؤال ${i + 1} (${b})`, questions: [] })));
    } catch {
      toast.error("تعذر إنشاء الامتحان");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-ink">امتحان جديد</h1>
      <p className="mt-1 text-sm text-muted-foreground">حدّد المواصفات، ثم ولّد ورقة الامتحان ونموذج الإجابة بالذكاء الاصطناعي.</p>

      <div className="surface-card mt-6 space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>الصف</Label>
            <select className={selectCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>الفصل الدراسي</Label>
            <select className={selectCls} value={term} onChange={(e) => setTerm(e.target.value)}>
              {TERMS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>الفروع</Label>
          <div className="flex flex-wrap gap-2">
            {BRANCHES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => toggle(b)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  branches.includes(b) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-ink hover:bg-secondary"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>مستوى الصعوبة</Label>
            <select className={selectCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {["سهل", "متوسط", "متدرج (سهل ← صعب)", "صعب للمتفوقين"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>الدرجة الكلية</Label>
            <Input type="number" min={5} max={200} value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>الزمن (دقيقة)</Label>
            <Input type="number" min={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>الدروس المقررة أو نص تريد البناء عليه (اختياري)</Label>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: درس الفعل المبني للمجهول، نص «بلادي»، موضوع تعبير عن حب الوطن..." />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={runAI} disabled={!!busy} className="bg-gradient-ink">
            {busy === "ai" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {busy === "ai" ? "جارٍ التوليد... قد يستغرق دقيقة" : "ولّد الامتحان بالذكاء الاصطناعي"}
          </Button>
          <Button variant="outline" onClick={blank} disabled={!!busy}>
            <FilePlus2 className="size-4" /> ابدأ امتحانًا فارغًا
          </Button>
        </div>
      </div>
    </div>
  );
}
