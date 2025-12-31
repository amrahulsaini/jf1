import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const rollNo = formData.get('rollNo') as string
    const photo = formData.get('photo') as File | null
    const originalFileName = formData.get('originalFileName') as string | null

    if (!rollNo) {
      return NextResponse.json({ error: 'Roll number required' }, { status: 400 })
    }

    if (!photo) {
      return NextResponse.json({ error: 'Photo file required' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (photo.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo size must be less than 5MB' }, { status: 400 })
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(photo.type)) {
      return NextResponse.json({ error: 'Photo must be JPG, JPEG or PNG' }, { status: 400 })
    }

    // Get file extension
    const extension = photo.type === 'image/png' ? 'png' : 'jpg'
    
    // Create standardized filename: photo_ROLLNO.ext
    const standardFilename = `photo_${rollNo}.${extension}`
    
    // Upload to Supabase Storage
    console.log(`[Save Photo] Uploading ${standardFilename} to Supabase Storage...`)
    const uploadResult = await uploadToStorage(photo, standardFilename)
    
    if (!uploadResult.success) {
      return NextResponse.json({
        error: 'Failed to upload photo',
        details: uploadResult.error
      }, { status: 500 })
    }

    console.log(`[Save Photo] Successfully uploaded: ${standardFilename}`)

    // Save original filename mapping in Supabase database
    const originalName = originalFileName || photo.name
    
    console.log(`[Save Photo] Original name: ${originalName}, Standard name: ${standardFilename}`)
    
    // ALWAYS save mapping - even if names match, we want to track the upload
    if (originalName !== standardFilename) {
      // Also upload with original filename
      const originalUpload = await uploadToStorage(photo, originalName)
      console.log(`[Save Photo] Uploaded original filename: ${originalName}`)
    }
    
    // Store mapping in database
    console.log(`[Save Photo] Saving to database: roll_no=${rollNo}, original_photo=${originalName}`)
    const { data, error: dbError } = await (supabase
      .from('photo_mappings') as any)
      .upsert({
        roll_no: rollNo.toUpperCase(),
        original_photo: originalName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'roll_no'
      })
    
    if (dbError) {
      console.error('[Save Photo] ❌ Failed to save mapping:', dbError)
    } else {
      console.log('[Save Photo] ✅ Successfully saved mapping to database')
    }

    return NextResponse.json({
      success: true,
      message: 'Photo saved successfully',
      standardFilename: standardFilename,
      photoUrl: uploadResult.url,
      originalFilename: originalName !== standardFilename ? originalName : undefined
    })

  } catch (error) {
    console.error('[Save Photo] Error:', error)
    return NextResponse.json({
      error: 'Failed to save photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
