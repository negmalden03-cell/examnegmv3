// Browser-only helpers: read text from Word / PDF / image files before sending to AI.
export const isWord = (mime: string, name: string) => mime.includes("word") || /\.docx?$/i.test(name);
export const isPdf = (mime: string, name: string) => mime === "application/pdf" || /\.pdf$/i.test(name);

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

/** Downscale an image file to a JPEG for AI reading. */
async function imageFileToJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82).split(",")[1] ?? "";
}

export async function readFileText(
  file: File,
  readImages: ImagesReader,
  onProgress?: (msg: string) => void,
  maxScannedPages = 60,
): Promise<string> {
  if (isWord(file.type, file.name)) {
    onProgress?.("جارٍ قراءة ملف Word...");
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }
  if (file.type.startsWith("image/")) {
    onProgress?.("الذكاء الاصطناعي يقرأ الصورة...");
    return readImages([{ mime: "image/jpeg", base64: await imageFileToJpeg(file) }]);
  }
  if (!isPdf(file.type, file.name)) throw new Error("نوع الملف غير مدعوم");

  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    if (p % 10 === 1) onProgress?.(`جارٍ قراءة الصفحات ${p} من ${doc.numPages}...`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((i: any) => i.str ?? "").join(" "));
  }
  const textChars = pages.join("").replace(/\s/g, "").length;
  if (textChars / doc.numPages > 80) return pages.map((t, i) => `[صفحة ${i + 1}]\n${t}`).join("\n\n");

  // PDF مصوّر: نحوّل الصفحات لصور ويقرؤها الذكاء الاصطناعي على دفعات
  const n = Math.min(doc.numPages, maxScannedPages);
  const out: string[] = [];
  for (let start = 1; start <= n; start += 4) {
    onProgress?.(`الذكاء الاصطناعي يقرأ الصفحات ${start}–${Math.min(n, start + 3)} من ${n}...`);
    const batch: { mime: string; base64: string }[] = [];
    for (let p = start; p < start + 4 && p <= n; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1.4 });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      batch.push({ mime: "image/jpeg", base64: c.toDataURL("image/jpeg", 0.75).split(",")[1] ?? "" });
    }
    out.push(await readImages(batch));
  }
  return out.join("\n\n");
}
