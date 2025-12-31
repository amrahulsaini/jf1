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

-- Allow public read access
CREATE POLICY "Allow public read access" ON photo_mappings
  FOR SELECT TO public USING (true);

-- Allow public insert/update (you can make this more restrictive later)
CREATE POLICY "Allow public insert" ON photo_mappings
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update" ON photo_mappings
  FOR UPDATE TO public USING (true);
