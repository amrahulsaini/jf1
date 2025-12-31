import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    const { rollNo, originalPhoto } = await request.json()

    console.log('Testing insert with:', { rollNo, originalPhoto })

    const { data, error } = await (supabase
      .from('photo_mappings') as any)
      .upsert({
        roll_no: rollNo.toUpperCase(),
        original_photo: originalPhoto,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'roll_no'
      })

    return NextResponse.json({
      success: !error,
      data,
      error: error?.message,
      errorDetails: error
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await (supabase
      .from('photo_mappings') as any)
      .select('*')
      .limit(10)

    return NextResponse.json({
      success: !error,
      count: data?.length || 0,
      data,
      error: error?.message
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}
