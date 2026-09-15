import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createHmac } from "node:crypto"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    // Auth check
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = await req.json()
    
    if (!payment_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      throw new Error('Missing parameters')
    }

    const secret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!secret) throw new Error('Secret not configured')

    const generated_signature = createHmac('sha256', secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      throw new Error('Invalid payment signature')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call verify_payment_completion (which contains idempotent logic + auth bounds check)
    // We use service role here because verify_payment_completion handles the logic. Wait, our verify doesn't check customer_id.
    // Let's explicitly check ownership first or just rely on the fact that only the user who created it has the signature?
    // Actually, verify_payment_completion does not check user_id. Let's add an explicit fetch first.
    const { data: payment } = await supabaseAdmin.from('payments').select('*').eq('id', payment_id).single()
    if (!payment) throw new Error('Payment not found')
    if (payment.customer_id !== user.id) throw new Error('Not authorized')

    const { error: vError } = await supabaseAdmin.rpc('client_payment_completion', {
      p_payment_id: payment_id,
      p_gateway_order_id: razorpay_order_id,
      p_gateway_payment_id: razorpay_payment_id,
      p_gateway_signature: razorpay_signature,
      p_amount: amount
    })

    if (vError) throw new Error(`Verification failed: ${vError.message}`)

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
