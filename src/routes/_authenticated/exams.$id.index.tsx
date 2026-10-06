import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Share2, Copy, Loader2, Plus, Printer, Save, Trash2, Wand2, ClipboardCheck, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateQuestions } from "@/lib/ai.functions";
import { ExamChat } from "@/components/ExamChat";
import {
  BRANCHES,
  TYPE_LABELS,
  normalizeQuestion,
  normalizeSections,
  toArabicDigits,
  totalMarks,
  uid,
  type Question,
  type QuestionType,
  type Section,
} from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/exams/$id/")({
  head: () => ({
    meta: [
      { title: "تحرير الامتحان | منصة نجم للامتحانات" },
      { name: "description", content: "راجع أسئلة الامتحان وعدّلها واطبع الورقة ونموذج الإجابة." },
      { property: "og:title", content: "تحرير الامتحان | منصة نجم للامتحانات" },
      { property: "og:description", content: "مراجعة وتعديل وطباعة امتحان اللغة العربية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamPage,
});

function PublishButton({ id, code, accepting, onChange }: { id: string; code: string | null; accepting: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = code && typeof window !== "undefined" ? `${window.location.origin}/take/${code}` : "";
  async function publish(on: boolean) {
    setBusy(true);
    try {
      let c = code;
      for (let i = 0; !c && i < 5; i++) {
        const cand = `NJM-${Math.floor(1000 + Math.random() * 9000)}`;
        const { error } = await supabase.from("exams").update({ share_code: cand, accepting_responses: on }).eq("id", id);
        if (!error) c = cand;
      }
      if (!c) throw new Error();
      if (code) {
        const { error } = await supabase.from("exams").update({ accepting_responses: on }).eq("id", id);
        if (error) throw error;
      }
      toast.success(on ? "الامتحان متاح للطلاب الآن" : "تم إيقاف استقبال الإجابات");
      onChange();
    } catch {
      toast.error("تعذر تحديث النشر");
    } finally {
      setBusy(false);
    }
  }
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("تم النسخ"); };
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        <Share2 className="size-4" /> نشر للطلاب{accepting ? " ●" : ""}
      </Button>
      {open && (
        <div className="absolute end-0 z-20 mt-2 w-80 rounded-xl border border-border bg-card p-4 shadow-lift">
          {code && accepting ? (
            <>
              <p className="text-sm text-muted-foreground">كود الامتحان</p>
              <button onClick={() => copy(code)} className="mt-1 flex w-full items-center justify-between rounded-lg bg-secondary px-3 py-2 font-mono text-lg font-bold text-ink" dir="ltr">
                {code} <Copy className="size-4" />
              </button>
              <p className="mt-3 text-sm text-muted-foreground">رابط الطالب</p>
              <button onClick={() => copy(link)} className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-ink" dir="ltr">
                <span className="truncate">{link}</span> <Copy className="size-4 shrink-0" />
              </button>
              <p className="mt-3 text-xs text-muted-foreground">الإجابات تُصحح تلقائيًا وتظهر في «تصحيح الطلاب» و«النتائج». احفظ تعديلاتك قبل النشر.</p>
              <Button variant="outline" className="mt-3 w-full" disabled={busy} onClick={() => publish(false)}>إيقاف استقبال الإجابات</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink">انشر الامتحان ليجيب عليه الطلاب إلكترونيًا بكود أو رابط بدون حساب.</p>
              <Button className="mt-3 w-full" disabled={busy} onClick={() => publish(true)}>
                {busy && <Loader2 className="size-4 animate-spin" />} {code ? "إعادة فتح الاستقبال" : "إنشاء كود ورابط"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const ordinals = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];

function ExamPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: exam, isLoading } = useQuery({
    queryKey: ["exam", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(120);
  const [sections, setSections] = useState<Section[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showAnswers, setShowAnswers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (exam) {
      setTitle(exam.title);
      setDuration(exam.duration_minutes);
      setSections(normalizeSections(exam.sections));
      setDirty(false);
    }
  }, [exam]);

  const update = (fn: (s: Section[]) => Section[]) => {
    setSections(fn);
    setDirty(true);
  };
  const updSec = (sid: string, patch: Partial<Section>) => update((ss) => ss.map((s) => (s.id === sid ? { ...s, ...patch } : s)));
  const updQ = (sid: string, qid: string, patch: Partial<Question>) =>
    update((ss) => ss.map((s) => (s.id === sid ? { ...s, questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) } : s)));

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("exams")
      .update({ title, duration_minutes: duration, sections: sections as any, total_marks: totalMarks(sections), updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error("تعذر الحفظ"); return; }
    setDirty(false);
    toast.success("تم حفظ الامتحان");
    qc.invalidateQueries({ queryKey: ["exams"] });
    qc.invalidateQueries({ queryKey: ["exam", id] });
  }

  if (isLoading || !exam) return <p className="text-muted-foreground">جارٍ التحميل...</p>;
  const total = totalMarks(sections);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex rounded-lg border border-border bg-card p-1">
          <button onClick={() => setMode("edit")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Pencil className="size-4" /> تحرير
          </button>
          <button onClick={() => setMode("preview")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Eye className="size-4" /> ورقة الامتحان
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "preview" && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <Switch checked={showAnswers} onCheckedChange={setShowAnswers} /> نموذج الإجابة
            </label>
          )}
          {mode === "preview" && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> طباعة
            </Button>
          )}
          <PublishButton id={id} code={exam.share_code} accepting={exam.accepting_responses} onChange={() => qc.invalidateQueries({ queryKey: ["exam", id] })} />
          <Button variant="outline" asChild>
            <Link to="/exams/$id/grade" params={{ id }}>
              <ClipboardCheck className="size-4" /> تصحيح الطلاب
            </Link>
          </Button>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} حفظ
          </Button>
        </div>
      </div>

      {mode === "preview" ? (
        <ExamPaper title={title} grade={exam.grade} term={exam.term ?? ""} duration={duration} total={total} sections={sections} showAnswers={showAnswers} />
      ) : (
        <div className="mt-6 space-y-6">
          <div className="surface-card grid gap-4 p-5 sm:grid-cols-[1fr_auto_auto]">
            <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="font-display font-bold" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              الزمن <Input type="number" className="w-20" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setDirty(true); }} /> دقيقة
            </div>
            <div className="flex items-center rounded-lg bg-accent px-4 text-sm font-semibold text-ink">
              المجموع: {toArabicDigits(total)} درجة
            </div>
          </div>

          <ExamChat grade={exam.grade} title={title} sections={sections} onApply={(t, s) => { setTitle(t); setSections(s); setDirty(true); }} />


          {sections.map((s, si) => (
            <SectionEditor
              key={s.id}
              section={s}
              index={si}
              grade={exam.grade}
              onChange={(p) => updSec(s.id, p)}
              onQ={(qid, p) => updQ(s.id, qid, p)}
              onRemove={() => update((ss) => ss.filter((x) => x.id !== s.id))}
            />
          ))}

          <Button
            variant="outline"
            onClick={() => update((ss) => [...ss, { id: uid(), branch: BRANCHES[0]!, title: `السؤال ${ordinals[ss.length] ?? ss.length + 1}`, questions: [] }])}
          >
            <Plus className="size-4" /> إضافة قسم
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionEditor({
  section: s,
  index,
  grade,
  onChange,
  onQ,
  onRemove,
}: {
  section: Section;
  index: number;
  grade: string;
  onChange: (p: Partial<Section>) => void;
  onQ: (qid: string, p: Partial<Question>) => void;
  onRemove: () => void;
}) {
  const gen = useServerFn(generateQuestions);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiType, setAiType] = useState<QuestionType>("mcq");
  const [aiCount, setAiCount] = useState(3);
  const [aiTopic, setAiTopic] = useState("");
  const [busy, setBusy] = useState(false);

  async function runAI() {
    setBusy(true);
    try {
      const r = await gen({ data: { grade, branch: s.branch, type: aiType, count: aiCount, topic: aiTopic || s.passage } });
      onChange({ questions: [...s.questions, ...r.questions.map(normalizeQuestion)] });
      setAiOpen(false);
      toast.success(`تمت إضافة ${toArabicDigits(r.questions.length)} أسئلة`);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر توليد الأسئلة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-ink text-sm font-bold text-primary-foreground">{toArabicDigits(index + 1)}</span>
        <Input value={s.title} onChange={(e) => onChange({ title: e.target.value })} className="max-w-sm font-semibold" />
        <select value={s.branch} onChange={(e) => onChange({ branch: e.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          {[...new Set([...BRANCHES, s.branch])].map((b) => <option key={b}>{b}</option>)}
        </select>
        <button onClick={onRemove} className="ms-auto text-muted-foreground hover:text-destructive" title="حذف القسم">
          <Trash2 className="size-4" />
        </button>
      </div>
      <Textarea
        className="mt-4"
        rows={s.passage ? 4 : 2}
        placeholder="القطعة أو الأبيات (اختياري)"
        value={s.passage ?? ""}
        onChange={(e) => onChange({ passage: e.target.value || undefined })}
      />

      <div className="mt-4 space-y-3">
        {s.questions.map((q, qi) => (
          <div key={q.id} className="rounded-xl border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-ink">{toArabicDigits(qi + 1)}.</span>
              <select
                value={q.type}
                onChange={(e) => onQ(q.id, normalizeQuestion({ ...q, type: e.target.value, options: e.target.value === "mcq" ? q.options?.length ? q.options : ["", "", "", ""] : undefined }))}
                className="h-8 rounded-md border border-input bg-background px-2"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="ms-auto flex items-center gap-1 text-muted-foreground">
                الدرجة
                <Input type="number" min={0} step={0.5} className="h-8 w-16" value={q.marks} onChange={(e) => onQ(q.id, { marks: Number(e.target.value) })} />
              </span>
              <button onClick={() => onChange({ questions: s.questions.filter((x) => x.id !== q.id) })} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
            <Textarea className="mt-2" rows={2} value={q.text} onChange={(e) => onQ(q.id, { text: e.target.value })} placeholder="نص السؤال" />
            {q.type === "mcq" && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(q.options ?? []).map((o, oi) => (
                  <Input
                    key={oi}
                    value={o}
                    placeholder={`البديل ${toArabicDigits(oi + 1)}`}
                    onChange={(e) => onQ(q.id, { options: (q.options ?? []).map((x, i) => (i === oi ? e.target.value : x)) })}
                  />
                ))}
              </div>
            )}
            <div className="mt-2">
              {q.type === "mcq" || q.type === "tf" ? (
                <select value={q.answer} onChange={(e) => onQ(q.id, { answer: e.target.value })} className="h-9 w-full rounded-md border border-brass/50 bg-accent/40 px-3 text-sm">
                  <option value="">— الإجابة الصحيحة —</option>
                  {(q.options ?? []).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <Textarea rows={2} className="border-brass/50 bg-accent/40" value={q.answer} onChange={(e) => onQ(q.id, { answer: e.target.value })} placeholder="الإجابة النموذجية ومعايير التصحيح" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onChange({ questions: [...s.questions, normalizeQuestion({ type: "short", marks: 1 })] })}>
          <Plus className="size-4" /> سؤال يدوي
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAiOpen((v) => !v)}>
          <Wand2 className="size-4" /> أسئلة بالذكاء الاصطناعي
        </Button>
      </div>
      {aiOpen && (
        <div className="mt-3 grid gap-3 rounded-xl border border-brass/40 bg-accent/30 p-4 sm:grid-cols-[auto_auto_1fr_auto] sm:items-center">
          <select value={aiType} onChange={(e) => setAiType(e.target.value as QuestionType)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input type="number" min={1} max={15} className="w-20" value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} />
          <Input placeholder="الدرس أو الموضوع (اختياري)" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
          <Button onClick={runAI} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} ولّد
          </Button>
        </div>
      )}
    </div>
  );
}

function ExamPaper({
  title, grade, term, duration, total, sections, showAnswers,
}: { title: string; grade: string; term: string; duration: number; total: number; sections: Section[]; showAnswers: boolean }) {
  return (
    <article className="mx-auto mt-6 max-w-3xl bg-card p-8 shadow-soft print:mt-0 print:shadow-none sm:p-12">
      <header className="border-b-2 border-ink pb-4 text-center">
        <p className="text-sm text-muted-foreground">{grade} — {term}</p>
        <h1 className="mt-2 font-display text-xl font-bold text-ink">{title}</h1>
        <div className="mt-3 flex justify-center gap-8 text-sm text-ink">
          <span>الزمن: {toArabicDigits(duration)} دقيقة</span>
          <span>الدرجة الكلية: {toArabicDigits(total)}</span>
        </div>
        {showAnswers && <p className="mt-2 font-bold text-primary">نموذج الإجابة</p>}
        {!showAnswers && <p className="mt-4 text-start text-sm">اسم الطالب: ............................................ الفصل: ..............</p>}
      </header>
      {sections.map((s) => {
        const sm = s.questions.reduce((a, q) => a + q.marks, 0);
        return (
          <section key={s.id} className="mt-6 break-inside-avoid-page">
            <h2 className="flex justify-between font-display font-bold text-ink">
              <span>{s.title}</span>
              <span className="text-sm">({toArabicDigits(sm)} درجة)</span>
            </h2>
            {s.passage && s.branch === "الاستماع" && !showAnswers && <p className="mt-3 text-sm text-muted-foreground">(يستمع الطالب إلى النص ثم يجيب)</p>}
            {s.passage && (s.branch !== "الاستماع" || showAnswers) && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-secondary/50 p-4 leading-loose">{s.passage}</p>}
            <ol className="mt-3 space-y-4">
              {s.questions.map((q, i) => (
                <li key={q.id} className="leading-loose">
                  <span className="font-semibold">{toArabicDigits(i + 1)}- </span>
                  {q.text}
                  {q.type === "tf" && <span> (    )</span>}
                  {q.type === "mcq" && (
                    <div className="mt-1 grid grid-cols-2 gap-x-6 ps-5 text-sm">
                      {q.options?.map((o, oi) => (
                        <span key={oi} className={showAnswers && o === q.answer ? "font-bold text-primary" : ""}>
                          {"أبجد"[oi] ?? "-"}) {o}
                        </span>
                      ))}
                    </div>
                  )}
                  {showAnswers ? (
                    q.type !== "mcq" && <p className="mt-1 rounded bg-accent/50 px-3 py-1 text-sm text-primary">الإجابة: {q.answer}</p>
                  ) : (
                    (q.type === "short" || q.type === "essay") && (
                      <div className="mt-2 space-y-5 ps-5" aria-hidden>
                        {Array.from({ length: q.type === "essay" ? 6 : 2 }).map((_, k) => <div key={k} className="border-b border-dotted border-muted-foreground/50" />)}
                      </div>
                    )
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      <p className="mt-10 text-center text-sm text-muted-foreground">انتهت الأسئلة — مع تمنياتنا بالتوفيق</p>
    </article>
  );
}
