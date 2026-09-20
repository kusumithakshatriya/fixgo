import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createHmac, timingSafeEqual } from "node:crypto"

serve(async (req) => {
  try {
    const signature = req.headers.get('x-razorpay-signature')
    if (!signature) throw new Error('Missing signature')

    const payload = await req.text()
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!secret) throw new Error('Webhook secret not configured')

    const generated_signature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (!timingSafeEqual(Buffer.from(generated_signature), Buffer.from(signature))) {
      throw new Error('Invalid webhook signature')
    }

    const event = JSON.parse(payload)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const paymentEntity = event.payload.payment.entity
      const order_id = paymentEntity.order_id
      const payment_id = paymentEntity.id
      const amount = paymentEntity.amount

      const { error: vError } = await supabaseAdmin.rpc('webhook_payment_completion', {
        p_event_id: event.id,
        p_event_type: event.event,
        p_gateway_order_id: order_id,
        p_gateway_payment_id: payment_id,
        p_amount: amount
      })

      if (vError) {
        console.error('Webhook completion error:', vError)
        return new Response('Completion logic failed', { status: 400 })
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { 'Content-Type': 'application/json' }, status: 200 
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
