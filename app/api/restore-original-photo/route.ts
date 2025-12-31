import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const BUCKET_NAME = 'student-photos'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rollNo } = body

    if (!rollNo) {
      return NextResponse.json({
        success: false,
        error: 'Roll number is required'
      }, { status: 400 })
    }

    const rollNoUpper = rollNo.toUpperCase()

    // Get the mapping to find original filenames
    const { data: mapping, error: mappingError } = await (supabase
      .from('photo_mappings') as any)
      .select('*')
      .eq('roll_no', rollNoUpper)
      .single()

    if (mappingError || !mapping) {
      return NextResponse.json({
        success: false,
        error: 'No original photo mapping found for this student'
      }, { status: 404 })
    }

    const results = {
      photo: { success: false, message: '' },
      signature: { success: false, message: '' }
    }

    // Restore Photo
    if (mapping.original_photo) {
      try {
        console.log(`[Restore Original] Attempting to download: ${mapping.original_photo}`)
        
        // Download original photo from Supabase Storage
        const { data: originalPhotoData, error: downloadError } = await supabase
          .storage
          .from(BUCKET_NAME)
          .download(mapping.original_photo)

        if (downloadError) {
          console.error(`[Restore Original] Download error:`, downloadError)
          results.photo.message = `Failed to download original: ${downloadError.message} - File may not exist in storage. Upload a new photo first.`
        } else {
          console.log(`[Restore Original] Successfully downloaded ${mapping.original_photo}, size: ${originalPhotoData.size} bytes`)
          
          // Upload it as the standardized photo
          const standardPhotoName = `photo_${rollNoUpper}.jpg`
          const { error: uploadError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(standardPhotoName, originalPhotoData, {
              upsert: true,
              contentType: 'image/jpeg'
            })

          if (uploadError) {
            console.error(`[Restore Original] Upload error:`, uploadError)
            results.photo.message = `Failed to restore photo: ${uploadError.message}`
          } else {
            results.photo.success = true
            results.photo.message = 'Photo restored successfully'
            console.log(`[Restore Original] Restored photo for ${rollNoUpper}: ${mapping.original_photo} → ${standardPhotoName}`)
          }
        }
      } catch (error: any) {
        console.error(`[Restore Original] Exception:`, error)
        results.photo.message = `Error: ${error.message}`
      }
    } else {
      results.photo.message = 'No original photo found in database'
    }

    // Restore Signature
    if (mapping.original_signature) {
      try {
        // Download original signature from Supabase Storage
        const { data: originalSignData, error: downloadError } = await supabase
          .storage
          .from(BUCKET_NAME)
          .download(mapping.original_signature)

        if (downloadError) {
          results.signature.message = `Failed to download original: ${downloadError.message}`
        } else {
          // Upload it as the standardized signature
          const standardSignName = `sign_${rollNoUpper}.jpg`
          const { error: uploadError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(standardSignName, originalSignData, {
              upsert: true,
              contentType: 'image/jpeg'
            })

          if (uploadError) {
            results.signature.message = `Failed to restore signature: ${uploadError.message}`
          } else {
            results.signature.success = true
            results.signature.message = 'Signature restored successfully'
            console.log(`[Restore Original] Restored signature for ${rollNoUpper}: ${mapping.original_signature} → ${standardSignName}`)
          }
        }
      } catch (error: any) {
        results.signature.message = `Error: ${error.message}`
      }
    } else {
      results.signature.message = 'No original signature found'
    }

    const overallSuccess = results.photo.success || results.signature.success

    return NextResponse.json({
      success: overallSuccess,
      rollNo: rollNoUpper,
      results: results,
      message: overallSuccess 
        ? 'Original files restored successfully' 
        : 'Failed to restore original files'
    })

  } catch (error: any) {
    console.error('[Restore Original] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to restore original files'
    }, { status: 500 })
  }
}
