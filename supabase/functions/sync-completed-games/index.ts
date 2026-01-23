import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'nba-api-free-data.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

interface Fixture {
  event_id: string;
  game_date: string;
  home_team_id: string;
  home_team_name: string;
  home_team_abbrev: string;
  home_team_logo: string | null;
  home_team_score: number | null;
  away_team_id: string;
  away_team_name: string;
  away_team_abbrev: string;
  away_team_logo: string | null;
  away_team_score: number | null;
  status: string;
  status_detail: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_state: string | null;
  season: string | null;
}

interface PlayerStats {
  player_id: string | null;
  player_name: string;
  event_id: string;
  game_date: string;
  minutes: number;
  field_goals_made: number;
  field_goals_attempted: number;
  field_goal_pct: number;
  three_pt_made: number;
  three_pt_attempted: number;
  three_pt_pct: number;
  free_throws_made: number;
  free_throws_attempted: number;
  free_throw_pct: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  fouls: number;
  turnovers: number;
  points: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Parse game log stats array into PlayerStats object
function parseGameStats(
  eventId: string,
  gameDate: string,
  stats: string[],
  playerName: string,
  playerId: string | null
): PlayerStats {
  const fgSplit = (stats[1] || '0-0').split('-');
  const fg3Split = (stats[3] || '0-0').split('-');
  const ftSplit = (stats[5] || '0-0').split('-');

  return {
    player_id: playerId,
    player_name: playerName,
    event_id: eventId,
    game_date: gameDate,
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
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for admin operations
    const authHeader = req.headers.get('Authorization');
    const expectedToken = Deno.env.get('CRON_SECRET');
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('RAPIDAPI_NBA_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional days parameter (default: 3 days)
    let daysToSync = 3;
    try {
      const body = await req.json();
      if (body?.days) {
        daysToSync = Math.min(Math.max(parseInt(body.days, 10) || 3, 1), 7);
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log(`Starting sync for last ${daysToSync} days`);

    const results = {
      gamesUpdated: 0,
      gamesProcessed: 0,
      playerStatsAdded: 0,
      errors: [] as string[],
    };

    // Process each day
    for (let dayOffset = 0; dayOffset < daysToSync; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      
      console.log(`Processing date: ${dateStr}`);

      try {
        // Fetch schedule for this date
        const scheduleResponse = await fetch(`${BASE_URL}/nba-schedule-by-date?date=${dateStr}`, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': apiKey,
          },
        });

        if (!scheduleResponse.ok) {
          console.error(`Failed to fetch schedule for ${dateStr}: ${scheduleResponse.status}`);
          results.errors.push(`Schedule fetch failed for ${dateStr}`);
          continue;
        }

        const scheduleData = await scheduleResponse.json();
        const events = scheduleData?.response?.Events || [];
        
        console.log(`Found ${events.length} games for ${dateStr}`);

        for (const event of events) {
          results.gamesProcessed++;
          
          const homeTeam = event.competitors?.find((c: any) => c.isHome);
          const awayTeam = event.competitors?.find((c: any) => !c.isHome);

          if (!homeTeam || !awayTeam) continue;

          const fixture: Fixture = {
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
          };

          // Upsert fixture
          const { error: upsertError } = await supabase
            .from('nba_fixtures')
            .upsert(fixture, { onConflict: 'event_id' });

          if (upsertError) {
            console.error(`Error upserting fixture ${event.id}:`, upsertError);
            results.errors.push(`Fixture upsert failed: ${event.id}`);
            continue;
          }

          results.gamesUpdated++;

          // For completed games, sync player stats
          if (event.status?.state === 'post') {
            // Check if we already have enough player stats for this game (at least 10 per team = 20 total)
            const { count } = await supabase
              .from('nba_player_stats')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id);

            // Skip only if we have 16+ player stats (indicating complete data)
            if (count && count >= 16) {
              console.log(`Game ${event.id} already has ${count} player stats, skipping`);
              continue;
            }

            // If partial data exists, delete it first
            if (count && count > 0) {
              console.log(`Game ${event.id} has only ${count} player stats, re-syncing...`);
              await supabase.from('nba_player_stats').delete().eq('event_id', event.id);
            }

            console.log(`Syncing player stats for completed game ${event.id}`);

            // Try boxscore first
            await delay(100); // Rate limit
            
            const boxscoreResponse = await fetch(`${BASE_URL}/nba-boxscore?gameid=${event.id}`, {
              method: 'GET',
              headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': apiKey,
              },
            });

            let playerStats: PlayerStats[] = [];

            if (boxscoreResponse.ok) {
              const boxscoreData = await boxscoreResponse.json();
              const boxscore = boxscoreData?.response;

              if (boxscore?.teams) {
                for (const team of boxscore.teams) {
                  const players = team.players || [];
                  for (const player of players) {
                    if (player.stats && player.stats.length > 0) {
                      // Look up player_id from nba_players table
                      const { data: playerData } = await supabase
                        .from('nba_players')
                        .select('id')
                        .eq('api_player_id', player.id)
                        .maybeSingle();

                      const stats = parseGameStats(
                        event.id,
                        boxscore.gameDate || event.date,
                        player.stats,
                        player.displayName || player.fullName || 'Unknown',
                        playerData?.id || null
                      );
                      playerStats.push(stats);
                    }
                  }
                }
              }
            }

            // If boxscore didn't work, try player gamelogs fallback
            if (playerStats.length === 0) {
              console.log(`No boxscore data for ${event.id}, trying player gamelogs`);

              // Get players from both teams
              const { data: teamPlayers } = await supabase
                .from('nba_players')
                .select('id, api_player_id, full_name, team_name')
                .or(`team_name.ilike.%${homeTeam.displayName}%,team_name.ilike.%${awayTeam.displayName}%`)
                .not('api_player_id', 'is', null)
                .limit(20);

              if (teamPlayers && teamPlayers.length > 0) {
                for (const player of teamPlayers.slice(0, 8)) {
                  try {
                    await delay(100);
                    
                    const gamelogResponse = await fetch(`${BASE_URL}/nba-player-gamelog?playerid=${player.api_player_id}`, {
                      method: 'GET',
                      headers: {
                        'x-rapidapi-host': RAPIDAPI_HOST,
                        'x-rapidapi-key': apiKey,
                      },
                    });

                    if (gamelogResponse.ok) {
                      const gamelogData = await gamelogResponse.json();
                      const gamelog = gamelogData?.response?.gamelog;

                      if (gamelog?.events && gamelog?.seasonTypes) {
                        const events = gamelog.events;
                        const regularSeason = gamelog.seasonTypes?.find(
                          (s: { displayName: string }) => s.displayName?.includes('Regular Season')
                        );

                        if (regularSeason?.categories) {
                          for (const category of regularSeason.categories) {
                            if (category.type === 'event' && category.events) {
                              for (const gameEvent of category.events) {
                                if (gameEvent.eventId === event.id && gameEvent.stats) {
                                  const eventData = events[gameEvent.eventId];
                                  if (eventData) {
                                    const stats = parseGameStats(
                                      event.id,
                                      eventData.gameDate || fixture.game_date,
                                      gameEvent.stats,
                                      player.full_name,
                                      player.id
                                    );
                                    playerStats.push(stats);
                                    console.log(`Found stats for ${player.full_name} in game ${event.id}`);
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } catch (err) {
                    console.error(`Error fetching gamelog for ${player.full_name}:`, err);
                  }
                }
              }
            }

            // Insert player stats
            if (playerStats.length > 0) {
              const { error: insertError } = await supabase
                .from('nba_player_stats')
                .insert(playerStats);

              if (insertError) {
                console.error(`Error inserting player stats for ${event.id}:`, insertError);
                results.errors.push(`Stats insert failed: ${event.id}`);
              } else {
                results.playerStatsAdded += playerStats.length;
                console.log(`Added ${playerStats.length} player stats for game ${event.id}`);
              }
            }
          }
        }

        await delay(200); // Rate limit between days
      } catch (err) {
        console.error(`Error processing date ${dateStr}:`, err);
        results.errors.push(`Processing failed for ${dateStr}`);
      }
    }

    console.log('Sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        message: `Synced ${results.gamesUpdated} games with ${results.playerStatsAdded} player stats`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-completed-games:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
