import { supabase } from '@/lib/supabase';

export type AIDiagnosisResult = {
  diagnosis: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  estimated_min: number;
  estimated_max: number;
  parts_estimate: number;
  labor_estimate: number;
  recommendation: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
};

export async function invokeDiagnoseRepair(requestId: string): Promise<AIDiagnosisResult> {
  console.log(`[ai-diagnosis] Invoking diagnose-repair for request: ${requestId}`);
  
  const { data: { session } } = await supabase.auth.getSession();
  
  const { data, error } = await supabase.functions.invoke('diagnose-repair', {
    body: { request_id: requestId },
    headers: session?.access_token ? {
      Authorization: `Bearer ${session.access_token}`
    } : undefined
  });

  if (error) {
    console.error('[ai-diagnosis] Edge Function invocation failed. Error object:', JSON.stringify({
      message: error.message,
      name: error.name,
      context: error.context,
    }, null, 2));
    
    // Sometimes `error` is a custom object from the supabase js client containing response status
    if (error instanceof Error) {
      console.error('[ai-diagnosis] Error instance message:', error.message);
    }
    
    throw new Error('Failed to analyze repair issue.');
  }

  console.log('[ai-diagnosis] Edge Function returned success:', JSON.stringify(data, null, 2));

  if (!data?.success || !data?.diagnosis) {
    throw new Error('Received malformed response from diagnosis service.');
  }

  return data.diagnosis as AIDiagnosisResult;
}

export async function getDiagnosis(requestId: string): Promise<AIDiagnosisResult | null> {
  const { data, error } = await supabase
    .from('ai_diagnoses')
    .select('*')
    .eq('request_id', requestId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Failed to fetch diagnosis:', error);
    throw new Error('Could not retrieve diagnosis.');
  }

  return data as AIDiagnosisResult;
}
