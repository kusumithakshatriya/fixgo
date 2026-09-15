import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Razorpay from "npm:razorpay@2.9.2"

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

    const { booking_id } = await req.json()
    if (!booking_id) throw new Error('booking_id required')

    // Call create_or_get_payment to get safely calculated final_amount
    // We use the service_role key to bypass RLS on the set_razorpay_order later
    // but we use user auth for create_or_get_payment to ensure ownership
    const { data: payment, error: pError } = await supabaseClient.rpc('create_or_get_payment', { p_booking_id: booking_id })
    if (pError || !payment) throw new Error(`Failed to get payment: ${pError?.message}`)

    if (payment.status === 'completed') {
      throw new Error('Payment already completed')
    }

    if (payment.gateway_order_id && payment.status === 'order_created') {
      return new Response(
        JSON.stringify({
          key_id: Deno.env.get('RAZORPAY_KEY_ID'),
          order_id: payment.gateway_order_id,
          amount: payment.final_amount * 100,
          currency: 'INR',
          payment_id: payment.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Generate new order
    const instance = new Razorpay({
      key_id: Deno.env.get('RAZORPAY_KEY_ID'),
      key_secret: Deno.env.get('RAZORPAY_KEY_SECRET'),
    });

    const amountInPaise = Math.round(payment.final_amount * 100);
    const orderOptions = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_${payment.id}`
    };

    const order = await instance.orders.create(orderOptions);

    // Save order in db using service role to update fields securely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: sError } = await supabaseAdmin.rpc('set_razorpay_order', {
      p_payment_id: payment.id,
      p_order_id: order.id
    })
    
    if (sError) throw new Error(`Failed to set order id: ${sError.message}`)

    return new Response(
      JSON.stringify({
        key_id: Deno.env.get('RAZORPAY_KEY_ID'),
        order_id: order.id,
        amount: amountInPaise,
        currency: 'INR',
        payment_id: payment.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
