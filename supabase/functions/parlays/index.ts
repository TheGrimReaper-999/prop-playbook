import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParlayLeg {
  playerId: string;
  playerName: string;
  teamName: string;
  stat: string;
  line: number;
  pick: 'over' | 'under';
  odds: number;
  modelProb: number;
  edge: number;
}

interface Parlay {
  id: string;
  name: string;
  legs: ParlayLeg[];
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user IP from headers (x-forwarded-for or x-real-ip)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const userIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
    
    console.log(`[parlays] Request from IP: ${userIp}, Method: ${req.method}`);

    const url = new URL(req.url);
    const method = req.method;

    // GET - Fetch all parlays for this IP
    if (method === 'GET') {
      console.log(`[parlays] Fetching parlays for IP: ${userIp}`);
      
      const { data, error } = await supabase
        .from('parlays')
        .select('*')
        .eq('user_ip', userIp)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[parlays] Error fetching parlays:`, error);
        throw error;
      }

      console.log(`[parlays] Found ${data?.length || 0} parlays`);
      
      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Create a new parlay
    if (method === 'POST') {
      const body = await req.json();
      const { name, legs } = body;

      console.log(`[parlays] Creating parlay "${name}" with ${legs?.length || 0} legs`);

      const { data, error } = await supabase
        .from('parlays')
        .insert({
          user_ip: userIp,
          name: name || 'Untitled Parlay',
          legs: legs || [],
        })
        .select()
        .single();

      if (error) {
        console.error(`[parlays] Error creating parlay:`, error);
        throw error;
      }

      console.log(`[parlays] Created parlay with ID: ${data.id}`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    }

    // PUT - Update a parlay (rename)
    if (method === 'PUT') {
      const body = await req.json();
      const { id, name, legs } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'Parlay ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`[parlays] Updating parlay ${id}`);

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (legs !== undefined) updateData.legs = legs;

      const { data, error } = await supabase
        .from('parlays')
        .update(updateData)
        .eq('id', id)
        .eq('user_ip', userIp) // Ensure user can only update their own
        .select()
        .single();

      if (error) {
        console.error(`[parlays] Error updating parlay:`, error);
        throw error;
      }

      console.log(`[parlays] Updated parlay ${id}`);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE - Delete a parlay
    if (method === 'DELETE') {
      // Try to get ID from query params first, then from body
      let parlayId = url.searchParams.get('id');
      
      if (!parlayId) {
        try {
          const body = await req.json();
          parlayId = body.id;
        } catch {
          // No body provided
        }
      }

      if (!parlayId) {
        return new Response(JSON.stringify({ error: 'Parlay ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`[parlays] Deleting parlay ${parlayId}`);

      const { error } = await supabase
        .from('parlays')
        .delete()
        .eq('id', parlayId)
        .eq('user_ip', userIp); // Ensure user can only delete their own

      if (error) {
        console.error(`[parlays] Error deleting parlay:`, error);
        throw error;
      }

      console.log(`[parlays] Deleted parlay ${parlayId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error(`[parlays] Unhandled error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});