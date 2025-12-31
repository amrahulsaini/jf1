import { NextRequest, NextResponse } from 'next/server'
import { incrementMediaUpdate, readMediaUpdates } from '@/lib/media-updates'

export const runtime = 'nodejs'

export async function GET() {
  const db = await readMediaUpdates()
  return NextResponse.json({ success: true, data: db })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rollNo = String(body?.rollNo || '')
    const type = body?.type === 'signature' ? 'signature' : 'photo'
    await incrementMediaUpdate(rollNo, type)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
