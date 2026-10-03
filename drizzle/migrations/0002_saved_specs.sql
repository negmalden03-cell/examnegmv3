CREATE TABLE public.saved_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  spec text NOT NULL,
  total_marks integer,
  duration integer,
  branches text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_specs TO authenticated;
GRANT ALL ON public.saved_specs TO service_role;
ALTER TABLE public.saved_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own specs" ON public.saved_specs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);