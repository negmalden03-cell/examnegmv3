ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'اللغة العربية';
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS parts text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS size_bytes bigint NOT NULL DEFAULT 0;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS lessons text[] NOT NULL DEFAULT '{}';
CREATE TABLE public.source_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  page_no integer NOT NULL,
  content text NOT NULL DEFAULT '',
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  UNIQUE (source_id, page_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_pages TO authenticated;
GRANT ALL ON public.source_pages TO service_role;
ALTER TABLE public.source_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own source pages" ON public.source_pages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX source_pages_tsv_idx ON public.source_pages USING gin(tsv);
CREATE INDEX source_pages_src_idx ON public.source_pages(source_id, page_no);