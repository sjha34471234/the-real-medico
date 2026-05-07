import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert([{ email, created_at: new Date().toISOString() }])

    if (error && error.code !== '23505') {
      throw error
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }
}
