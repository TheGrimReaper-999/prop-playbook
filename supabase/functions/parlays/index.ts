import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[parlays] No auth header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Create authenticated client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('[parlays] Auth error:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log(`[parlays] Request from user: ${userId}, Method: ${req.method}`);

    const url = new URL(req.url);
    const method = req.method;

    // GET - Fetch all parlays for this user
    if (method === 'GET') {
      console.log(`[parlays] Fetching parlays for user: ${userId}`);
      
      const { data, error } = await supabase
        .from('parlays')
        .select('*')
        .eq('user_id', userId)
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

    // POST - Create a new parlay (or perform action-based operations)
    if (method === 'POST') {
      const body = await req.json();
      const { action } = body;

      // Action: delete (workaround for DELETE transport issues in some environments)
      if (action === 'delete') {
        const parlayId = body.id as string | undefined;

        if (!parlayId) {
          return new Response(JSON.stringify({ error: 'Parlay ID is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        console.log(`[parlays] Deleting parlay ${parlayId} for user: ${userId} (via POST action)`);

        const { error } = await supabase
          .from('parlays')
          .delete()
          .eq('id', parlayId)
          .eq('user_id', userId);

        if (error) {
          console.error(`[parlays] Error deleting parlay:`, error);
          throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Default: create
      const { name, legs } = body;

      console.log(`[parlays] Creating parlay "${name}" with ${legs?.length || 0} legs for user: ${userId}`);

      const { data, error } = await supabase
        .from('parlays')
        .insert({
          user_id: userId,
          user_ip: 'authenticated', // Legacy field
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

    // PUT - Update a parlay
    if (method === 'PUT') {
      const body = await req.json();
      const { id, name, legs, pnl } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'Parlay ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      console.log(`[parlays] Updating parlay ${id} for user: ${userId}`);

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (legs !== undefined) updateData.legs = legs;
      if (pnl !== undefined) updateData.pnl = pnl;

      const { data, error } = await supabase
        .from('parlays')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId)
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

      console.log(`[parlays] Deleting parlay ${parlayId} for user: ${userId}`);

      const { error } = await supabase
        .from('parlays')
        .delete()
        .eq('id', parlayId)
        .eq('user_id', userId);

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
