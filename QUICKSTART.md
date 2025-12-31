# Quick Start Guide

## ⚡ Quick Setup (3 steps)

### Step 1: Import Database to Supabase
1. Go to https://supabase.com and login
2. Click **SQL Editor** → **+ New query**
3. Copy & paste content from: `C:\Users\ammra\Downloads\firstyear_postgres.sql`
4. Click **Run** button
5. ✓ Verify 1,352 students in Table Editor

### Step 2: Add Your Supabase Credentials
Edit `.env.local` file and add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

**Where to find these:**
- Supabase Dashboard → Settings → API
- Copy "Project URL" and "anon public" key

### Step 3: Run the App
```bash
npm run dev
```

Open http://localhost:3000

---

## 📁 Files Created

✅ `/lib/supabase.ts` - Supabase client
✅ `/lib/database.types.ts` - TypeScript types  
✅ `/app/students/page.tsx` - Student list page
✅ `/app/students/[rollNo]/page.tsx` - Student details
✅ `/app/page.tsx` - Home page
✅ `.env.local` - Configuration file (ADD YOUR KEYS!)

---

## 🎯 What You Get

### Home Page (`/`)
- Landing page with link to student database

### Student List (`/students`)
- All 1,352 students displayed as cards
- Search by name/roll no/enrollment
- Filter by branch
- Click card → view details

### Student Detail (`/students/ROLL_NO`)
- Complete student information
- Personal, academic, contact info
- Document paths
- Action buttons

---

## ⚠️ Important Notes

1. **Must configure `.env.local`** with your Supabase credentials before running
2. **Database must be imported** to Supabase first
3. **Table name must be `firstyear`** (lowercase, no spaces)

---

## 🔧 Common Issues

**Can't see students?**
→ Check `.env.local` has correct Supabase URL and key
→ Verify table exists in Supabase Table Editor

**Build errors?**
→ Run `npm install` to ensure all packages installed

**Database errors?**
→ Make sure SQL file imported successfully in Supabase
