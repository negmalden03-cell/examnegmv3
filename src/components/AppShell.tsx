import { Link, useNavigate } from "@tanstack/react-router";
import { Star, LayoutDashboard, FilePlus2, BarChart3, LogOut, BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/dashboard", label: "امتحاناتي", icon: LayoutDashboard },
  { to: "/exams/new", label: "امتحان جديد", icon: FilePlus2 },
  { to: "/results", label: "النتائج والتحليل", icon: BarChart3 },
] as const;

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-ink text-primary-foreground">
        <Star className="size-4.5 fill-current" />
      </span>
      <span className="font-display text-base font-bold text-ink">منصة نجم للامتحانات</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-paper">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Brand />
          <nav className="flex items-center gap-1 overflow-x-auto text-sm">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-ink"
                activeProps={{ className: "bg-secondary text-ink font-semibold" }}
              >
                <n.icon className="size-4" />
                <span className="hidden sm:inline">{n.label}</span>
              </Link>
            ))}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
              title="تسجيل الخروج"
            >
              <LogOut className="size-4" />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
