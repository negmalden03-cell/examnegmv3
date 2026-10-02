import { createFileRoute } from "@tanstack/react-router";
import { CodeForm } from "@/components/CodeForm";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/take/")({
  head: () => ({
    meta: [
      { title: "دخول الامتحان | منصة نجم للامتحانات" },
      { name: "description", content: "أدخل كود الامتحان الذي أعطاه لك معلمك لتبدأ الإجابة." },
      { property: "og:title", content: "دخول الامتحان | منصة نجم للامتحانات" },
      { property: "og:description", content: "أدخل كود الامتحان وابدأ الإجابة إلكترونيًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TakeEntry,
});

function TakeEntry() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="surface-card w-full max-w-sm p-8 text-center">
        <KeyRound className="mx-auto size-10 text-brass" />
        <h1 className="mt-4 font-display text-xl font-bold text-ink">عندك كود امتحان؟</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">اكتب الكود الذي أعطاه لك معلمك.</p>
        <CodeForm />
      </div>
    </div>
  );
}
