import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rollNo = searchParams.get('rollNo')

    const dataDir = join(process.cwd(), 'data')
    const mappingFile = join(dataDir, 'photo-mappings.json')

    if (!existsSync(mappingFile)) {
      return NextResponse.json({
        success: true,
        mappings: {},
        message: 'No mappings file found'
      })
    }

    const data = await readFile(mappingFile, 'utf-8')
    const mappings = JSON.parse(data)

    // If rollNo is provided, return only that student's mapping
    if (rollNo) {
      return NextResponse.json({
        success: true,
        rollNo: rollNo,
        mapping: mappings[rollNo] || null
      })
    }

    // Otherwise return all mappings
    return NextResponse.json({
      success: true,
      mappings: mappings
    })

  } catch (error) {
    console.error('[Get Photo Mappings] Error:', error)
    return NextResponse.json({
      error: 'Failed to get photo mappings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
