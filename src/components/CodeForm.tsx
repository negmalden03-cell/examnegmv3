import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CodeForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = code.replace(/\D/g, "").slice(0, 4);
    if (digits.length !== 4) return;
    navigate({ to: "/take/$code", params: { code: `NJM-${digits}` } });
  };
  return (
    <form onSubmit={go} className="flex gap-2">
      <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="NJM-1234" className="text-center tracking-widest" />
      <Button type="submit">ادخل</Button>
    </form>
  );
}

