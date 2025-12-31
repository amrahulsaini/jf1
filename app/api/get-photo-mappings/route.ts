import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rollNo = searchParams.get('rollNo')

    if (rollNo) {
      // Get mapping for specific student
      const { data: mapping, error } = await (supabase
        .from('photo_mappings') as any)
        .select('*')
        .eq('roll_no', rollNo.toUpperCase())
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('[Get Photo Mappings] Database error:', error)
      }

      return NextResponse.json({
        success: true,
        rollNo: rollNo.toUpperCase(),
        mapping: mapping || null
      })
    }

    // Get all mappings
    const { data: mappings, error } = await (supabase
      .from('photo_mappings') as any)
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[Get Photo Mappings] Database error:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: mappings?.length || 0,
      mappings: mappings || []
    })

  } catch (error) {
    console.error('[Get Photo Mappings] Error:', error)
    return NextResponse.json({
      error: 'Failed to get photo mappings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
