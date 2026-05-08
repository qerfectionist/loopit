-- ============================================
-- 005: Supabase Storage — item-images bucket
-- Applied via: supabase db push (runs as postgres with full privileges)
-- ============================================

-- Create bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-images',
  'item-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- Storage RLS Policies on storage.objects
-- NOTE: No SELECT policy needed — bucket is public,
--       Supabase CDN serves files without JWT.
-- ============================================

-- INSERT: authenticated user can only upload to their own folder (userId/*)
CREATE POLICY "Auth users upload own item-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: owner only
CREATE POLICY "Auth users delete own item-images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
