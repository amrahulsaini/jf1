-- Create photo_mappings table to store original RTU filenames
CREATE TABLE IF NOT EXISTS photo_mappings (
  roll_no TEXT PRIMARY KEY,
  original_photo TEXT,
  original_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE photo_mappings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON photo_mappings;
DROP POLICY IF EXISTS "Allow public insert" ON photo_mappings;
DROP POLICY IF EXISTS "Allow public update" ON photo_mappings;

-- Allow public read access (no authentication needed)
CREATE POLICY "Allow public read access" ON photo_mappings
  FOR SELECT TO anon, authenticated USING (true);

-- Allow public insert (no authentication needed)
CREATE POLICY "Allow public insert" ON photo_mappings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow public update (no authentication needed)
CREATE POLICY "Allow public update" ON photo_mappings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
