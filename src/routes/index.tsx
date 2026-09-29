import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  FileText,
  PenLine,
  BarChart3,
  Wand2,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

import heroImage from "@/assets/hero-arabic-exams.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة نجم للامتحانات | إنشاء الامتحانات بالذكاء الاصطناعي" },
      {
        name: "description",
        content:
          "منصة للمعلمين لإنشاء امتحانات اللغة العربية للصفوف الإعدادية في مصر، وتصحيح الإجابات المقالية وتحليل نتائج الطلاب بالذكاء الاصطناعي.",
      },
      {
        property: "og:title",
        content: "منصة نجم للامتحانات | إنشاء الامتحانات بالذكاء الاصطناعي",
      },
      {
        property: "og:description",
        content:
          "ولّد امتحانًا كاملًا بمواصفات دقيقة، وصحّح المقالي، وحلّل نتائج طلابك في دقائق.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Wand2,
    title: "توليد الأسئلة تلقائيًا",
    body: "ارفع الدرس أو النص، واحصل على أسئلة اختيار من متعدد وصح وخطأ ومقالية بمستويات متدرجة.",
  },
  {
    icon: FileText,
    title: "امتحان كامل جاهز",
    body: "حدّد الصف والفروع والدرجات وزمن الامتحان، ثم ولّد ورقة امتحان متكاملة بضغطة واحدة.",
  },
  {
    icon: PenLine,
    title: "تصحيح الإجابات المقالية",
    body: "تقييم إجابات التعبير والنصوص مع درجة مقترحة وتعليق واضح يوضّح سبب كل درجة.",
  },
  {
    icon: BarChart3,
    title: "تحليل نتائج الطلاب",
    body: "تقارير تُظهر نقاط الضعف في النحو والبلاغة والإملاء، مع تدريبات مقترحة للعلاج.",
  },
];

const steps = [
  { n: "١", title: "اختر الصف والفرع", body: "الأول أو الثاني أو الثالث الإعدادي، ونحو أو قراءة أو نصوص أو بلاغة أو تعبير أو إملاء." },
  { n: "٢", title: "حدّد المواصفات", body: "عدد الأسئلة وأنواعها وتوزيع الدرجات ومستوى الصعوبة." },
  { n: "٣", title: "ولّد وعدّل", body: "راجع الأسئلة، عدّل أي سؤال، ثم اعتمد نسخة الامتحان ونموذج الإجابة." },
  { n: "٤", title: "صحّح وحلّل", body: "أدخل إجابات الطلاب ليصحّح المقالي ويعطيك تقريرًا بمستوى كل طالب." },
];

function Index() {
  return (
    <div className="min-h-screen bg-gradient-paper">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-ink text-primary-foreground">
              <Sparkles className="size-4.5" />
            </span>
            <span className="font-display text-base font-bold text-ink">
              منصة نجم للامتحانات
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a className="transition-colors hover:text-ink" href="#features">
              المميزات
            </a>
            <a className="transition-colors hover:text-ink" href="#how">
              كيف تعمل
            </a>
            <a className="transition-colors hover:text-ink" href="#scope">
              المحتوى
            </a>
          </nav>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-ink"
          >
            ابدأ الآن
            <ArrowLeft className="size-4" />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pattern-geometric absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brass/40 bg-accent/60 px-3.5 py-1.5 text-xs font-medium text-ink">
              <Sparkles className="size-3.5" />
              مدعومة بالذكاء الاصطناعي
            </span>
            <h1 className="mt-5 font-display text-3xl leading-[1.35] font-extrabold text-ink sm:text-4xl md:text-5xl md:leading-[1.3]">
              امتحانات لغة عربية
              <span className="block text-primary">جاهزة في دقائق</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              منصة مخصصة لمعلم اللغة العربية في المرحلة الإعدادية بمصر: ولّد الأسئلة، وجهّز ورقة
              امتحان كاملة، وصحّح الإجابات المقالية، وتابع مستوى طلابك من مكان واحد.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/exams/new"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-ink px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lift transition-transform hover:-translate-y-0.5"
              >
                أنشئ امتحانك الأول
                <ArrowLeft className="size-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-secondary"
              >
                تعرّف على المميزات
              </a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
              {[
                { k: "٣", v: "صفوف إعدادية" },
                { k: "٦", v: "فروع المادة" },
                { k: "دقائق", v: "لإعداد الامتحان" },
              ].map((s) => (
                <div key={s.v} className="surface-card px-3 py-4">
                  <dt className="font-display text-xl font-bold text-primary">{s.k}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-accent/50 blur-2xl" aria-hidden="true" />
            <img
              src={heroImage}
              alt="كتاب لغة عربية مفتوح على مكتب المعلم"
              width={1536}
              height={1024}
              className="relative w-full rounded-3xl border border-border object-cover shadow-lift"
            />
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          كل ما يحتاجه المعلم في أداة واحدة
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          أربع قدرات أساسية تختصر ساعات العمل الورقي إلى دقائق.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <article key={f.title} className="surface-card group p-6 transition-shadow hover:shadow-lift">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="border-y border-border bg-card/60 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">كيف تعمل المنصة؟</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="surface-card p-6">
                <span className="grid size-10 place-items-center rounded-full bg-gradient-ink font-display text-base font-bold text-primary-foreground">
                  {s.n}
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="scope" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              مصمّمة على منهج المرحلة الإعدادية
            </h2>
            <p className="mt-3 text-muted-foreground">
              الأسئلة تُبنى حسب الصف والفرع، بصياغة عربية سليمة ومستوى مناسب لسن الطالب.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "الأول الإعدادي",
                "الثاني الإعدادي",
                "الثالث الإعدادي",
                "نحو",
                "قراءة",
                "نصوص",
                "بلاغة",
                "تعبير",
                "إملاء",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-ink"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="surface-card p-7">
            <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-ink">المعلم صاحب القرار</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              الذكاء الاصطناعي يقترح، والمعلم يراجع ويعدّل ويعتمد. كل سؤال قابل للتعديل أو الحذف قبل
              طباعة الامتحان، وكل درجة مقترحة في التصحيح يمكن تغييرها.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <span className="font-display font-bold text-ink">منصة نجم للامتحانات</span>
          <span>للمعلمين في مصر · المرحلة الإعدادية</span>
        </div>
      </footer>
    </div>
  );
}
