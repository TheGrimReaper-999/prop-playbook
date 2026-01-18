import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'nba-api-free-data.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('RAPIDAPI_NBA_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!apiKey || !supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: 'Missing required environment variables' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Return immediate response, do work in background
  const responsePromise = (async () => {
    try {
      console.log('Starting bulk population of fixtures and player stats...');
      
      // 1. Populate fixtures for the 2025-26 season (Oct 2025 - Apr 2026)
      // Current date: Jan 2026, so we go from Oct 22, 2025 to today
      const seasonStart = new Date('2025-10-22');
      const today = new Date();
      
      console.log(`Fetching fixtures from ${seasonStart.toISOString()} to ${today.toISOString()}`);
      
      const fixtures: any[] = [];
      const currentDate = new Date(seasonStart);
      let fixturesProcessed = 0;
      
      while (currentDate <= today) {
        const dateStr = currentDate.toISOString().slice(0, 10).replace(/-/g, '');
        
        try {
          const response = await fetch(`${BASE_URL}/nba-schedule-by-date?date=${dateStr}`, {
            method: 'GET',
            headers: {
              'x-rapidapi-host': RAPIDAPI_HOST,
              'x-rapidapi-key': apiKey,
            },
          });

          if (response.ok) {
            const data = await response.json();
            const events = data?.response?.Events || [];
            
            for (const event of events) {
              const homeTeam = event.competitors?.find((c: any) => c.isHome);
              const awayTeam = event.competitors?.find((c: any) => !c.isHome);
              
              if (homeTeam && awayTeam) {
                fixtures.push({
                  event_id: event.id,
                  game_date: event.date,
                  home_team_id: homeTeam.id,
                  home_team_name: homeTeam.displayName,
                  home_team_abbrev: homeTeam.abbrev,
                  home_team_logo: homeTeam.logo,
                  home_team_score: homeTeam.score ?? null,
                  away_team_id: awayTeam.id,
                  away_team_name: awayTeam.displayName,
                  away_team_abbrev: awayTeam.abbrev,
                  away_team_logo: awayTeam.logo,
                  away_team_score: awayTeam.score ?? null,
                  status: event.status?.state || 'scheduled',
                  status_detail: event.status?.detail || null,
                  venue_name: event.venue?.fullName || null,
                  venue_city: event.venue?.address?.city || null,
                  venue_state: event.venue?.address?.state || null,
                  season: '2025-26',
                });
              }
            }
            fixturesProcessed++;
            if (fixturesProcessed % 10 === 0) {
              console.log(`Processed ${fixturesProcessed} days, ${fixtures.length} fixtures so far`);
            }
          }
        } catch (err) {
          console.error(`Error fetching fixtures for ${dateStr}:`, err);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
        await delay(100); // Rate limiting
      }

      // Upsert fixtures in batches
      console.log(`Upserting ${fixtures.length} fixtures...`);
      for (let i = 0; i < fixtures.length; i += 100) {
        const batch = fixtures.slice(i, i + 100);
        const { error } = await supabase
          .from('nba_fixtures')
          .upsert(batch, { onConflict: 'event_id' });
        if (error) console.error('Fixtures upsert error:', error);
      }
      console.log('Fixtures populated successfully');

      // 2. Get all players from database
      const { data: players, error: playersError } = await supabase
        .from('nba_players')
        .select('id, full_name, team_name, api_player_id');

      if (playersError) {
        console.error('Error fetching players:', playersError);
        return;
      }

      console.log(`Found ${players?.length || 0} players to process`);

      // 3. Get team IDs for API lookups
      const { data: teams } = await supabase
        .from('nba_teams')
        .select('name, team_id');

      const teamIdMap = new Map<string, number>();
      teams?.forEach(t => {
        if (t.team_id) teamIdMap.set(t.name, t.team_id);
      });

      // 4. Process each player
      let playersProcessed = 0;
      let statsTotal = 0;

      for (const player of players || []) {
        try {
          let apiPlayerId = player.api_player_id;

          // If no cached API ID, look it up
          if (!apiPlayerId) {
            const teamId = teamIdMap.get(player.team_name);
            if (teamId) {
              const response = await fetch(`${BASE_URL}/nba-player-list?teamid=${teamId}`, {
                method: 'GET',
                headers: {
                  'x-rapidapi-host': RAPIDAPI_HOST,
                  'x-rapidapi-key': apiKey,
                },
              });

              if (response.ok) {
                const data = await response.json();
                const playerList = data?.response?.PlayerList || [];
                const match = playerList.find((p: any) => {
                  const apiName = (p.fullName || '').toLowerCase();
                  const dbName = player.full_name.toLowerCase();
                  return apiName === dbName || apiName.includes(dbName) || dbName.includes(apiName);
                });

                if (match?.id) {
                  apiPlayerId = match.id;
                  // Cache it
                  await supabase
                    .from('nba_players')
                    .update({ api_player_id: apiPlayerId })
                    .eq('id', player.id);
                }
              }
              await delay(100);
            }
          }

          if (!apiPlayerId) {
            console.log(`No API ID found for ${player.full_name}, skipping`);
            continue;
          }

          // Fetch game log
          const gamelogResponse = await fetch(`${BASE_URL}/nba-player-gamelog?playerid=${apiPlayerId}`, {
            method: 'GET',
            headers: {
              'x-rapidapi-host': RAPIDAPI_HOST,
              'x-rapidapi-key': apiKey,
            },
          });

          if (!gamelogResponse.ok) {
            console.error(`Failed to fetch gamelog for ${player.full_name}`);
            await delay(100);
            continue;
          }

          const gamelogData = await gamelogResponse.json();
          const gamelog = gamelogData?.response?.gamelog;

          if (!gamelog?.events || !gamelog?.seasonTypes) {
            await delay(100);
            continue;
          }

          const events = gamelog.events;
          const regularSeason = gamelog.seasonTypes?.find(
            (s: any) => s.displayName?.includes('Regular Season')
          );

          if (!regularSeason?.categories) {
            await delay(100);
            continue;
          }

          const playerStats: any[] = [];

          for (const category of regularSeason.categories) {
            if (category.type === 'event' && category.events) {
              for (const gameEvent of category.events) {
                const eventId = gameEvent.eventId;
                const eventData = events[eventId];
                const stats = gameEvent.stats || [];

                if (eventData && stats.length > 0) {
                  const fgSplit = (stats[1] || '0-0').split('-');
                  const fg3Split = (stats[3] || '0-0').split('-');
                  const ftSplit = (stats[5] || '0-0').split('-');

                  playerStats.push({
                    player_id: player.id,
                    player_name: player.full_name,
                    event_id: eventId,
                    game_date: eventData.gameDate,
                    minutes: parseInt(stats[0] || '0', 10),
                    field_goals_made: parseInt(fgSplit[0] || '0', 10),
                    field_goals_attempted: parseInt(fgSplit[1] || '0', 10),
                    field_goal_pct: parseFloat(stats[2] || '0'),
                    three_pt_made: parseInt(fg3Split[0] || '0', 10),
                    three_pt_attempted: parseInt(fg3Split[1] || '0', 10),
                    three_pt_pct: parseFloat(stats[4] || '0'),
                    free_throws_made: parseInt(ftSplit[0] || '0', 10),
                    free_throws_attempted: parseInt(ftSplit[1] || '0', 10),
                    free_throw_pct: parseFloat(stats[6] || '0'),
                    rebounds: parseInt(stats[7] || '0', 10),
                    assists: parseInt(stats[8] || '0', 10),
                    blocks: parseInt(stats[9] || '0', 10),
                    steals: parseInt(stats[10] || '0', 10),
                    fouls: parseInt(stats[11] || '0', 10),
                    turnovers: parseInt(stats[12] || '0', 10),
                    points: parseInt(stats[13] || '0', 10),
                  });
                }
              }
            }
          }

          // Delete existing stats and insert new ones
          if (playerStats.length > 0) {
            await supabase
              .from('nba_player_stats')
              .delete()
              .eq('player_id', player.id);

            const { error: insertError } = await supabase
              .from('nba_player_stats')
              .insert(playerStats);

            if (insertError) {
              console.error(`Error inserting stats for ${player.full_name}:`, insertError);
            } else {
              statsTotal += playerStats.length;
            }
          }

          playersProcessed++;
          if (playersProcessed % 10 === 0) {
            console.log(`Processed ${playersProcessed} players, ${statsTotal} total stats`);
          }

          await delay(150); // Rate limiting
        } catch (err) {
          console.error(`Error processing ${player.full_name}:`, err);
        }
      }

      console.log(`COMPLETE: ${fixtures.length} fixtures, ${playersProcessed} players, ${statsTotal} stats`);
    } catch (error) {
      console.error('Bulk population error:', error);
    }
  })();

  // Use waitUntil to run in background
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(responsePromise);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Bulk population started in background. Check logs for progress.' 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
