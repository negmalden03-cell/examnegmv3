import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { BookOpen, FileText, Image as ImageIcon, Loader2, Trash2, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readImagesText } from "@/lib/ai.functions";
import { readFileText, safeStorageName } from "@/lib/source-reader";
import { GRADES, TERMS } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({
    meta: [
      { title: "المصادر | منصة نجم للامتحانات" },
      { name: "description", content: "مكتبة الكتب والامتحانات السابقة التي يعتمد عليها الذكاء الاصطناعي في بناء الامتحانات." },
      { property: "og:title", content: "المصادر | منصة نجم للامتحانات" },
      { property: "og:description", content: "ارفع الكتب والامتحانات السابقة لتوليد امتحانات أدق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SourcesPage,
});

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const KINDS = [
  { v: "book", label: "كتاب مدرسي" },
  { v: "exam", label: "امتحان سابق" },
  { v: "other", label: "أخرى" },
];
const kindLabel = (k: string) => KINDS.find((x) => x.v === k)?.label ?? k;

function SourcesPage() {
  const qc = useQueryClient();
  const readImages = useServerFn(readImagesText);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState(GRADES[0]!);
  const [term, setTerm] = useState(TERMS[0]!);
  const [kind, setKind] = useState("book");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sources").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload() {
    if (!file) { toast.error("اختر ملفًا أولًا"); return; }
    if (file.size > 200 * 1024 * 1024) { toast.error("الحد الأقصى ٢٠٠ ميجابايت"); return; }
    setBusy(true);
    let rowId: string | null = null;
    try {
      setProgress("جارٍ رفع الملف وحفظه...");
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/${safeStorageName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("sources").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error("تعذر رفع الملف: " + upErr.message);
      const { data: row, error: insErr } = await supabase
        .from("sources")
        .insert({
          title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
          grade, term, kind,
          file_path: path, file_name: file.name, mime: file.type || "application/octet-stream",
          status: "pending",
        })
        .select("id")
        .single();
      if (insErr) throw new Error("تعذر حفظ المصدر: " + insErr.message);
      rowId = row.id;
      qc.invalidateQueries({ queryKey: ["sources"] });
      const text = await readFileText(
        file,
        async (images) => (await readImages({ data: { images } })).text,
        setProgress,
      );
      await supabase.from("sources").update({ extracted_text: text.slice(0, 300000), status: text.trim() ? "ready" : "failed" }).eq("id", row.id);
      toast.success(text.trim() ? "تم حفظ المصدر وقراءته، وأصبح جاهزًا للذكاء الاصطناعي" : "تم حفظ الملف لكن تعذرت قراءة نصه");
      setOpen(false); setFile(null); setTitle("");
    } catch (e: any) {
      if (rowId) await supabase.from("sources").update({ status: "failed" }).eq("id", rowId);
      toast.error(e?.message ?? "تعذر رفع الملف");
    } finally {
      setBusy(false); setProgress("");
      qc.invalidateQueries({ queryKey: ["sources"] });
    }
  }

  async function remove(id: string, path: string) {
    if (!confirm("حذف هذا المصدر نهائيًا؟")) return;
    await supabase.storage.from("sources").remove([path]);
    const { error } = await supabase.from("sources").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["sources"] });
  }

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("sources").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  }

  const grouped = GRADES.map((g) => ({ grade: g, items: sources.filter((s: any) => s.grade === g) })).filter((x) => x.items.length);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">المصادر</h1>
          <p className="mt-1 text-sm text-muted-foreground">ارفع الكتب والامتحانات السابقة (PDF أو Word أو صورة) ليعتمد عليها الذكاء الاصطناعي في بناء الامتحانات.</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>
          <Upload className="size-4" /> إضافة مصدر جديد
        </Button>
      </div>

      {open && (
        <div className="surface-card mt-6 space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>عنوان المصدر</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: كتاب العربي — الصف الأول" />
            </div>
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>الصف</Label>
              <select className={selectCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
                {GRADES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>الفصل الدراسي</Label>
              <select className={selectCls} value={term} onChange={(e) => setTerm(e.target.value)}>
                {TERMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>الملف (PDF أو Word أو صورة — حتى ٢٠٠ ميجابايت)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-4 py-8 text-sm text-muted-foreground hover:border-primary hover:text-ink"
            >
              {file ? <><FileText className="size-4" /> {file.name}</> : <><ImageIcon className="size-4" /> اضغط لاختيار الملف</>}
            </button>
          </div>
          <Button onClick={upload} disabled={busy} className="bg-gradient-ink">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? progress || "جارٍ الرفع..." : "رفع المصدر وحفظه"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="mt-10 text-muted-foreground">جارٍ التحميل...</p>
      ) : sources.length === 0 ? (
        <div className="surface-card mt-8 p-10 text-center">
          <BookOpen className="mx-auto size-10 text-brass" />
          <h2 className="mt-4 font-display text-lg font-bold text-ink">لا توجد مصادر بعد</h2>
          <p className="mt-2 text-sm text-muted-foreground">ارفع كتابًا أو امتحانًا سابقًا ليستفيد منه الذكاء الاصطناعي عند توليد الامتحانات.</p>
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.grade} className="mt-8">
            <h2 className="font-display text-lg font-bold text-ink">{g.grade}</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((s: any) => (
                <div key={s.id} className="surface-card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-ink">{kindLabel(s.kind)}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openFile(s.file_path)} className="text-muted-foreground hover:text-ink" title="فتح الملف">
                        <ExternalLink className="size-4" />
                      </button>
                      <button onClick={() => remove(s.id, s.file_path)} className="text-muted-foreground hover:text-destructive" title="حذف">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="mt-3 font-display font-bold leading-relaxed text-ink">{s.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{s.term}</p>
                  <p className="mt-3 text-xs">
                    {s.status === "ready" ? (
                      <span className="text-primary">✓ جاهز للاستخدام</span>
                    ) : s.status === "failed" ? (
                      <span className="text-destructive">تعذرت قراءة الملف</span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" /> جارٍ قراءة الملف...</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
