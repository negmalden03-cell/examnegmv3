CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  grade text NOT NULL,
  term text,
  kind text NOT NULL DEFAULT 'book',
  file_path text NOT NULL,
  file_name text,
  mime text,
  extracted_text text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sources" ON public.sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.exams ADD COLUMN share_code text UNIQUE, ADD COLUMN accepting_responses boolean NOT NULL DEFAULT false, ADD COLUMN spec_text text, ADD COLUMN source_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.results ADD COLUMN submitted_by text NOT NULL DEFAULT 'teacher';
GRANT ALL ON public.exams TO service_role;
GRANT ALL ON public.results TO service_role;

CREATE POLICY "teachers read own source files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'sources' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "teachers upload own source files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sources' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "teachers delete own source files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sources' AND (storage.foldername(name))[1] = auth.uid()::text);