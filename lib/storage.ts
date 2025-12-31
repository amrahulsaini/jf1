import { supabase } from './supabase'

const BUCKET_NAME = 'student-photos'

export async function uploadToStorage(
  file: File,
  filename: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true, // Replace if exists
      })

    if (error) {
      console.error('[Storage] Upload error:', error)
      return { success: false, error: error.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename)

    return { success: true, url: urlData.publicUrl }
  } catch (error) {
    console.error('[Storage] Upload exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export function getPhotoUrl(rollNo: string, extension: string = 'jpg'): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`photo_${rollNo}.${extension}`)
  return data.publicUrl
}

export function getSignatureUrl(rollNo: string, extension: string = 'jpg'): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(`signature_${rollNo}.${extension}`)
  return data.publicUrl
}

export async function checkPhotoExists(rollNo: string): Promise<{
  exists: boolean
  url?: string
  extension?: string
}> {
  // Try jpg first
  const { data: jpgData, error: jpgError } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', {
      search: `photo_${rollNo}.jpg`,
    })

  if (!jpgError && jpgData && jpgData.length > 0) {
    return {
      exists: true,
      url: getPhotoUrl(rollNo, 'jpg'),
      extension: 'jpg',
    }
  }

  // Try png
  const { data: pngData, error: pngError } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', {
      search: `photo_${rollNo}.png`,
    })

  if (!pngError && pngData && pngData.length > 0) {
    return {
      exists: true,
      url: getPhotoUrl(rollNo, 'png'),
      extension: 'png',
    }
  }

  return { exists: false }
}
