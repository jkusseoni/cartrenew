import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { cartId } = await req.json()
    
    // TODO: Add Supabase logic here
    // For now, return success to fix build
    return NextResponse.json({ success: true, cartId })
    
  } catch (error: any) {
    console.error('Send WhatsApp error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}