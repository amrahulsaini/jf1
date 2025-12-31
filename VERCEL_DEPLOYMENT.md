# Vercel Deployment Guide

## Prerequisites
1. Supabase account
2. Vercel account
3. GitHub repository with your code

## Step 1: Setup Supabase Storage

### 1.1 Create Storage Bucket
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Click "Storage" in the left sidebar
4. Click "Create a new bucket"
5. Name: `student-photos`
6. **Make it Public** (check the public checkbox)
7. Click "Create bucket"

### 1.2 Set Storage Policies
1. Click on the `student-photos` bucket
2. Go to "Policies" tab
3. Click "New Policy"
4. Select "For full customization" 
5. Add these policies:

**Policy 1: Public Read Access**
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'student-photos' );
```

**Policy 2: Public Upload (or restrict to authenticated users)**
```sql
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'student-photos' );
```

### 1.3 Create photo_mappings Table
1. Go to "SQL Editor" in Supabase Dashboard
2. Click "New Query"
3. Paste the contents of `supabase-photo-mappings.sql`:
```sql
CREATE TABLE IF NOT EXISTS photo_mappings (
  roll_no TEXT PRIMARY KEY,
  original_photo TEXT,
  original_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE photo_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON photo_mappings
  FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert" ON photo_mappings
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update" ON photo_mappings
  FOR UPDATE TO public USING (true);
```
4. Click "Run"

### 1.4 Upload Existing Photos (Optional)
If you have existing photos in `public/student_photos/`, you can upload them:

**Option A: Using Supabase Dashboard**
1. Go to Storage → student-photos
2. Click "Upload files"
3. Select all photos from your local `public/student_photos/` folder
4. Upload (this may take a while for 1000+ files)

**Option B: Using a Script (Recommended for many files)**
Create a file `upload-to-supabase.js`:
```javascript
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function uploadPhotos() {
  const photosDir = path.join(__dirname, 'public', 'student_photos')
  const files = fs.readdirSync(photosDir)
  
  for (const file of files) {
    const filePath = path.join(photosDir, file)
    const fileBuffer = fs.readFileSync(filePath)
    
    const { data, error } = await supabase.storage
      .from('student-photos')
      .upload(file, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })
    
    if (error) {
      console.error(`Failed to upload ${file}:`, error)
    } else {
      console.log(`Uploaded ${file}`)
    }
  }
}

uploadPhotos()
```

Run: `node upload-to-supabase.js`

## Step 2: Push Code to GitHub

```bash
git add -A
git commit -m "Migrate to Supabase Storage for Vercel deployment"
git push origin master
```

## Step 3: Deploy to Vercel

### 3.1 Connect Repository
1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Select the jf1 repository

### 3.2 Configure Environment Variables
Before deploying, add these environment variables:

Click "Environment Variables" and add:

| Name | Value | Where to find |
|------|-------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1...` | Supabase Dashboard → Settings → API → anon public |
| `RTU_SESSION_ID` | Your RTU session ID | From your `.env.local` |
| `RTU_AUTH_TOKEN` | Your RTU auth token | From your `.env.local` |
| `GEMINI_API_KEY` | Your Gemini API key | From your `.env.local` |

### 3.3 Deploy
1. Click "Deploy"
2. Wait for build to complete (2-5 minutes)
3. Once deployed, Vercel will give you a URL like `https://jf1.vercel.app`

## Step 4: Test Your Deployment

1. Visit your Vercel URL
2. Test these features:
   - View students list
   - View student profile
   - Check if photos load from Supabase Storage
   - Upload a new photo (Change PFP)
   - Generate admit card
   - RTU Portal integration

## Step 5: Custom Domain (Optional)

1. In Vercel Dashboard → Project Settings → Domains
2. Add your custom domain (e.g., `students.yourdomain.com`)
3. Follow Vercel's DNS configuration instructions

## Troubleshooting

### Photos Not Loading?
- Check Supabase Storage bucket is PUBLIC
- Verify environment variables are set correctly in Vercel
- Check browser console for CORS errors

### Upload Failing?
- Check Supabase Storage policies allow INSERT
- Verify file size limits (Supabase default: 50MB)
- Check network tab for API errors

### Build Errors?
- Check if all dependencies are in `package.json`
- Verify TypeScript has no errors: `npm run build` locally
- Check Vercel build logs for specific errors

## Important Notes

1. **RTU Session Cookies**: Your RTU session cookies may expire. Update them in Vercel Environment Variables when needed.

2. **Storage Limits**: Supabase free tier includes 1GB storage. Monitor usage in Dashboard.

3. **Database Limits**: Supabase free tier includes 500MB database. Your firstyear table should be fine.

4. **Bandwidth**: Supabase free tier: 2GB/month. Monitor if you have many users.

5. **Functions**: Vercel free tier includes 100GB-hours/month serverless functions execution time.

## Cost Breakdown (Free Tiers)

- **Vercel**: Free tier includes unlimited deployments, 100GB bandwidth
- **Supabase**: Free tier includes 500MB database, 1GB storage, 2GB bandwidth
- **Total**: $0/month (within free tier limits)

## Upgrade Recommendations

If you exceed free tier:
- **Supabase Pro**: $25/month (8GB database, 100GB storage, 50GB bandwidth)
- **Vercel Pro**: $20/month/user (unlimited bandwidth, advanced analytics)

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs (Dashboard → Logs)
3. Check browser console for client-side errors
4. Verify all environment variables are set correctly
