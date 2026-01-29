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

      // Action: update (workaround for PUT transport issues in some environments)
      if (action === 'update') {
        const parlayId = body.id as string | undefined;
        const { name, legs, pnl } = body;

        if (!parlayId) {
          return new Response(JSON.stringify({ error: 'Parlay ID is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (legs !== undefined) updateData.legs = legs;
        if (pnl !== undefined) updateData.pnl = pnl;

        console.log(`[parlays] Updating parlay ${parlayId} for user: ${userId} (via POST action)`);

        const { data, error } = await supabase
          .from('parlays')
          .update(updateData)
          .eq('id', parlayId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          console.error(`[parlays] Error updating parlay:`, error);
          throw error;
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Action: delete_leg - Remove a specific leg from a parlay and clean up predictions
      if (action === 'delete_leg') {
        const parlayId = body.id as string | undefined;
        const legId = body.legId as string | undefined;

        if (!parlayId || !legId) {
          return new Response(JSON.stringify({ error: 'Parlay ID and Leg ID are required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        console.log(`[parlays] Deleting leg ${legId} from parlay ${parlayId} for user: ${userId}`);

        // First, get the current parlay to find the leg details
        const { data: parlay, error: fetchError } = await supabase
          .from('parlays')
          .select('legs')
          .eq('id', parlayId)
          .eq('user_id', userId)
          .single();

        if (fetchError || !parlay) {
          console.error(`[parlays] Error fetching parlay:`, fetchError);
          return new Response(JSON.stringify({ error: 'Parlay not found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }

        const legs = Array.isArray(parlay.legs) ? parlay.legs : [];
        const legToDelete = legs.find((l: { legId?: string }) => l.legId === legId);
        const updatedLegs = legs.filter((l: { legId?: string }) => l.legId !== legId);

        // Update parlay with remaining legs
        const { data: updatedParlay, error: updateError } = await supabase
          .from('parlays')
          .update({ legs: updatedLegs })
          .eq('id', parlayId)
          .eq('user_id', userId)
          .select()
          .single();

        if (updateError) {
          console.error(`[parlays] Error updating parlay:`, updateError);
          throw updateError;
        }

        // Delete associated prediction if it exists (use service role for this)
        // We match on parlay_id + player_name + stat_type to find the right prediction
        if (legToDelete) {
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (serviceRoleKey) {
            const adminClient = createClient(supabaseUrl, serviceRoleKey);
            const { error: predError } = await adminClient
              .from('predictions')
              .delete()
              .eq('parlay_id', parlayId)
              .eq('player_name', legToDelete.player?.name || '')
              .eq('stat_type', legToDelete.statType || '');
            
            if (predError) {
              console.warn(`[parlays] Failed to delete prediction (non-critical):`, predError);
            } else {
              console.log(`[parlays] Deleted prediction for ${legToDelete.player?.name} ${legToDelete.statType}`);
            }

            // Also clean up error tracker if this was the only prediction for this player/stat combo
            // Check if there are other predictions for this player/stat_type
            const { data: remainingPreds } = await adminClient
              .from('predictions')
              .select('id')
              .eq('player_name', legToDelete.player?.name || '')
              .eq('stat_type', legToDelete.statType || '')
              .limit(1);

            if (!remainingPreds || remainingPreds.length === 0) {
              // Find and delete the error tracker entry
              const { data: player } = await adminClient
                .from('nba_players')
                .select('id')
                .eq('full_name', legToDelete.player?.name || '')
                .single();

              if (player) {
                const { error: trackerError } = await adminClient
                  .from('player_error_trackers')
                  .delete()
                  .eq('player_id', player.id)
                  .eq('stat_type', legToDelete.statType || '');
                
                if (!trackerError) {
                  console.log(`[parlays] Deleted error tracker for ${legToDelete.player?.name} ${legToDelete.statType}`);
                }
              }
            }
          }
        }

        console.log(`[parlays] Leg deleted. Parlay now has ${updatedLegs.length} legs.`);

        return new Response(JSON.stringify(updatedParlay), {
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
