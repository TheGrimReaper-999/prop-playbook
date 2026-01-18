import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'nba-api-free-data.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

interface Player {
  id: string;
  fullName: string;
  image?: string;
  headShotUrl?: string;
}

interface ApiResponse {
  status?: string;
  response?: {
    PlayerList?: Player[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('RAPIDAPI_NBA_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey) throw new Error('RAPIDAPI_NBA_KEY not configured');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase credentials not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all teams from database
    const { data: teams, error: teamsError } = await supabase
      .from('nba_teams')
      .select('team_id, name')
      .not('team_id', 'is', null);

    if (teamsError) throw teamsError;
    console.log(`Found ${teams.length} teams to fetch players for`);

    // Clear existing players
    const { error: deleteError } = await supabase.from('nba_players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) {
      console.error('Error clearing players:', deleteError);
    }

    let totalPlayers = 0;
    const allPlayers: { full_name: string; team_name: string; image_url: string | null }[] = [];

    // Fetch players for each team
    for (const team of teams) {
      const url = `${BASE_URL}/nba-player-list?teamid=${team.team_id}`;
      console.log(`Fetching players for ${team.name} (teamid=${team.team_id})`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': apiKey,
          },
        });

        if (!response.ok) {
          console.error(`Failed to fetch team ${team.team_id}: ${response.status}`);
          continue;
        }

        const data: ApiResponse = await response.json();
        const playerList = data?.response?.PlayerList || [];
        
        console.log(`Found ${playerList.length} players for ${team.name}`);

        for (const player of playerList) {
          const playerName = player.fullName || 'Unknown';
          const imageUrl = player.image || player.headShotUrl || null;

          allPlayers.push({
            full_name: playerName,
            team_name: team.name,
            image_url: imageUrl,
          });
          totalPlayers++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error fetching team ${team.team_id}:`, error);
      }
    }

    // Insert all players in batches
    const batchSize = 50;
    for (let i = 0; i < allPlayers.length; i += batchSize) {
      const batch = allPlayers.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from('nba_players').insert(batch);
      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize}:`, insertError);
      }
    }

    console.log(`Successfully inserted ${totalPlayers} players`);

    return new Response(JSON.stringify({ 
      success: true, 
      totalPlayers,
      message: `Populated ${totalPlayers} players from ${teams.length} teams` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to populate players';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
