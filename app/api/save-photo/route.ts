import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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
    
    // Define the public directory path
    const publicDir = join(process.cwd(), 'public', 'student_photos')
    const dataDir = join(process.cwd(), 'data')
    
    // Ensure directories exist
    if (!existsSync(publicDir)) {
      await mkdir(publicDir, { recursive: true })
    }
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true })
    }

    // Convert File to Buffer
    const bytes = await photo.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save with standardized filename
    const standardPath = join(publicDir, standardFilename)
    await writeFile(standardPath, buffer)
    console.log(`[Save Photo] Saved standardized photo: ${standardFilename}`)

    // Load and update filename mappings
    const mappingFile = join(dataDir, 'photo-mappings.json')
    let mappings: Record<string, { originalPhoto?: string, originalSignature?: string }> = {}
    try {
      if (existsSync(mappingFile)) {
        const data = await readFile(mappingFile, 'utf-8')
        mappings = JSON.parse(data)
      }
    } catch (e) {
      console.log('[Save Photo] Creating new mappings file')
    }

    // Initialize mapping for this roll number if not exists
    if (!mappings[rollNo]) {
      mappings[rollNo] = {}
    }

    // If original filename is provided or we can determine it, save with that name too
    const originalName = originalFileName || photo.name
    const savedOriginalFiles: string[] = []
    
    if (originalName && originalName !== standardFilename) {
      const originalPath = join(publicDir, originalName)
      await writeFile(originalPath, buffer)
      console.log(`[Save Photo] Saved original photo: ${originalName}`)
      mappings[rollNo].originalPhoto = originalName
      savedOriginalFiles.push(originalName)
    }

    // Save updated mappings
    try {
      await writeFile(mappingFile, JSON.stringify(mappings, null, 2))
      console.log(`[Save Photo] Updated filename mappings for ${rollNo}`)
    } catch (e) {
      console.error('[Save Photo] Failed to save mappings:', e)
    }

    return NextResponse.json({
      success: true,
      message: 'Photo saved successfully',
      standardFilename: standardFilename,
      originalFilenames: savedOriginalFiles,
      standardPath: `/student_photos/${standardFilename}`,
      mappings: mappings[rollNo]
    })

  } catch (error) {
    console.error('[Save Photo] Error:', error)
    return NextResponse.json({
      error: 'Failed to save photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
