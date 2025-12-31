import re

# Read the MySQL dump
with open('firstyear (4).sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract ALL INSERT statements and data (there are multiple INSERT statements)
insert_pattern = r'INSERT INTO `firstyear`.*?VALUES\s+(.*?);'
matches = re.findall(insert_pattern, content, re.DOTALL)

if matches:
    # Create PostgreSQL compatible SQL header
    pg_sql = '''-- PostgreSQL compatible SQL for Supabase
-- Converted from MySQL dump

-- Create table
CREATE TABLE IF NOT EXISTS firstyear (
  sex VARCHAR(10) DEFAULT NULL,
  s_no SERIAL PRIMARY KEY,
  roll_no VARCHAR(20) NOT NULL,
  enrollment_no VARCHAR(20) DEFAULT NULL,
  student_name VARCHAR(100) DEFAULT NULL,
  father_name VARCHAR(100) DEFAULT NULL,
  mother_name VARCHAR(100) DEFAULT NULL,
  branch VARCHAR(200) DEFAULT NULL,
  password VARCHAR(20) DEFAULT NULL,
  abc_id VARCHAR(20) NOT NULL,
  admit_card_path VARCHAR(255) NOT NULL,
  photo_path VARCHAR(255) NOT NULL,
  mobile_no VARCHAR(20) DEFAULT NULL,
  student_emailid VARCHAR(100) DEFAULT NULL,
  student_password VARCHAR(255) DEFAULT NULL,
  otp_verified BOOLEAN DEFAULT FALSE,
  student_group VARCHAR(50) DEFAULT NULL,
  student_section VARCHAR(255) DEFAULT NULL
);

-- Insert data
INSERT INTO firstyear (sex, s_no, roll_no, enrollment_no, student_name, father_name, mother_name, branch, password, abc_id, admit_card_path, photo_path, mobile_no, student_emailid, student_password, otp_verified, student_group, student_section) VALUES
'''
    
    all_processed_rows = []
    
    # Process each INSERT statement's data
    for values_section in matches:
        # Split by rows and process each
        rows = re.split(r'\),\s*\n\(', values_section)
        
        for row in rows:
            # Clean up row
            row = row.strip()
            if row.startswith('('):
                row = row[1:]
            if row.endswith(')'):
                row = row[:-1]
            
            # Replace 0 with FALSE and 1 with TRUE for otp_verified
            # The pattern is: ..., 0, 'B', 'P1')
            parts = row.rsplit(',', 3)  # Split from right to get last 3 items
            if len(parts) == 4:
                # Convert the otp_verified value (third from end)
                left_part = parts[0]
                otp_val = parts[1].strip()
                group_val = parts[2].strip()
                section_val = parts[3].strip()
                
                if otp_val == '0':
                    otp_val = 'FALSE'
                elif otp_val == '1':
                    otp_val = 'TRUE'
                
                row = f"{left_part}, {otp_val}, {group_val}, {section_val}"
            
            all_processed_rows.append(f"({row})")
    
    pg_sql += ',\n'.join(all_processed_rows) + ';'
    
    # Write to new file
    with open('firstyear_postgres.sql', 'w', encoding='utf-8') as f:
        f.write(pg_sql)
    
    print('✓ PostgreSQL file created: firstyear_postgres.sql')
    print(f'✓ Total rows: {len(all_processed_rows)}')
    print(f'✓ Found {len(matches)} INSERT statements in original file')
else:
    print('Error: Could not parse INSERT statements')
