import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { editExamChat } from "@/lib/ai.functions";
import { normalizeSections, type Section } from "@/lib/exam-types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Msg = { role: "user" | "ai"; text: string };

export function ExamChat({
  grade, title, sections, onApply,
}: { grade: string; title: string; sections: Section[]; onApply: (title: string, sections: Section[]) => void }) {
  const run = useServerFn(editExamChat);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState<{ title: string; sections: Section[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [msgs, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const r = await run({ data: { grade, title, sections, instruction: text, history: msgs.slice(-10) } });
      setPrev({ title, sections });
      onApply(r.title, normalizeSections(r.sections));
      setMsgs((m) => [...m, { role: "ai", text: r.reply }]);
    } catch (e: any) {
      const msg = e?.message ?? "تعذر تنفيذ التعديل";
      setMsgs((m) => [...m, { role: "ai", text: `⚠ ${msg}` }]);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-card flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 font-display font-bold text-ink"><Bot className="size-5" /> عدّل بالذكاء الاصطناعي</p>
        {prev && (
          <Button size="sm" variant="ghost" onClick={() => { onApply(prev.title, prev.sections); setPrev(null); toast.success("تم التراجع"); }}>
            <Undo2 className="size-4" /> تراجع
          </Button>
        )}
      </div>
      <div className="max-h-72 min-h-24 space-y-2 overflow-y-auto rounded-lg bg-secondary/40 p-3 text-sm">
        {msgs.length === 0 && <p className="text-muted-foreground">اكتب ما تريد تعديله، مثل: «اجعل السؤال الثالث أسهل» أو «أضف سؤال إعراب في قسم النحو» أو «غيّر قطعة القراءة».</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 leading-relaxed ${m.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "text-ink"}`}>{m.text}</div>
        ))}
        {busy && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> جارٍ التعديل...</p>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب طلب التعديل..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button onClick={send} disabled={busy || !input.trim()} className="h-auto"><Send className="size-4" /></Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">التعديلات تظهر فورًا في الامتحان، ويمكنك تعديلها يدويًا ثم الضغط على «حفظ».</p>
    </div>
  );
}
