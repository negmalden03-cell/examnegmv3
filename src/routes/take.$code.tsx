import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, Send, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { getPublicExam, submitStudentAnswers } from "@/lib/public-exam.functions";
import { toArabicDigits } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/take/$code")({
  head: () => ({
    meta: [
      { title: "الإجابة على الامتحان | منصة نجم للامتحانات" },
      { name: "description", content: "أجب على امتحان اللغة العربية إلكترونيًا وأرسل إجاباتك لمعلمك." },
      { property: "og:title", content: "الإجابة على الامتحان | منصة نجم للامتحانات" },
      { property: "og:description", content: "امتحان لغة عربية إلكتروني من معلمك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TakeExam,
});

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { toast.error("المتصفح لا يدعم الاستماع"); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-EG";
  u.rate = 0.85;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("ar"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

function TakeExam() {
  const { code } = Route.useParams();
  const fetchExam = useServerFn(getPublicExam);
  const submit = useServerFn(submitStudentAnswers);
  const { data: exam, isLoading, error } = useQuery({
    queryKey: ["public-exam", code],
    queryFn: () => fetchExam({ data: { code } }),
    retry: false,
  });
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (id: string, v: string) => setAnswers((p) => ({ ...p, [id]: v }));

  async function send() {
    if (name.trim().length < 2) { toast.error("اكتب اسمك أولًا"); return; }
    if (!confirm("هل تريد إرسال إجاباتك؟ لا يمكن التعديل بعد الإرسال.")) return;
    setBusy(true);
    try {
      await submit({ data: { code, name: name.trim(), className: cls.trim() || undefined, answers } });
      setDone(true);
      window.scrollTo(0, 0);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الإرسال");
    } finally {
      setBusy(false);
    }
  }

  const wrap = (c: React.ReactNode) => <div className="min-h-screen bg-background px-4 py-10">{c}</div>;

  if (isLoading) return wrap(<p className="text-center text-muted-foreground">جارٍ تحميل الامتحان...</p>);
  if (error || !exam)
    return wrap(
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <p className="font-display font-bold text-ink">{(error as any)?.message ?? "تعذر فتح الامتحان"}</p>
        <Link to="/take" className="mt-4 inline-block text-sm text-primary underline">جرّب كودًا آخر</Link>
      </div>,
    );
  if (done)
    return wrap(
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 font-display text-xl font-bold text-ink">تم إرسال إجاباتك بنجاح</h1>
        <p className="mt-2 text-sm text-muted-foreground">وصلت إجاباتك لمعلمك، وسيعلن لك النتيجة. بالتوفيق يا {name}!</p>
      </div>,
    );

  return wrap(
    <div className="mx-auto max-w-3xl">
      <header className="surface-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{exam.grade} — {exam.term}</p>
        <h1 className="mt-1 font-display text-xl font-bold text-ink">{exam.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          الزمن: {toArabicDigits(exam.duration)} دقيقة · الدرجة الكلية: {toArabicDigits(exam.total)}
        </p>
        <div className="mt-5 grid gap-3 text-start sm:grid-cols-2">
          <div className="space-y-1.5"><Label>اسم الطالب</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
          <div className="space-y-1.5"><Label>الفصل (اختياري)</Label><Input value={cls} onChange={(e) => setCls(e.target.value)} maxLength={40} /></div>
        </div>
      </header>

      {exam.sections.map((s) => {
        const listening = s.branch === "الاستماع";
        return (
          <section key={s.id} className="surface-card mt-5 p-6">
            <h2 className="font-display text-lg font-bold text-ink">{s.title}</h2>
            {s.passage && listening && (
              <Button variant="outline" className="mt-3" onClick={() => speak(s.passage!)}>
                <Volume2 className="size-4" /> استمع إلى النص
              </Button>
            )}
            {s.passage && !listening && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-secondary/50 p-4 leading-loose text-ink">{s.passage}</p>
            )}
            <ol className="mt-4 space-y-5">
              {s.questions.map((q: any, i: number) => (
                <li key={q.id}>
                  <p className="leading-relaxed text-ink">
                    {toArabicDigits(i + 1)}. {q.text} <span className="text-xs text-muted-foreground">({toArabicDigits(q.marks)} درجة)</span>
                  </p>
                  {q.options ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {q.options.map((o: string) => (
                        <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${answers[q.id] === o ? "border-primary bg-accent" : "border-border bg-card"}`}>
                          <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => set(q.id, o)} />
                          {o}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Textarea className="mt-2" rows={q.type === "essay" ? 6 : 2} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} maxLength={5000} />
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <Button onClick={send} disabled={busy} className="mt-6 w-full bg-gradient-ink" size="lg">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {busy ? "جارٍ الإرسال والتصحيح..." : "إرسال الإجابات"}
      </Button>
    </div>,
  );
}
