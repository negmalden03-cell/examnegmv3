import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Brand } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول المعلم | منصة نجم للامتحانات" },
      { name: "description", content: "سجّل دخولك إلى منصة نجم للامتحانات لإدارة امتحانات اللغة العربية." },
      { property: "og:title", content: "دخول المعلم | منصة نجم للامتحانات" },
      { property: "og:description", content: "سجّل دخولك لإنشاء امتحانات اللغة العربية وتصحيحها بالذكاء الاصطناعي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("تم إنشاء الحساب، افتح بريدك لتأكيد الحساب ثم سجّل الدخول");
      }
    } catch (err: any) {
      toast.error(err?.message === "Invalid login credentials" ? "البريد أو كلمة المرور غير صحيحة" : err?.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("تعذر الدخول بحساب جوجل");
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-gradient-paper px-5 py-10">
      <div className="pattern-geometric absolute inset-0 opacity-50" aria-hidden />
      <div className="surface-card relative w-full max-w-md p-8">
        <Brand />
        <h1 className="mt-6 font-display text-2xl font-bold text-ink">
          {mode === "in" ? "مرحبًا بعودتك" : "إنشاء حساب معلم"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">المنصة مخصصة لمعلمي اللغة العربية بالمرحلة الإعدادية.</p>
        <Button type="button" variant="outline" className="mt-6 w-full" onClick={google}>
          المتابعة بحساب Google
        </Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> أو <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">كلمة المرور</Label>
            <Input id="pw" type="password" dir="ltr" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "جارٍ..." : mode === "in" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </Button>
        </form>
        <button
          className="mt-5 w-full text-center text-sm text-primary hover:underline"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "ليس لديك حساب؟ أنشئ حسابًا" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </div>
    </div>
  );
}
