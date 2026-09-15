import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIDiagnosisResult {
  diagnosis: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  estimated_min: number;
  estimated_max: number;
  parts_estimate: number;
  labor_estimate: number;
  recommendation: string;
}

// 7. Provider-independent AI service layer
// 8. Clearly marked development/mock provider
async function analyzeRepairProblem(
  serviceName: string, 
  description: string, 
  mediaCount: number
): Promise<{ result: AIDiagnosisResult; raw: any }> {
  
  // Simulate network delay for AI processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  const result: AIDiagnosisResult = {
    diagnosis: `Based on your description of "${description.slice(0, 30)}...", this appears to be a typical ${serviceName} issue.`,
    severity: "MEDIUM",
    confidence: 85.5,
    estimated_min: 350.00,
    estimated_max: 900.00,
    parts_estimate: 400.00,
    labor_estimate: 300.00,
    recommendation: `Ensure the appliance is disconnected from power before technicians arrive. ${mediaCount > 0 ? 'Your attached media has been reviewed.' : ''}`,
  };

  return {
    result,
    raw: {
      provider: "MockAI",
      model: "mock-v1-dev",
      note: "DEVELOPMENT MOCK - NOT REAL AI",
      input_tokens: 42,
      output_tokens: 156,
      latency_ms: 2000
    }
  };
}

serve(async (req) => {
  // 12. Add appropriate CORS handling for the Expo mobile app
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Accept POST JSON
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json()
    const { request_id } = body

    // 2. Validate request_id as a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!request_id || !uuidRegex.test(request_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing request_id UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Authenticate the caller using the Supabase Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // Client initialized with user's Auth header to strictly verify their identity
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized caller' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 9. Privileged server-side access to read/write without RLS barriers
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Verify that the authenticated user owns the requested service_request
    const { data: serviceRequest, error: srError } = await adminClient
      .from('service_requests')
      .select(`
        id,
        customer_id,
        description,
        services ( name )
      `)
      .eq('id', request_id)
      .single();

    if (srError || !serviceRequest) {
      console.error('Service request fetch error:', srError);
      return new Response(
        JSON.stringify({ error: 'Service request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (serviceRequest.customer_id !== user.id) {
      console.error('Forbidden mismatch:', { reqCustomer: serviceRequest.customer_id, authUserId: user.id });
      return new Response(
        JSON.stringify({ error: 'Forbidden. You do not own this service request.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Fetch service_request_media
    const { data: mediaFiles, error: mediaError } = await adminClient
      .from('service_request_media')
      .select('id, storage_path, media_type, file_name')
      .eq('request_id', request_id);

    if (mediaError) {
      console.error('Media fetch error:', mediaError);
      throw new Error('Failed to fetch media metadata');
    }

    // 6. Private Storage URLs are NOT exposed publicly here. We only pass metadata count to AI.
    
    // 9. Insert/update public.ai_diagnoses (Status = PROCESSING)
    const { error: upsertError } = await adminClient
      .from('ai_diagnoses')
      .upsert({
        request_id,
        status: 'PROCESSING',
      }, { onConflict: 'request_id' });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      throw new Error('Failed to initialize diagnosis processing');
    }

    let analysisResult;
    try {
      const serviceName = serviceRequest.services?.name || 'Unknown Service';
      
      // Execute provider-independent analysis
      analysisResult = await analyzeRepairProblem(
        serviceName, 
        serviceRequest.description, 
        mediaFiles?.length || 0
      );
      
      // On success: status = COMPLETED, save structured result & JSONB
      const { error: completeError } = await adminClient
        .from('ai_diagnoses')
        .update({
          status: 'COMPLETED',
          diagnosis: analysisResult.result.diagnosis,
          severity: analysisResult.result.severity,
          confidence: analysisResult.result.confidence,
          estimated_min: analysisResult.result.estimated_min,
          estimated_max: analysisResult.result.estimated_max,
          parts_estimate: analysisResult.result.parts_estimate,
          labor_estimate: analysisResult.result.labor_estimate,
          recommendation: analysisResult.result.recommendation,
          raw_response: analysisResult.raw,
        })
        .eq('request_id', request_id);

      if (completeError) throw completeError;

    } catch (analysisException) {
      // On failure: status = FAILED
      await adminClient
        .from('ai_diagnoses')
        .update({ 
          status: 'FAILED', 
          raw_response: { error: String(analysisException) } 
        })
        .eq('request_id', request_id);
        
      throw analysisException;
    }

    // 11. Return exact JSON format
    return new Response(
      JSON.stringify({
        success: true,
        diagnosis: analysisResult.result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // 10. Make sure errors never expose API keys or service_role key
    // Map error to safe string
    const safeError = error instanceof Error ? error.message : 'Unknown server error';
    return new Response(
      JSON.stringify({ error: safeError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
