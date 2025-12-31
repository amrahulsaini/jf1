# Profile Photo Management & Admit Card System

## What's Been Implemented

### 1. **Standardized Photo Storage**
- Photos are now saved with standardized filenames: `photo_ROLLNO.jpg` or `photo_ROLLNO.png`
- All photos are stored in `/public/student_photos/` directory
- Files are automatically overwritten when new photos are uploaded (keeps the same filename)

### 2. **RTU Upload Integration**
When photos are uploaded to RTU Portal via the existing upload system:
- Photos are **automatically saved locally** with the standardized filename
- This happens in the background after successful RTU upload
- Location: `/app/api/rtu-upload/route.ts` (modified)

### 3. **Change Profile Photo Feature**
Added a new "Change Profile Photo" button on each student profile page:
- **Location**: Student detail page (`/students/[rollNo]`)
- **Features**:
  - Opens a modal with current photo preview
  - Allows uploading new photo directly (without RTU upload)
  - Validates file size (max 5MB) and format (JPG, PNG)
  - Saves with standardized filename
  - Immediately reflects in admit cards

### 4. **Admit Card Generation**
New API endpoint to generate admit cards with current profile photo:
- **Endpoint**: `/api/generate-admit-card`
- **Method**: POST with `{ rollNo: string }`
- **Features**:
  - Fetches student data from Supabase
  - Uses locally saved photo (`photo_ROLLNO.jpg`)
  - Falls back to placeholder avatar if no photo exists
  - Generates beautiful HTML admit card
  - Auto-opens in new window with print dialog
  - Includes all student details and instructions

### 5. **Download Photo Feature**
- "Download Photo" button now works
- Downloads the current local photo file
- Uses standardized filename

## API Endpoints Created

### `/api/save-photo`
```typescript
POST /api/save-photo
Body: FormData {
  rollNo: string
  photo: File
}
Response: {
  success: boolean
  message: string
  filename: string
  path: string
}
```

### `/api/generate-admit-card`
```typescript
POST /api/generate-admit-card
Body: {
  rollNo: string
}
Response: HTML document (admit card)
```

## File Structure

```
app/
├── api/
│   ├── save-photo/
│   │   └── route.ts          [NEW] - Save photos locally
│   ├── generate-admit-card/
│   │   └── route.ts          [NEW] - Generate admit cards
│   └── rtu-upload/
│       └── route.ts          [MODIFIED] - Now saves photos locally
└── students/
    └── [rollNo]/
        └── page.tsx          [MODIFIED] - Added Change PFP modal & functionality

public/
└── student_photos/
    ├── photo_24EJCAD001.jpg
    ├── photo_24EJCAD002.jpg
    └── ... (standardized filenames)
```

## How It Works

### Upload Flow:
1. **RTU Portal Upload**:
   - User uploads photo via "Upload to RTU Portal" form
   - Photo is uploaded to RTU Portal
   - On success, photo is automatically saved locally as `photo_ROLLNO.jpg`

2. **Direct Photo Change**:
   - User clicks "Change Profile Photo" button
   - Uploads new photo in modal
   - Photo is saved as `photo_ROLLNO.jpg` (overwrites old)
   - No RTU upload involved

### Admit Card Generation:
1. User clicks "Download Admit Card"
2. API fetches student data from Supabase
3. Checks for local photo file (`photo_ROLLNO.jpg` or `.png`)
4. Generates HTML admit card with photo
5. Opens in new window with auto-print dialog
6. Photo in admit card is always the latest uploaded

## Key Features

✅ **Consistent Naming**: All photos use `photo_ROLLNO.ext` format
✅ **Automatic Overwrite**: New uploads replace old files with same name
✅ **Dual Upload Methods**: RTU upload OR direct profile photo change
✅ **Real-time Updates**: Photos immediately reflect in admit cards
✅ **Beautiful Design**: Modern gradient admit card with professional layout
✅ **Validation**: File size and type validation on all uploads
✅ **Error Handling**: Graceful fallbacks with placeholder avatars
✅ **Auto-Print**: Admit cards open in new window ready to print

## Usage Examples

### Change Profile Photo:
1. Go to student profile page
2. Click "Change Profile Photo" button
3. Select new photo
4. Click "Update Photo"
5. Photo is updated and will appear in admit cards

### Generate Admit Card:
1. Go to student profile page
2. Click "Download Admit Card" button
3. Admit card opens in new window with current photo
4. Print dialog appears automatically

### Download Photo:
1. Go to student profile page
2. Click "Download Photo" button
3. Current photo file downloads to computer

## Notes

- Photos are stored in `/public/student_photos/` which is web-accessible
- Standardized filenames make photo management easier
- Old photos are automatically replaced when new ones are uploaded
- Admit cards always use the latest photo from local storage
- System gracefully handles missing photos with placeholder avatars
