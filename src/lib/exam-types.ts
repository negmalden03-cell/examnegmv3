export type QuestionType = "mcq" | "tf" | "short" | "essay";

export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[] | undefined;
  answer: string;
  marks: number;
};

export type Section = {
  id: string;
  branch: string;
  title: string;
  passage?: string | undefined;
  questions: Question[];
};

export type QuestionGrade = { score: number; feedback: string };

export const GRADES = ["الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي"];
export const TERMS = ["الفصل الدراسي الأول", "الفصل الدراسي الثاني"];
export const BRANCHES = ["القراءة", "النصوص", "النحو", "البلاغة", "التعبير", "الإملاء", "القصة", "الاستماع", "الخط"];
export const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "اختيار من متعدد",
  tf: "صواب وخطأ",
  short: "إجابة قصيرة",
  essay: "مقالي",
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function totalMarks(sections: Section[]) {
  return sections.reduce((s, sec) => s + sec.questions.reduce((a, q) => a + (Number(q.marks) || 0), 0), 0);
}

export function normalizeSections(raw: unknown): Section[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((s: any) => ({
    id: s.id || uid(),
    branch: String(s.branch ?? ""),
    title: String(s.title ?? s.branch ?? "سؤال"),
    passage: s.passage ? String(s.passage) : undefined,
    questions: (Array.isArray(s.questions) ? s.questions : []).map((q: any) => normalizeQuestion(q)),
  }));
}

export function normalizeQuestion(q: any): Question {
  const type: QuestionType = (["mcq", "tf", "short", "essay"] as string[]).includes(String(q?.type)) ? q.type : "short";
  return {
    id: q?.id || uid(),
    type,
    text: String(q?.text ?? ""),
    options: type === "mcq" ? (Array.isArray(q?.options) ? q.options.map(String) : []) : type === "tf" ? ["صواب", "خطأ"] : undefined,
    answer: String(q?.answer ?? ""),
    marks: Number(q?.marks) || 1,
  };
}

export const toArabicDigits = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);
