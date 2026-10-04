// Browser-only helpers: read text from Word / PDF / image files before sending to AI.
export const isWord = (mime: string, name: string) => mime.includes("word") || /\.docx?$/i.test(name);
export const isPdf = (mime: string, name: string) => mime === "application/pdf" || /\.pdf$/i.test(name);

/** Storage part size: files larger than this are split into ordered parts automatically. */
export const PART_SIZE = 180 * 1024 * 1024;

export const safeStorageName = (name: string) => {
  const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? "bin").toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
};

export const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(b);
  });

type ImagesReader = (images: { mime: string; base64: string }[]) => Promise<string>;

async function imageFileToJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82).split(",")[1] ?? "";
}

/** Split long plain text into pseudo-pages of ~3000 chars. */
const chunkText = (t: string) => {
  const out: string[] = [];
  for (let i = 0; i < t.length; i += 3000) out.push(t.slice(i, i + 3000));
  return out.length ? out : [""];
};

/** Returns text per page (ordered). Scanned pages are read by AI (Arabic OCR). */
export async function readFilePages(
  file: File,
  readImages: ImagesReader,
  onProgress?: (msg: string) => void,
  maxScannedPages = 400,
): Promise<string[]> {
  if (isWord(file.type, file.name)) {
    onProgress?.("جارٍ قراءة ملف Word...");
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return chunkText(value);
  }
  if (file.type.startsWith("image/")) {
    onProgress?.("الذكاء الاصطناعي يقرأ الصورة...");
    return [await readImages([{ mime: "image/jpeg", base64: await imageFileToJpeg(file) }])];
  }
  if (!isPdf(file.type, file.name)) throw new Error("نوع الملف غير مدعوم");

  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    if (p % 10 === 1) onProgress?.(`جارٍ استخراج نص الصفحات ${p} من ${doc.numPages}...`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((i: any) => i.str ?? "").join(" "));
  }
  // صفحات مصوّرة (نص قليل) تُقرأ بالذكاء الاصطناعي على دفعات من ٤
  const scanned = pages.map((t, i) => (t.replace(/\s/g, "").length < 60 ? i + 1 : 0)).filter(Boolean).slice(0, maxScannedPages);
  for (let k = 0; k < scanned.length; k += 4) {
    const group = scanned.slice(k, k + 4);
    onProgress?.(`قراءة عربية للصفحات المصوّرة ${k + 1}–${k + group.length} من ${scanned.length}...`);
    const batch: { mime: string; base64: string }[] = [];
    for (const p of group) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1.4 });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp } as any).promise;
      batch.push({ mime: "image/jpeg", base64: c.toDataURL("image/jpeg", 0.75).split(",")[1] ?? "" });
    }
    try {
      const txt = await readImages(batch);
      // نوزّع النص على الصفحات بحسب علامات [صفحة] إن وُجدت، وإلا نضعه كله في أول صفحة من الدفعة
      const split = txt.split(/\[صفحة\s*\d+\]/).map((s) => s.trim()).filter(Boolean);
      if (split.length === group.length) group.forEach((p, i) => (pages[p - 1] = split[i]!));
      else pages[group[0]! - 1] = txt;
    } catch (e) {
      console.error(e);
    }
  }
  return pages;
}

export async function readFileText(file: File, readImages: ImagesReader, onProgress?: (msg: string) => void) {
  const pages = await readFilePages(file, readImages, onProgress);
  return pages.map((t, i) => `[صفحة ${i + 1}]\n${t}`).join("\n\n");
}
