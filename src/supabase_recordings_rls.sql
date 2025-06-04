-- Enable RLS
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Users can insert (upload) their own recordings
CREATE POLICY "Users can upload their own recordings"
  ON public.recordings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can view (select) only their own recordings, admins can view all
CREATE POLICY "Users can view their own recordings or admin can view all"
  ON public.recordings
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    ))
  );

-- Only admins can delete recordings
CREATE POLICY "Only admins can delete recordings"
  ON public.recordings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only admins can update recordings
CREATE POLICY "Only admins can update recordings"
  ON public.recordings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );
