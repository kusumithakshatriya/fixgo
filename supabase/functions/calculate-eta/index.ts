import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface Destination extends Coordinate {
  technicianId: string;
}

interface RequestBody {
  origin: Coordinate;
  destinations: Destination[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json() as RequestBody
    const { origin, destinations } = body

    if (!origin || !origin.latitude || !origin.longitude) {
      throw new Error('Valid origin is required');
    }

    if (!Array.isArray(destinations) || destinations.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (destinations.length > 20) {
      throw new Error('Maximum 20 destinations allowed per request');
    }

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized caller' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY is not configured');
      throw new Error('Server configuration error');
    }

    const googlePayload = {
      origins: [
        {
          waypoint: {
            location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } }
          }
        }
      ],
      destinations: destinations.map(d => ({
        waypoint: {
          location: { latLng: { latitude: d.latitude, longitude: d.longitude } }
        }
      })),
      travelMode: "DRIVE"
    };

    const googleResponse = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition'
      },
      body: JSON.stringify(googlePayload)
    });

    if (!googleResponse.ok) {
      // Log the actual error internally, but don't expose upstream error to client
      const errorText = await googleResponse.text();
      console.error('Google Routes API Error:', googleResponse.status, errorText);
      throw new Error('Routing service unavailable');
    }

    const routesResult = await googleResponse.json();

    const results = destinations.map((dest, index) => {
      // Google returns an array of elements. Find the element matching this destination index.
      const routeData = routesResult.find((r: any) => r.destinationIndex === index);
      
      let roadDistanceKm: number | null = null;
      let etaMins: number | null = null;

      if (routeData && (routeData.condition === 'ROUTE_EXISTS' || routeData.distanceMeters !== undefined)) {
        if (routeData.distanceMeters !== undefined) {
          roadDistanceKm = routeData.distanceMeters / 1000;
        }
        if (routeData.duration) {
          // Duration is returned like "900s"
          const seconds = parseInt(routeData.duration.replace('s', ''), 10);
          if (!isNaN(seconds)) {
            etaMins = Math.round(seconds / 60);
          }
        }
      }

      return {
        technicianId: dest.technicianId,
        roadDistanceKm,
        etaMins
      };
    });

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const safeError = error instanceof Error ? error.message : 'Unknown server error';
    return new Response(
      JSON.stringify({ error: safeError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
