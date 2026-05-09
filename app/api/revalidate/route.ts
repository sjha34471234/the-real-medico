import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(req: Request) {
  try {
    const { secret } = await req.json()

    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    revalidatePath('/shop')
    revalidatePath('/')
    revalidatePath('/trending')

    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 })
  }
}

export async function GET() {
  // Allow admin to trigger revalidation from browser
  revalidatePath('/shop')
  revalidatePath('/')
  return NextResponse.json({ revalidated: true, timestamp: new Date().toISOString() })
}
