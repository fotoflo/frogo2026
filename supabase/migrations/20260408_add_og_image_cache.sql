-- Add OG image cache columns to channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS og_image_url TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS og_first_video_id UUID REFERENCES videos(id);

-- Create a public storage bucket for OG images
INSERT INTO storage.buckets (id, name, public)
VALUES ('og-images', 'og-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to og-images bucket
CREATE POLICY "Public read og-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'og-images');

-- Allow service role to insert/update/delete
CREATE POLICY "Service write og-images" ON storage.objects
  FOR ALL USING (bucket_id = 'og-images')
  WITH CHECK (bucket_id = 'og-images');
