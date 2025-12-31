-- Test: Insert a sample record to verify the page works
INSERT INTO photo_mappings (roll_no, original_photo, original_signature, updated_at)
VALUES 
  ('24EJCCS721', 'rahul_kumar_photo.jpg', 'rahul_sign.jpg', NOW()),
  ('24EJCIT138', 'priya_sharma_pic.jpg', NULL, NOW())
ON CONFLICT (roll_no) DO UPDATE 
  SET original_photo = EXCLUDED.original_photo,
      original_signature = EXCLUDED.original_signature,
      updated_at = EXCLUDED.updated_at;

-- Verify the data was inserted
SELECT * FROM photo_mappings;
