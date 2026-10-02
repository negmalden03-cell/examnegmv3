import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Loader2, Wand2, FilePlus2, FileText, Image as ImageIcon, BookOpen, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeSpec, generateExam } from "@/lib/ai.functions";
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

const isWord = (mime: string, name: string) => mime.includes("word") || /\.docx?$/i.test(name);

const fileToBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });

type SpecResult = { summary: string; spec: string; totalMarks: number | null; duration: number | null; branches: string[] };

function NewExam() {
  const navigate = useNavigate();
  const gen = useServerFn(generateExam);
  const analyze = useServerFn(analyzeSpec);
  const [tab, setTab] = useState<"manual" | "spec">("manual");
  const [grade, setGrade] = useState(GRADES[0]!);
  const [term, setTerm] = useState(TERMS[0]!);
  const [branches, setBranches] = useState<string[]>(["القراءة", "النصوص", "النحو", "التعبير"]);
  const [difficulty, setDifficulty] = useState("متوسط");
  const [marks, setMarks] = useState(40);
  const [duration, setDuration] = useState(120);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"ai" | "blank" | "spec" | null>(null);

  // مواصفات الامتحان
  const specFileRef = useRef<HTMLInputElement>(null);
  const [specText, setSpecText] = useState("");
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [specResult, setSpecResult] = useState<SpecResult | null>(null);

  // المصادر
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const { data: sources = [] } = useQuery({
    queryKey: ["sources", grade],
    queryFn: async () => {
      const { data } = await supabase.from("sources").select("id,title,kind,status").eq("grade", grade).eq("status", "ready");
      return data ?? [];
    },
  });

  const toggle = (b: string) => setBranches((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));
  const toggleSource = (id: string) => setSourceIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function save(title: string, sections: unknown) {
    const secs = normalizeSections(sections);
    const { data, error } = await supabase
      .from("exams")
      .insert({ title, grade, term, duration_minutes: duration, sections: secs as any, total_marks: totalMarks(secs), spec_text: specResult?.spec ?? null, source_ids: sourceIds })
      .select("id")
      .single();
    if (error) throw error;
    navigate({ to: "/exams/$id", params: { id: data.id } });
  }

  async function runAI() {
    if (tab === "manual" && !branches.length) { toast.error("اختر فرعًا واحدًا على الأقل"); return; }
    if (tab === "spec" && !specResult) { toast.error("حلّل مواصفات الامتحان أولًا"); return; }
    setBusy("ai");
    try {
      const r = await gen({
        data: {
          grade, term,
          branches,
          difficulty, totalMarks: specResult?.totalMarks ?? marks, duration: specResult?.duration ?? duration,
          notes, spec: specResult?.spec || undefined,
          sourceIds: sourceIds.length ? sourceIds : undefined,
        },
      });
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

  async function runAnalyzeSpec() {
    if (!specText.trim() && !specFile) { toast.error("اكتب المواصفات أو ارفع ملفًا"); return; }
    setBusy("spec");
    try {
      let file: { mime: string; name: string; base64: string } | undefined;
      let text = specText.trim() || undefined;
      if (specFile) {
        if (specFile.size > 10 * 1024 * 1024) { toast.error("الحد الأقصى ١٠ ميجابايت"); setBusy(null); return; }
        if (isWord(specFile.type, specFile.name)) {
          const mammoth = await import("mammoth");
          const { value } = await mammoth.extractRawText({ arrayBuffer: await specFile.arrayBuffer() });
          text = [text, value].filter(Boolean).join("\n\n").slice(0, 8000);
        } else {
          file = { mime: specFile.type || "application/pdf", name: specFile.name, base64: await fileToBase64(specFile) };
        }
      }
      const r = await analyze({ data: { text, file, grade } });
      setSpecResult(r);
      if (r.totalMarks) setMarks(r.totalMarks);
      if (r.duration) setDuration(r.duration);
      if (r.branches.length) setBranches(r.branches);
      toast.success("تم تحليل المواصفات، راجع الملخص ثم ولّد الامتحان");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر تحليل المواصفات");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-ink">امتحان جديد</h1>
      <p className="mt-1 text-sm text-muted-foreground">الامتحان الناتج يصلح للطباعة الورقية وللإجابة الإلكترونية برابط أو كود للطالب. حدّد المواصفات يدويًا أو ارفع ورقة المواصفات، ثم ولّد الامتحان ونموذج الإجابة بالذكاء الاصطناعي.</p>

      <div className="mt-6 flex gap-2 rounded-xl border border-border bg-card p-1">
        <button
          onClick={() => setTab("manual")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${tab === "manual" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary"}`}
        >
          <FilePlus2 className="size-4" /> مواصفات يدوية
        </button>
        <button
          onClick={() => setTab("spec")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${tab === "spec" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary"}`}
        >
          <ClipboardList className="size-4" /> مواصفات الامتحان
        </button>
      </div>

      <div className="surface-card mt-4 space-y-6 p-6">
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

        {tab === "spec" && (
          <div className="space-y-4 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="space-y-1.5">
              <Label>اكتب مواصفات الورقة الامتحانية</Label>
              <Textarea rows={4} value={specText} onChange={(e) => setSpecText(e.target.value)} placeholder="مثال: السؤال الأول: قطعة قراءة عليها ٥ أسئلة اختيارية (١٠ درجات)، السؤال الثاني: النصوص..." />
            </div>
            <div className="space-y-1.5">
              <Label>أو ارفع ورقة المواصفات / نموذج امتحان (PDF أو Word أو صورة)</Label>
              <input
                ref={specFileRef}
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="hidden"
                onChange={(e) => { setSpecFile(e.target.files?.[0] ?? null); setSpecResult(null); }}
              />
              <button
                type="button"
                onClick={() => specFileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground hover:border-primary hover:text-ink"
              >
                {specFile ? <><FileText className="size-4" /> {specFile.name}</> : <><ImageIcon className="size-4" /> اضغط لاختيار الملف</>}
              </button>
            </div>
            <Button onClick={runAnalyzeSpec} disabled={!!busy} variant="outline">
              {busy === "spec" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {busy === "spec" ? "جارٍ التحليل..." : "حلّل المواصفات بالذكاء الاصطناعي"}
            </Button>
            {specResult && (
              <div className="rounded-lg border border-primary/30 bg-accent/50 p-4 text-sm">
                <p className="font-semibold text-ink">ملخص الهيكل:</p>
                <p className="mt-1 leading-relaxed text-ink">{specResult.summary}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {specResult.totalMarks && <span>الدرجة الكلية: {specResult.totalMarks}</span>}
                  {specResult.duration && <span>الزمن: {specResult.duration} دقيقة</span>}
                  {specResult.branches.length > 0 && <span>الفروع: {specResult.branches.join("، ")}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>الفروع{tab === "spec" ? " (تُضبط تلقائيًا من المواصفات)" : ""}</Label>
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
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: درس الفعل المبني للمجهول، نص «بلادي»، موضوع تعبير عن حب الوطن..." />
        </div>

        {sources.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><BookOpen className="size-4" /> مصادر من مكتبتك يعتمد عليها التوليد (اختياري)</Label>
            <div className="flex flex-wrap gap-2">
              {sources.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSource(s.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    sourceIds.includes(s.id) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-ink hover:bg-secondary"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        )}

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
