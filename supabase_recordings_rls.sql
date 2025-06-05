-- Enable RLS
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Users can insert (upload) their own recordings
CREATE POLICY "Users can upload their own recordings"
  ON public.recordings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Fix Supabase RLS for recordings: allow admins to view all, users to view their own
-- Remove any old/conflicting select policies
DROP POLICY IF EXISTS "Users can manage their own recordings" ON recordings;
DROP POLICY IF EXISTS "Users can view their own recordings" ON recordings;
DROP POLICY IF EXISTS "Admins can view all recordings" ON recordings;

-- Allow users to select their own recordings
CREATE POLICY "Users can view their own recordings" ON recordings
  FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to select all recordings
CREATE POLICY "Admins can view all recordings" ON recordings
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

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
