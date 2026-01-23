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

// Helper function to delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Parse game log stats array into PlayerStats object
function parseGameStats(
  eventId: string,
  gameDate: string,
  stats: string[],
  playerName: string,
  playerId: string | null
): PlayerStats {
  // Stats order from API:
  // [0]=MIN, [1]=FGM-FGA, [2]=FG%, [3]=3PM-3PA, [4]=3P%, [5]=FTM-FTA, [6]=FT%,
  // [7]=REB, [8]=AST, [9]=BLK, [10]=STL, [11]=PF, [12]=TO, [13]=PTS
  
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
    
    const { action, playerId, playerName, dbPlayerId, startDate, endDate, eventId } = await req.json();

    if (action === 'populate-fixtures') {
      // Populate fixtures for a date range (defaults to last 30 days)
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const fixtures: Fixture[] = [];
      const currentDate = new Date(start);
      
      console.log(`Fetching fixtures from ${start.toISOString()} to ${end.toISOString()}`);
      
      while (currentDate <= end) {
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
          }
        } catch (err) {
          console.error(`Error fetching fixtures for ${dateStr}:`, err);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
        await delay(100); // Rate limiting
      }

      // Upsert fixtures
      if (fixtures.length > 0) {
        const { error: upsertError } = await supabase
          .from('nba_fixtures')
          .upsert(fixtures, { onConflict: 'event_id' });

        if (upsertError) throw upsertError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          fixturesCount: fixtures.length,
          message: `Populated ${fixtures.length} fixtures` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'populate-player-stats') {
      // Populate stats for a specific player
      if (!playerId) {
        throw new Error('playerId is required for populate-player-stats');
      }

      console.log(`Fetching game log for player ${playerId}`);
      
      const response = await fetch(`${BASE_URL}/nba-player-gamelog?playerid=${playerId}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch game log: ${response.status}`);
      }

      const data = await response.json();
      const gamelog = data?.response?.gamelog;
      
      if (!gamelog?.events || !gamelog?.seasonTypes) {
        return new Response(
          JSON.stringify({ success: true, statsCount: 0, message: 'No game log data found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const events = gamelog.events;
      const seasonTypes = gamelog.seasonTypes || [];
      
      // Find regular season
      const regularSeason = seasonTypes.find(
        (season: { displayName: string }) => season.displayName?.includes('Regular Season')
      );

      if (!regularSeason?.categories) {
        return new Response(
          JSON.stringify({ success: true, statsCount: 0, message: 'No regular season data' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const allStats: PlayerStats[] = [];
      
      // Resolve player name from DB first, then fallback to passed name
      let resolvedName = playerName;
      if (!resolvedName && dbPlayerId) {
        const { data: playerData } = await supabase
          .from('nba_players')
          .select('full_name')
          .eq('id', dbPlayerId)
          .maybeSingle();
        resolvedName = playerData?.full_name || null;
      }
      const name = resolvedName || 'Unknown Player';
      if (name === 'Unknown Player') {
        console.warn(`WARNING: Could not resolve player name for dbPlayerId: ${dbPlayerId}`);
      }

      // Collect all game events
      for (const category of regularSeason.categories) {
        if (category.type === 'event' && category.events) {
          for (const gameEvent of category.events) {
            const eventId = gameEvent.eventId;
            const eventData = events[eventId];
            
            if (eventData && gameEvent.stats) {
              // First ensure the fixture exists
              const fixture: Fixture = {
                event_id: eventId,
                game_date: eventData.gameDate,
                home_team_id: eventData.homeTeamId || '',
                home_team_name: eventData.homeTeamId === eventData.team?.id ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                home_team_abbrev: eventData.homeTeamId === eventData.team?.id ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                home_team_logo: eventData.homeTeamId === eventData.team?.id ? eventData.team?.logo : eventData.opponent?.logo,
                home_team_score: eventData.homeTeamId === eventData.team?.id ? parseInt(eventData.homeTeamScore || '0', 10) : parseInt(eventData.awayTeamScore || '0', 10),
                away_team_id: eventData.awayTeamId || '',
                away_team_name: eventData.awayTeamId === eventData.team?.id ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                away_team_abbrev: eventData.awayTeamId === eventData.team?.id ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                away_team_logo: eventData.awayTeamId === eventData.team?.id ? eventData.team?.logo : eventData.opponent?.logo,
                away_team_score: eventData.awayTeamId === eventData.team?.id ? parseInt(eventData.homeTeamScore || '0', 10) : parseInt(eventData.awayTeamScore || '0', 10),
                status: 'post',
                status_detail: eventData.score || null,
                venue_name: null,
                venue_city: null,
                venue_state: null,
                season: '2025-26',
              };

              // Upsert fixture
              await supabase
                .from('nba_fixtures')
                .upsert(fixture, { onConflict: 'event_id' });

              const stats = parseGameStats(
                eventId,
                eventData.gameDate,
                gameEvent.stats,
                name,
                dbPlayerId || null
              );
              
              allStats.push(stats);
            }
          }
        }
      }

      // Upsert player stats
      if (allStats.length > 0) {
        // Delete existing stats for this player to avoid duplicates
        if (dbPlayerId) {
          await supabase
            .from('nba_player_stats')
            .delete()
            .eq('player_id', dbPlayerId);
        }

        // Insert new stats
        const { error: insertError } = await supabase
          .from('nba_player_stats')
          .insert(allStats);

        if (insertError) {
          console.error('Error inserting stats:', insertError);
          throw insertError;
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          statsCount: allStats.length,
          message: `Populated ${allStats.length} game stats for ${name}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-player-stats') {
      // Get player stats from database
      if (!dbPlayerId && !playerName) {
        throw new Error('dbPlayerId or playerName is required');
      }

      let query = supabase
        .from('nba_player_stats')
        .select('*')
        .order('game_date', { ascending: false })
        .limit(10);

      if (dbPlayerId) {
        query = query.eq('player_id', dbPlayerId);
      } else if (playerName) {
        query = query.eq('player_name', playerName);
      }

      const { data: stats, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync-game-boxscore') {
      // Sync box score for a specific completed game
      if (!eventId) {
        throw new Error('eventId is required for sync-game-boxscore');
      }

      console.log(`Fetching box score for game ${eventId}`);

      // Get the game from DB first to find the date and teams
      const { data: fixtureData } = await supabase
        .from('nba_fixtures')
        .select('*')
        .eq('event_id', eventId)
        .single();

      if (!fixtureData) {
        return new Response(
          JSON.stringify({ success: false, message: 'Game not found in database' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try the boxscore endpoint first
      const response = await fetch(`${BASE_URL}/nba-boxscore?gameid=${eventId}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': apiKey,
        },
      });

      console.log(`Box score response status: ${response.status}`);

      let playerStats: PlayerStats[] = [];
      let updatedFromBoxscore = false;

      if (response.ok) {
        const boxscoreData = await response.json();
        console.log('Raw boxscore response keys:', Object.keys(boxscoreData || {}));
        const boxscore = boxscoreData?.response;
        
        console.log('Boxscore response structure:', JSON.stringify({
          hasBoxscore: !!boxscore,
          teamsCount: boxscore?.teams?.length || 0,
          status: boxscore?.status,
        }));

        if (boxscore?.teams) {
          const teams = boxscore.teams || [];
          const gameDate = boxscore.gameDate || fixtureData.game_date;

          for (const team of teams) {
            const players = team.players || [];
            for (const player of players) {
              if (player.stats && player.stats.length > 0) {
                // Look up player_id and name from nba_players table by api_player_id
                const { data: playerData } = await supabase
                  .from('nba_players')
                  .select('id, full_name')
                  .eq('api_player_id', String(player.id))
                  .maybeSingle();

                // Use DB name if available, then API name, never "Unknown"
                const playerName = playerData?.full_name || player.displayName || player.fullName || player.shortName || `Player #${player.id}`;

                const stats = parseGameStats(
                  eventId,
                  gameDate,
                  player.stats,
                  playerName,
                  playerData?.id || null
                );
                playerStats.push(stats);
              }
            }
          }

          // Update fixture status from boxscore
          await supabase
            .from('nba_fixtures')
            .update({
              status: boxscore.status?.state || 'post',
              status_detail: boxscore.status?.detail || 'Final',
              home_team_score: boxscore.homeTeamScore,
              away_team_score: boxscore.awayTeamScore,
            })
            .eq('event_id', eventId);

          updatedFromBoxscore = true;
        }
      }

      // If boxscore didn't work or returned no players, try schedule and check DB for existing stats
      if (!updatedFromBoxscore || playerStats.length === 0) {
        console.log('Boxscore failed or empty, trying schedule and DB fallback');

        const gameDate = new Date(fixtureData.game_date);
        const dateStr = gameDate.toISOString().slice(0, 10).replace(/-/g, '');
        
        const scheduleResponse = await fetch(`${BASE_URL}/nba-schedule-by-date?date=${dateStr}`, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': apiKey,
          },
        });

        if (scheduleResponse.ok) {
          const scheduleData = await scheduleResponse.json();
          const events = scheduleData?.response?.Events || [];
          const gameEvent = events.find((e: any) => e.id === eventId);

          if (gameEvent) {
            const homeTeam = gameEvent.competitors?.find((c: any) => c.isHome);
            const awayTeam = gameEvent.competitors?.find((c: any) => !c.isHome);

            if (homeTeam && awayTeam) {
              // Update fixture with latest scores, status, AND team names (fix missing names)
              await supabase
                .from('nba_fixtures')
                .update({
                  home_team_name: homeTeam.displayName || fixtureData.home_team_name,
                  home_team_abbrev: homeTeam.abbrev || fixtureData.home_team_abbrev,
                  home_team_logo: homeTeam.logo || fixtureData.home_team_logo,
                  home_team_score: homeTeam.score ?? fixtureData.home_team_score,
                  away_team_name: awayTeam.displayName || fixtureData.away_team_name,
                  away_team_abbrev: awayTeam.abbrev || fixtureData.away_team_abbrev,
                  away_team_logo: awayTeam.logo || fixtureData.away_team_logo,
                  away_team_score: awayTeam.score ?? fixtureData.away_team_score,
                  status: gameEvent.status?.state || 'scheduled',
                  status_detail: gameEvent.status?.detail || null,
                })
                .eq('event_id', eventId);
            }
          }
        }

        // Check if we have existing player stats for this game from player gamelogs
        const { data: existingStats } = await supabase
          .from('nba_player_stats')
          .select('*')
          .eq('event_id', eventId);

        if (existingStats && existingStats.length > 0) {
          console.log(`Found ${existingStats.length} existing player stats in DB for game ${eventId}`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              statsCount: existingStats.length,
              message: `Game has ${existingStats.length} player stats from player gamelogs`,
              source: 'database'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // No existing stats - try to fetch from player gamelogs for players on both teams
        console.log('Attempting to sync player gamelogs for teams in this game');
        
        // Get players from both teams in the fixture
        const homeTeamName = fixtureData.home_team_name || '';
        const awayTeamName = fixtureData.away_team_name || '';
        
        const { data: teamPlayers } = await supabase
          .from('nba_players')
          .select('id, api_player_id, full_name, team_name')
          .or(`team_name.ilike.%${homeTeamName}%,team_name.ilike.%${awayTeamName}%`)
          .not('api_player_id', 'is', null)
          .limit(30);

        if (teamPlayers && teamPlayers.length > 0) {
          console.log(`Found ${teamPlayers.length} players from teams, fetching their gamelogs...`);
          
          const newPlayerStats: PlayerStats[] = [];
          
          // Fetch gamelogs for a subset of players (limit API calls)
          for (const player of teamPlayers.slice(0, 10)) {
            try {
              await delay(100); // Rate limit
              
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
                          // Check if this game matches our target eventId
                          if (gameEvent.eventId === eventId && gameEvent.stats) {
                            const eventData = events[gameEvent.eventId];
                            if (eventData) {
                              const stats = parseGameStats(
                                eventId,
                                eventData.gameDate || fixtureData.game_date,
                                gameEvent.stats,
                                player.full_name,
                                player.id
                              );
                              newPlayerStats.push(stats);
                              console.log(`Found stats for ${player.full_name} in game ${eventId}`);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.error(`Error fetching gamelog for player ${player.full_name}:`, err);
            }
          }

          // Insert any found stats
          if (newPlayerStats.length > 0) {
            console.log(`Inserting ${newPlayerStats.length} player stats from gamelogs`);
            
            await supabase
              .from('nba_player_stats')
              .delete()
              .eq('event_id', eventId);

            const { error: insertError } = await supabase
              .from('nba_player_stats')
              .insert(newPlayerStats);

            if (insertError) {
              console.error('Error inserting player stats:', insertError);
            }

            return new Response(
              JSON.stringify({ 
                success: true, 
                statsCount: newPlayerStats.length,
                message: `Synced ${newPlayerStats.length} player stats from gamelogs`,
                source: 'gamelogs'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // No boxscore and no stats from gamelogs - return info message
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Game updated from schedule. Player stats will be available when more players are synced.',
            source: 'schedule'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete existing stats for this game and insert new ones from boxscore
      if (playerStats.length > 0) {
        await supabase
          .from('nba_player_stats')
          .delete()
          .eq('event_id', eventId);

        const { error: insertError } = await supabase
          .from('nba_player_stats')
          .insert(playerStats);

        if (insertError) {
          console.error('Error inserting player stats:', insertError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          statsCount: playerStats.length,
          message: `Synced ${playerStats.length} player stats for game ${eventId}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in populate-stats:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
