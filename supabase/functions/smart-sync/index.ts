import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'nba-api-free-data.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Daily budget: 1000 API calls (20% of 5000)
// Allocation per run (every 30 mins = 48 runs/day):
// - Schedule sync: ~3 calls/run (today + yesterday + tomorrow) = 144/day
// - Boxscore sync: ~15 calls/run for incomplete games = 720/day  
// - Player linking: ~3 calls/run for players without api_player_id = 144/day
// Total: ~1008/day (within budget)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Normalize player name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/jr$/i, '')
    .replace(/sr$/i, '')
    .replace(/iii$/i, '')
    .replace(/ii$/i, '')
    .replace(/iv$/i, '')
    .trim()
    .replace(/\s+/g, ' ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('RAPIDAPI_NBA_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse action from body
    let action = 'full-sync';
    let maxApiCalls = 20; // Default per run
    try {
      const body = await req.json();
      action = body?.action || 'full-sync';
      maxApiCalls = Math.min(body?.maxApiCalls || 20, 50);
    } catch {
      // Use defaults
    }

    const results = {
      apiCallsUsed: 0,
      scheduleSynced: 0,
      boxscoresSynced: 0,
      playerStatsAdded: 0,
      playersLinked: 0,
      orphanStatsLinked: 0,
      errors: [] as string[],
    };

    console.log(`Starting smart-sync with action: ${action}, budget: ${maxApiCalls} calls`);

    // ==================== PHASE 1: SYNC SCHEDULES (3 API calls) ====================
    if (action === 'full-sync' || action === 'schedule-sync') {
      const datesToSync = [-1, 0, 1]; // yesterday, today, tomorrow
      
      for (const dayOffset of datesToSync) {
        if (results.apiCallsUsed >= maxApiCalls) break;

        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

        try {
          const response = await fetch(`${BASE_URL}/nba-schedule-by-date?date=${dateStr}`, {
            method: 'GET',
            headers: {
              'x-rapidapi-host': RAPIDAPI_HOST,
              'x-rapidapi-key': apiKey,
            },
          });
          results.apiCallsUsed++;

          if (response.ok) {
            const data = await response.json();
            const events = data?.response?.Events || [];

            for (const event of events) {
              const homeTeam = event.competitors?.find((c: any) => c.isHome);
              const awayTeam = event.competitors?.find((c: any) => !c.isHome);

              if (!homeTeam || !awayTeam) continue;

              await supabase.from('nba_fixtures').upsert({
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
              }, { onConflict: 'event_id' });

              results.scheduleSynced++;
            }
          }
        } catch (err) {
          results.errors.push(`Schedule sync failed for ${dateStr}`);
        }

        await delay(100);
      }
    }

    // ==================== PHASE 2: SYNC BOXSCORES FOR INCOMPLETE GAMES ====================
    if (action === 'full-sync' || action === 'boxscore-sync') {
      // Find completed games with incomplete stats (less than 16 players)
      // Prioritize most recent games first
      const { data: incompleteGames } = await supabase
        .from('nba_fixtures')
        .select('event_id, game_date, home_team_name, away_team_name')
        .eq('status', 'post')
        .gte('game_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
        .order('game_date', { ascending: false })
        .limit(50);

      if (incompleteGames) {
        // Check which games have incomplete stats
        for (const game of incompleteGames) {
          if (results.apiCallsUsed >= maxApiCalls) break;

          const { count } = await supabase
            .from('nba_player_stats')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', game.event_id);

          // Skip if game already has 16+ player stats
          if (count && count >= 16) continue;

          console.log(`Syncing boxscore for game ${game.event_id} (currently ${count || 0} stats)`);

          try {
            const response = await fetch(`${BASE_URL}/nba-boxscore?gameid=${game.event_id}`, {
              method: 'GET',
              headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': apiKey,
              },
            });
            results.apiCallsUsed++;

            if (response.ok) {
              const boxscoreData = await response.json();
              const boxscore = boxscoreData?.response;

              if (boxscore?.teams) {
                const playerStats: PlayerStats[] = [];

                // Load all players for name matching
                const { data: allPlayers } = await supabase
                  .from('nba_players')
                  .select('id, full_name, api_player_id');

                const playerMap = new Map<string, { id: string; api_player_id: string | null }>();
                const apiIdMap = new Map<string, string>();
                
                if (allPlayers) {
                  for (const p of allPlayers) {
                    playerMap.set(normalizeName(p.full_name), { id: p.id, api_player_id: p.api_player_id });
                    if (p.api_player_id) {
                      apiIdMap.set(p.api_player_id, p.id);
                    }
                  }
                }

                for (const team of boxscore.teams) {
                  for (const player of team.players || []) {
                    if (player.stats && player.stats.length > 0) {
                      const playerName = player.displayName || player.fullName || 'Unknown';
                      
                      // Try to find player by api_player_id first, then by name
                      let dbPlayerId: string | null = null;
                      
                      if (player.id && apiIdMap.has(player.id)) {
                        dbPlayerId = apiIdMap.get(player.id) || null;
                      } else {
                        // Try name matching
                        const normalized = normalizeName(playerName);
                        const match = playerMap.get(normalized);
                        if (match) {
                          dbPlayerId = match.id;
                          // Update api_player_id if missing
                          if (!match.api_player_id && player.id) {
                            await supabase
                              .from('nba_players')
                              .update({ api_player_id: player.id })
                              .eq('id', match.id);
                            results.playersLinked++;
                          }
                        }
                      }

                      const stats = parseGameStats(
                        game.event_id,
                        boxscore.gameDate || game.game_date,
                        player.stats,
                        playerName,
                        dbPlayerId
                      );
                      playerStats.push(stats);
                    }
                  }
                }

                // Delete old stats and insert new
                if (playerStats.length > 0) {
                  await supabase
                    .from('nba_player_stats')
                    .delete()
                    .eq('event_id', game.event_id);

                  await supabase
                    .from('nba_player_stats')
                    .insert(playerStats);

                  results.boxscoresSynced++;
                  results.playerStatsAdded += playerStats.length;
                  console.log(`Added ${playerStats.length} stats for game ${game.event_id}`);
                }

                // Update fixture scores
                await supabase
                  .from('nba_fixtures')
                  .update({
                    home_team_score: boxscore.homeTeamScore,
                    away_team_score: boxscore.awayTeamScore,
                    status_detail: boxscore.status?.detail || 'Final',
                  })
                  .eq('event_id', game.event_id);
              }
            }
          } catch (err) {
            results.errors.push(`Boxscore sync failed for ${game.event_id}`);
          }

          await delay(150);
        }
      }
    }

    // ==================== PHASE 3: LINK ORPHAN STATS TO PLAYERS ====================
    if (action === 'full-sync' || action === 'link-players') {
      // Find stats without player_id and try to link by name
      const { data: orphanStats } = await supabase
        .from('nba_player_stats')
        .select('id, player_name')
        .is('player_id', null)
        .limit(100);

      if (orphanStats && orphanStats.length > 0) {
        const { data: allPlayers } = await supabase
          .from('nba_players')
          .select('id, full_name');

        if (allPlayers) {
          const playerMap = new Map<string, string>();
          for (const p of allPlayers) {
            playerMap.set(normalizeName(p.full_name), p.id);
          }

          for (const stat of orphanStats) {
            const normalized = normalizeName(stat.player_name);
            const playerId = playerMap.get(normalized);
            
            if (playerId) {
              await supabase
                .from('nba_player_stats')
                .update({ player_id: playerId })
                .eq('id', stat.id);
              results.orphanStatsLinked++;
            }
          }
        }
      }
    }

    console.log('Smart sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        message: `Used ${results.apiCallsUsed}/${maxApiCalls} API calls. Synced ${results.scheduleSynced} schedules, ${results.boxscoresSynced} boxscores (${results.playerStatsAdded} player stats), linked ${results.playersLinked} players, fixed ${results.orphanStatsLinked} orphan stats.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in smart-sync:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
