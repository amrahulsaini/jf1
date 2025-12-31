# Student Portal - Setup Instructions

This is a Next.js application that displays student data from Supabase.

## Prerequisites

1. A Supabase account and project
2. Node.js installed
3. The PostgreSQL database imported into Supabase

## Setup Steps

### 1. Import Database to Supabase

1. Go to your Supabase Dashboard (https://supabase.com)
2. Create a new project or select an existing one
3. Go to **SQL Editor** in the left sidebar
4. Click **"+ New query"**
5. Open the file `firstyear_postgres.sql` from `C:\Users\ammra\Downloads\firstyear_postgres.sql`
6. Copy all contents and paste into the Supabase SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Wait for completion - you should see "Success. No rows returned"
9. Go to **Table Editor** to verify the `firstyear` table has 1,352 rows

### 2. Get Supabase Credentials

1. In your Supabase project, go to **Settings** > **API**
2. Copy the following:
   - **Project URL** (under "Project URL")
   - **anon public key** (under "Project API keys")

### 3. Configure the Application

1. Open the file `.env.local` in the project root
2. Replace the placeholder values with your actual Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Install Dependencies (Already Done)

Dependencies are already installed, but if needed:
```bash
npm install
```

### 5. Run the Development Server

```bash
npm run dev
```

The application will start at http://localhost:3000

## Features

### Student List Page (`/students`)
- View all 1,352 students in a card layout
- Search by name, roll number, or enrollment number
- Filter by branch
- Responsive design
- Click any card to view student details

### Student Detail Page (`/students/[rollNo]`)
- View complete student information
- Personal details (name, parents' names, gender)
- Academic information (branch, section, group)
- Contact information (mobile, email)
- Document paths (photo, admit card)
- Action buttons for downloading documents

## Project Structure

```
jf1/
├── app/
│   ├── page.tsx                    # Home page with portal link
│   ├── students/
│   │   ├── page.tsx                # Student list page
│   │   └── [rollNo]/
│   │       └── page.tsx            # Student detail page
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── lib/
│   ├── supabase.ts                 # Supabase client configuration
│   └── database.types.ts           # TypeScript types for database
├── .env.local                      # Environment variables (Supabase credentials)
├── package.json
└── README.md

```

## Database Schema

The `firstyear` table contains the following fields:

- `s_no` (PRIMARY KEY) - Serial number
- `roll_no` - Student roll number
- `enrollment_no` - Enrollment number
- `student_name` - Student's full name
- `father_name` - Father's name
- `mother_name` - Mother's name
- `sex` - Gender
- `branch` - Academic branch
- `student_section` - Section
- `student_group` - Group
- `mobile_no` - Mobile number
- `student_emailid` - Email address
- `abc_id` - ABC ID
- `photo_path` - Path to student photo
- `admit_card_path` - Path to admit card
- `password` - Password
- `student_password` - Student password
- `otp_verified` - OTP verification status (boolean)

## Technologies Used

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - PostgreSQL database and API
- **React Hooks** - State management

## Troubleshooting

### "Error loading students"
- Check that your Supabase credentials in `.env.local` are correct
- Verify the database table `firstyear` exists in Supabase
- Check browser console for detailed error messages

### No students showing
- Verify data was imported successfully in Supabase Table Editor
- Check network tab in browser dev tools for API errors
- Ensure the table name is exactly `firstyear` (lowercase)

### Build errors
- Make sure all dependencies are installed: `npm install`
- Clear Next.js cache: `rm -rf .next` then `npm run dev`

## Next Steps

You can enhance this application by:
- Adding authentication
- Implementing photo/admit card upload
- Adding search filters (by session, category, etc.)
- Creating an admin panel for data management
- Adding export to Excel functionality
- Implementing email sending functionality

## Support

For issues related to:
- Supabase: https://supabase.com/docs
- Next.js: https://nextjs.org/docs
