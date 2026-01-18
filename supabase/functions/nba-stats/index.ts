import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'nba-api-free-data.p.rapidapi.com';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, params } = await req.json();
    const apiKey = Deno.env.get('RAPIDAPI_NBA_KEY');
    
    if (!apiKey) {
      console.error('RAPIDAPI_NBA_KEY is not configured');
      throw new Error('API key not configured');
    }

    // Build URL with query params
    let url = `https://${RAPIDAPI_HOST}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    console.log(`Fetching NBA data from: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`RapidAPI error: ${response.status} - ${errorText}`);
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully fetched NBA data');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NBA data';
    console.error('Error in nba-stats function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
