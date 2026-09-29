import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FileText, Trash2, Users, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toArabicDigits } from "@/lib/exam-types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "امتحاناتي | منصة نجم للامتحانات" },
      { name: "description", content: "قائمة امتحانات اللغة العربية التي أنشأتها." },
      { property: "og:title", content: "امتحاناتي | منصة نجم للامتحانات" },
      { property: "og:description", content: "إدارة امتحانات اللغة العربية للمرحلة الإعدادية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id,title,grade,term,total_marks,duration_minutes,status,created_at,results(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    if (!confirm("حذف الامتحان ونتائجه نهائيًا؟")) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["exams"] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">امتحاناتي</h1>
          <p className="mt-1 text-sm text-muted-foreground">كل الامتحانات التي أنشأتها، مع عدد الطلاب المصحَّحين.</p>
        </div>
        <Button asChild>
          <Link to="/exams/new">
            <FilePlus2 className="size-4" /> امتحان جديد
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-10 text-muted-foreground">جارٍ التحميل...</p>
      ) : exams.length === 0 ? (
        <div className="surface-card mt-8 p-10 text-center">
          <FileText className="mx-auto size-10 text-brass" />
          <h2 className="mt-4 font-display text-lg font-bold text-ink">لا توجد امتحانات بعد</h2>
          <p className="mt-2 text-sm text-muted-foreground">ابدأ بإنشاء امتحانك الأول بالذكاء الاصطناعي في أقل من دقيقة.</p>
          <Button asChild className="mt-6">
            <Link to="/exams/new">أنشئ امتحانًا</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((e: any) => (
            <div key={e.id} className="surface-card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-ink">{e.grade}</span>
                <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive" title="حذف">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <h3 className="mt-3 font-display font-bold leading-relaxed text-ink">{e.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{e.term}</p>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span>{toArabicDigits(e.total_marks)} درجة</span>
                <span>{toArabicDigits(e.duration_minutes)} دقيقة</span>
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" /> {toArabicDigits(e.results?.[0]?.count ?? 0)}
                </span>
              </div>
              <div className="mt-5 flex gap-2 pt-1">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link to="/exams/$id" params={{ id: e.id }}>
                    <FileText className="size-4" /> فتح
                  </Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link to="/exams/$id/grade" params={{ id: e.id }}>
                    <ClipboardCheck className="size-4" /> تصحيح
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
