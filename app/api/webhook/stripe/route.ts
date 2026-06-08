import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Supabase client initialization
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: Request) {
  try {
    // 1. Fetching the raw payload string from the incoming Stripe webhook stream
    const rawBody = await request.text();
    const event = JSON.parse(rawBody);

    // 2. Extracting core stripe parameters
    const eventType = event.type;
    console.log(`💳 Stripe Webhook Node Signal Received: ${eventType}`);

    // Target payload execution when a payment checkout session passes successfully
    if (eventType === 'checkout.session.completed') {
      const session = event.data.object;
      
      const paymentIntentId = session.payment_intent;
      
      // Pulling target custom metadata tracking tokens
      const cartId = session.metadata?.cartId;

      console.log(`✨ Processing successful checkout for Cart reference ID: ${cartId || 'N/A'}`);

      if (cartId) {
        // 3. Database Sync: Mark the checkout ledger node as completely 'Recovered'
        // (Yeh wo lines hain jo screenshot me missing thin)
        const { error: dbError } = await supabase
          .from('carts')
          .update({ 
            delivery_status: 'Recovered', 
            payment_status: 'Paid',
            stripe_payment_id: paymentIntentId,
            recovered_at: new Date().toISOString()
          })
          .eq('id', cartId);

        if (dbError) {
          throw new Error(`Supabase synchronization exception: ${dbError.message}`);
        }

        console.log(`🟢 Success: Cart state reference ${cartId} updated to RECOVERED in master records.`);
      } else {
        console.log(`ℹ️ Webhook processed successfully, but no direct tracking metadata cartId token found.`);
      }
    }

    // Returning successful status payload back to Stripe
    return NextResponse.json({ received: true, status: "Handled Securely" }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Stripe Webhook Operational Engine Collision:", error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Webhook processing routing breakdown" 
    }, { status: 400 });
  }
}