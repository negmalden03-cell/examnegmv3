import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { BookOpen, FileText, Image as ImageIcon, Loader2, Trash2, Upload, ExternalLink, Pencil, Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractLessons, readImagesText } from "@/lib/ai.functions";
import { PART_SIZE, readFilePages, safeStorageName } from "@/lib/source-reader";
import { GRADES, TERMS } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({
    meta: [
      { title: "المصادر | منصة نجم للامتحانات" },
      { name: "description", content: "مكتبة دائمة للكتب والامتحانات السابقة يعتمد عليها الذكاء الاصطناعي في بناء الامتحانات." },
      { property: "og:title", content: "المصادر | منصة نجم للامتحانات" },
      { property: "og:description", content: "ارفع الكتاب مرة واحدة واستخدمه في كل امتحاناتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SourcesPage,
});

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export const SUBJECTS = ["اللغة العربية"];
const KINDS = [
  { v: "book", label: "كتاب مدرسي" },
  { v: "exam", label: "امتحان سابق" },
  { v: "other", label: "أخرى" },
];
const kindLabel = (k: string) => KINDS.find((x) => x.v === k)?.label ?? k;
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} ميجا`;

function SourcesPage() {
  const qc = useQueryClient();
  const readImages = useServerFn(readImagesText);
  const lessonsFn = useServerFn(extractLessons);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState(GRADES[0]!);
  const [term, setTerm] = useState(TERMS[0]!);
  const [kind, setKind] = useState("book");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [hits, setHits] = useState<{ source_id: string; page_no: number; content: string }[] | null>(null);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("id,title,grade,term,kind,subject,file_path,file_name,mime,parts,page_count,size_bytes,status,lessons,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload() {
    if (!file) { toast.error("اختر ملفًا أولًا"); return; }
    setBusy(true);
    let rowId: string | null = null;
    try {
      const { data: u } = await supabase.auth.getUser();
      const base = `${u.user!.id}/${safeStorageName(file.name)}`;
      // تقسيم تلقائي للملفات الكبيرة إلى أجزاء مرتبة
      const nParts = Math.max(1, Math.ceil(file.size / PART_SIZE));
      const parts: string[] = [];
      for (let i = 0; i < nParts; i++) {
        setProgress(nParts > 1 ? `جارٍ رفع الجزء ${i + 1} من ${nParts}...` : "جارٍ رفع الملف وحفظه...");
        const path = nParts > 1 ? `${base}.part${String(i + 1).padStart(3, "0")}` : base;
        const blob = file.slice(i * PART_SIZE, (i + 1) * PART_SIZE);
        const { error } = await supabase.storage.from("sources").upload(path, blob, { contentType: nParts > 1 ? "application/octet-stream" : file.type || "application/octet-stream" });
        if (error) throw new Error("تعذر رفع الملف: " + error.message);
        parts.push(path);
      }
      const { data: row, error: insErr } = await supabase
        .from("sources")
        .insert({
          title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
          grade, term, kind, subject: "اللغة العربية",
          file_path: parts[0]!, parts, size_bytes: file.size,
          file_name: file.name, mime: file.type || "application/octet-stream",
          status: "pending",
        })
        .select("id")
        .single();
      if (insErr) throw new Error("تعذر حفظ المصدر: " + insErr.message);
      rowId = row.id;
      qc.invalidateQueries({ queryKey: ["sources"] });

      const pages = await readFilePages(file, async (images) => (await readImages({ data: { images } })).text, setProgress);
      setProgress("جارٍ فهرسة الصفحات...");
      const rows = pages.map((content, i) => ({ source_id: row.id, page_no: i + 1, content: content.slice(0, 20000) }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("source_pages").upsert(rows.slice(i, i + 100), { onConflict: "source_id,page_no" });
        if (error) throw new Error("تعذرت فهرسة الصفحات: " + error.message);
      }
      const ok = pages.some((p) => p.trim());
      await supabase.from("sources").update({
        page_count: pages.length, status: ok ? "ready" : "failed",
        extracted_text: pages.join("\n").slice(0, 20000),
      }).eq("id", row.id);
      if (ok) {
        setProgress("الذكاء الاصطناعي يستخرج قائمة الدروس...");
        try { await lessonsFn({ data: { id: row.id } }); } catch { /* اختياري */ }
      }
      toast.success(ok ? "تم حفظ المصدر وفهرسته، وأصبح جاهزًا لكل امتحاناتك" : "تم حفظ الملف لكن تعذرت قراءة نصه");
      setOpen(false); setFile(null); setTitle("");
    } catch (e: any) {
      if (rowId) await supabase.from("sources").update({ status: "failed" }).eq("id", rowId);
      toast.error(e?.message ?? "تعذر رفع الملف");
    } finally {
      setBusy(false); setProgress("");
      qc.invalidateQueries({ queryKey: ["sources"] });
    }
  }

  async function remove(s: any) {
    if (!confirm("حذف هذا المصدر نهائيًا؟")) return;
    const paths = s.parts?.length ? s.parts : [s.file_path];
    await supabase.storage.from("sources").remove(paths);
    const { error } = await supabase.from("sources").delete().eq("id", s.id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["sources"] });
  }

  async function openFile(s: any) {
    const paths: string[] = s.parts?.length ? s.parts : [s.file_path];
    if (paths.length === 1) {
      const { data, error } = await supabase.storage.from("sources").createSignedUrl(paths[0]!, 600);
      if (error || !data?.signedUrl) { toast.error("تعذر فتح الملف"); return; }
      window.open(data.signedUrl, "_blank");
      return;
    }
    const t = toast.loading("جارٍ تجميع أجزاء الملف...");
    try {
      const blobs: Blob[] = [];
      for (const p of paths) {
        const { data, error } = await supabase.storage.from("sources").download(p);
        if (error || !data) throw error;
        blobs.push(data);
      }
      window.open(URL.createObjectURL(new Blob(blobs, { type: s.mime || "application/pdf" })), "_blank");
    } catch { toast.error("تعذر فتح الملف"); } finally { toast.dismiss(t); }
  }

  async function saveEdit() {
    const { error } = await supabase.from("sources").update({
      title: editing.title, grade: editing.grade, term: editing.term, kind: editing.kind,
      lessons: String(editing.lessonsText ?? "").split("\n").map((l: string) => l.trim()).filter(Boolean),
    }).eq("id", editing.id);
    if (error) { toast.error("تعذر الحفظ"); return; }
    toast.success("تم حفظ التعديلات");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["sources"] });
  }

  async function searchContent() {
    if (q.trim().length < 2) { setHits(null); return; }
    const { data } = await supabase.from("source_pages").select("source_id,page_no,content").ilike("content", `%${q.trim()}%`).order("page_no").limit(30);
    setHits(data ?? []);
  }

  const filtered = sources.filter((s: any) => !q.trim() || s.title.includes(q.trim()) || (s.lessons ?? []).some((l: string) => l.includes(q.trim())));
  const grouped = GRADES.map((g) => ({ grade: g, items: filtered.filter((s: any) => s.grade === g) })).filter((x) => x.items.length);
  const titleOf = (id: string) => sources.find((s: any) => s.id === id)?.title ?? "";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">المصادر</h1>
          <p className="mt-1 text-sm text-muted-foreground">مكتبتك الدائمة: ارفع الكتاب مرة واحدة فقط، والمنصة تقسّمه وتقرؤه وتفهرسه تلقائيًا لكل امتحاناتك القادمة.</p>
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
            <Label>الملف (PDF أو Word أو صورة — بأي حجم، الكبير يُقسَّم تلقائيًا)</Label>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-4 py-8 text-sm text-muted-foreground hover:border-primary hover:text-ink"
            >
              {file ? <><FileText className="size-4" /> {file.name} ({mb(file.size)})</> : <><ImageIcon className="size-4" /> اضغط لاختيار الملف</>}
            </button>
          </div>
          <Button onClick={upload} disabled={busy} className="bg-gradient-ink">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? progress || "جارٍ الرفع..." : "رفع المصدر وحفظه"}
          </Button>
          {busy && <p className="text-xs text-muted-foreground">لا تغلق الصفحة حتى تنتهي المعالجة — تتم مرة واحدة فقط.</p>}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 size-4 text-muted-foreground" />
          <Input className="pr-9" value={q} onChange={(e) => { setQ(e.target.value); setHits(null); }} onKeyDown={(e) => e.key === "Enter" && searchContent()} placeholder="ابحث باسم المصدر أو الدرس، أو اضغط «بحث في المحتوى»" />
        </div>
        <Button variant="outline" onClick={searchContent}>بحث في المحتوى</Button>
      </div>

      {hits && (
        <div className="surface-card mt-4 max-h-96 space-y-3 overflow-y-auto p-4">
          {hits.length === 0 ? <p className="text-sm text-muted-foreground">لا نتائج داخل صفحات المصادر.</p> : hits.map((h) => {
            const i = h.content.indexOf(q.trim());
            return (
              <div key={h.source_id + h.page_no} className="border-b border-border pb-2 text-sm last:border-0">
                <p className="font-semibold text-ink">{titleOf(h.source_id)} — صفحة {h.page_no}</p>
                <p className="mt-1 text-muted-foreground">…{h.content.slice(Math.max(0, i - 80), i + 120)}…</p>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="surface-card mt-4 space-y-3 p-5">
          <h3 className="font-display font-bold text-ink">تعديل المصدر</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <select className={selectCls} value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
              {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
            <select className={selectCls} value={editing.grade} onChange={(e) => setEditing({ ...editing, grade: e.target.value })}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
            <select className={selectCls} value={editing.term ?? ""} onChange={(e) => setEditing({ ...editing, term: e.target.value })}>
              {TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <Label>الدروس (درس في كل سطر)</Label>
          <textarea className="min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm" value={editing.lessonsText} onChange={(e) => setEditing({ ...editing, lessonsText: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={saveEdit}><Check className="size-4" /> حفظ</Button>
            <Button variant="outline" onClick={() => setEditing(null)}><X className="size-4" /> إلغاء</Button>
          </div>
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
                      <button onClick={() => openFile(s)} className="text-muted-foreground hover:text-ink" title="فتح الملف"><ExternalLink className="size-4" /></button>
                      <button onClick={() => setEditing({ ...s, lessonsText: (s.lessons ?? []).join("\n") })} className="text-muted-foreground hover:text-ink" title="تعديل"><Pencil className="size-4" /></button>
                      <button onClick={() => remove(s)} className="text-muted-foreground hover:text-destructive" title="حذف"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  <h3 className="mt-3 font-display font-bold leading-relaxed text-ink">{s.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.subject} · {s.term}
                    {s.page_count ? ` · ${s.page_count} صفحة` : ""}
                    {s.size_bytes ? ` · ${mb(s.size_bytes)}` : ""}
                    {s.parts?.length > 1 ? ` · ${s.parts.length} أجزاء` : ""}
                    {s.lessons?.length ? ` · ${s.lessons.length} درس` : ""}
                  </p>
                  <p className="mt-3 text-xs">
                    {s.status === "ready" ? <span className="text-primary">✓ مفهرس وجاهز للاستخدام</span>
                      : s.status === "failed" ? <span className="text-destructive">تعذرت قراءة الملف</span>
                      : <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" /> جارٍ المعالجة...</span>}
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
