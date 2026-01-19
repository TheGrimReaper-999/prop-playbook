import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'nba-api-free-data.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Daily budget: 1000 API calls (20% of 5000)
// Strategy: Use player gamelogs (boxscore API returns 404 on free tier)
// Each gamelog call returns ALL games for a player - very efficient!
// - 3 schedule calls/day for fixtures
// - Prioritize players without recent stats - one gamelog call populates ALL their games
// - Run every 30 mins = 48 runs/day, ~20 calls/run = 960/day

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
    let syncApiPlayerId: string | null = null;
    let syncDbPlayerId: string | null = null;
    let syncPlayerName: string | null = null;
    let syncTeamName: string | null = null;
    try {
      const body = await req.json();
      action = body?.action || 'full-sync';
      maxApiCalls = Math.min(body?.maxApiCalls || 20, 50);
      syncApiPlayerId = body?.apiPlayerId || null;
      syncDbPlayerId = body?.dbPlayerId || null;
      syncPlayerName = body?.playerName || null;
      syncTeamName = body?.teamName || null;
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

    // ==================== SYNC SINGLE PLAYER ACTION ====================
    if (action === 'sync-player') {
      // If no API player ID provided, try to look it up by searching the team roster / player list
      if (!syncApiPlayerId && syncPlayerName && syncTeamName) {
        console.log(`Looking up API ID for ${syncPlayerName} on ${syncTeamName}`);

        // Find the team to get their roster
        const { data: teamData } = await supabase
          .from('nba_teams')
          .select('team_id')
          .ilike('name', `%${syncTeamName}%`)
          .maybeSingle();

        if (teamData?.team_id) {
          const normalizedSearchName = normalizeName(syncPlayerName);

          // Helper: more forgiving match
          const isMatch = (candidate: string) => {
            const n = normalizeName(candidate);
            if (n === normalizedSearchName) return true;
            // allow partial (e.g., missing middle, suffix differences)
            return n.includes(normalizedSearchName) || normalizedSearchName.includes(n);
          };

          // Attempt 1: player-list endpoint (more reliable than roster in practice)
          try {
            const listResponse = await fetch(`${BASE_URL}/nba-player-list?teamid=${teamData.team_id}`, {
              method: 'GET',
              headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': apiKey,
              },
            });
            results.apiCallsUsed++;

            if (listResponse.ok) {
              const listData = await listResponse.json();
              const players = listData?.response?.PlayerList || listData?.response?.playerList || [];

              const matched = players.find((p: any) => {
                const nm = p.fullName || p.playerName || p.displayName || '';
                return nm && isMatch(nm);
              });

              if (matched?.id) {
                syncApiPlayerId = String(matched.id);
                console.log(`Found API ID ${syncApiPlayerId} for ${syncPlayerName} via player-list`);

                if (syncDbPlayerId) {
                  await supabase
                    .from('nba_players')
                    .update({ api_player_id: syncApiPlayerId })
                    .eq('id', syncDbPlayerId);
                  results.playersLinked++;
                }
              }
            }
          } catch (err) {
            console.error(`Player-list lookup failed: ${err}`);
          }

          // Attempt 2: roster endpoint fallback
          if (!syncApiPlayerId) {
            try {
              const rosterResponse = await fetch(`${BASE_URL}/nba-team-roster?teamid=${teamData.team_id}`, {
                method: 'GET',
                headers: {
                  'x-rapidapi-host': RAPIDAPI_HOST,
                  'x-rapidapi-key': apiKey,
                },
              });
              results.apiCallsUsed++;

              if (rosterResponse.ok) {
                const rosterData = await rosterResponse.json();
                const athletes = rosterData?.response?.team?.athletes || [];

                const matchedPlayer = athletes.find((p: any) => {
                  const nm = p.displayName || p.fullName || '';
                  return nm && isMatch(nm);
                });

                if (matchedPlayer?.id) {
                  syncApiPlayerId = String(matchedPlayer.id);
                  console.log(`Found API ID ${syncApiPlayerId} for ${syncPlayerName} via roster`);

                  if (syncDbPlayerId) {
                    await supabase
                      .from('nba_players')
                      .update({ api_player_id: syncApiPlayerId })
                      .eq('id', syncDbPlayerId);
                    results.playersLinked++;
                  }
                }
              }
            } catch (err) {
              console.error(`Roster lookup failed: ${err}`);
            }
          }
        }
      }

      if (!syncApiPlayerId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not find API player ID', results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Syncing single player with API ID: ${syncApiPlayerId}`);
      
      // Look up db player id if not provided
      let dbPlayerId = syncDbPlayerId;
      if (!dbPlayerId) {
        const { data: playerData } = await supabase
          .from('nba_players')
          .select('id')
          .eq('api_player_id', syncApiPlayerId)
          .maybeSingle();
        dbPlayerId = playerData?.id || null;
      }

      try {
        const response = await fetch(`${BASE_URL}/nba-player-gamelog?playerid=${syncApiPlayerId}`, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': apiKey,
          },
        });
        results.apiCallsUsed++;

        if (response.ok) {
          const gamelogData = await response.json();
          const gamelog = gamelogData?.response?.gamelog;

          if (gamelog?.events && gamelog?.seasonTypes) {
            const events = gamelog.events;
            const regularSeason = gamelog.seasonTypes?.find(
              (s: { displayName: string }) => s.displayName?.includes('Regular Season')
            );

            // Get player name from gamelog info
            const playerName = gamelog.info?.displayName || 'Unknown Player';

            if (regularSeason?.categories) {
              const allStats: PlayerStats[] = [];

              for (const category of regularSeason.categories) {
                if (category.type === 'event' && category.events) {
                  for (const gameEvent of category.events) {
                    const eventId = gameEvent.eventId;
                    const eventData = events[eventId];

                    if (eventData && gameEvent.stats) {
                      const isHome = eventData.homeTeamId === eventData.team?.id;

                      await supabase.from('nba_fixtures').upsert({
                        event_id: eventId,
                        game_date: eventData.gameDate,
                        home_team_id: eventData.homeTeamId || '',
                        home_team_name: isHome ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                        home_team_abbrev: isHome ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                        home_team_logo: isHome ? eventData.team?.logo : eventData.opponent?.logo,
                        home_team_score: parseInt(eventData.homeTeamScore || '0', 10),
                        away_team_id: eventData.awayTeamId || '',
                        away_team_name: !isHome ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                        away_team_abbrev: !isHome ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                        away_team_logo: !isHome ? eventData.team?.logo : eventData.opponent?.logo,
                        away_team_score: parseInt(eventData.awayTeamScore || '0', 10),
                        status: 'post',
                        status_detail: eventData.score || 'Final',
                        season: '2025-26',
                      }, { onConflict: 'event_id' });

                      const stats = parseGameStats(
                        eventId,
                        eventData.gameDate,
                        gameEvent.stats,
                        playerName,
                        dbPlayerId
                      );
                      allStats.push(stats);
                    }
                  }
                }
              }

              if (allStats.length > 0 && dbPlayerId) {
                await supabase
                  .from('nba_player_stats')
                  .delete()
                  .eq('player_id', dbPlayerId);

                await supabase
                  .from('nba_player_stats')
                  .insert(allStats);

                results.playerStatsAdded = allStats.length;
                results.boxscoresSynced = 1;
                console.log(`Synced ${allStats.length} stats for player`);
              }
            }
          }
        } else {
          results.errors.push(`API request failed: ${response.status}`);
        }
      } catch (err) {
        results.errors.push(`Sync failed: ${String(err)}`);
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // ==================== PHASE 1.5: PRIORITIZE RECENT INCOMPLETE GAMES ====================
    // Find games from last 3 days with less than 16 players and sync those team's players first
    if (action === 'full-sync' || action === 'recent-games-sync') {
      const { data: incompleteGames } = await supabase
        .from('nba_fixtures')
        .select('event_id, home_team_name, away_team_name')
        .eq('status', 'post')
        .gte('game_date', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .order('game_date', { ascending: false });

      if (incompleteGames) {
        // Check which games need more stats
        const gamesNeedingStats: Array<{ event_id: string; home_team: string; away_team: string; count: number }> = [];
        
        for (const game of incompleteGames) {
          const { count } = await supabase
            .from('nba_player_stats')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', game.event_id);

          if (!count || count < 16) {
            gamesNeedingStats.push({
              event_id: game.event_id,
              home_team: game.home_team_name || '',
              away_team: game.away_team_name || '',
              count: count || 0,
            });
          }
        }

        console.log(`Found ${gamesNeedingStats.length} recent games needing more stats`);

        // Get players from teams in incomplete games
        const teamsToSync = new Set<string>();
        for (const game of gamesNeedingStats.slice(0, 5)) { // Limit to top 5 most recent
          if (game.home_team) teamsToSync.add(game.home_team);
          if (game.away_team) teamsToSync.add(game.away_team);
        }

        if (teamsToSync.size > 0) {
          // Get players from these teams
          const teamNames = Array.from(teamsToSync);
          const { data: teamPlayers } = await supabase
            .from('nba_players')
            .select('id, full_name, api_player_id, team_name')
            .not('api_player_id', 'is', null)
            .in('team_name', teamNames);

          if (teamPlayers) {
            // Get existing stat counts for these players
            const playerIds = teamPlayers.map(p => p.id);
            const { data: existingStats } = await supabase
              .from('nba_player_stats')
              .select('player_id')
              .in('player_id', playerIds);

            const statCountMap = new Map<string, number>();
            if (existingStats) {
              for (const stat of existingStats) {
                const count = statCountMap.get(stat.player_id!) || 0;
                statCountMap.set(stat.player_id!, count + 1);
              }
            }

            // Prioritize players with fewer stats
            const sortedPlayers = teamPlayers
              .map(p => ({ ...p, stat_count: statCountMap.get(p.id) || 0 }))
              .sort((a, b) => a.stat_count - b.stat_count);

            for (const player of sortedPlayers) {
              if (results.apiCallsUsed >= maxApiCalls) break;
              if (player.stat_count >= 40) continue; // Skip players with full season

              console.log(`[PRIORITY] Syncing ${player.full_name} from ${player.team_name} (${player.stat_count} stats)`);

              try {
                const response = await fetch(`${BASE_URL}/nba-player-gamelog?playerid=${player.api_player_id}`, {
                  method: 'GET',
                  headers: {
                    'x-rapidapi-host': RAPIDAPI_HOST,
                    'x-rapidapi-key': apiKey,
                  },
                });
                results.apiCallsUsed++;

                if (response.ok) {
                  const gamelogData = await response.json();
                  const gamelog = gamelogData?.response?.gamelog;

                  if (gamelog?.events && gamelog?.seasonTypes) {
                    const events = gamelog.events;
                    const regularSeason = gamelog.seasonTypes?.find(
                      (s: { displayName: string }) => s.displayName?.includes('Regular Season')
                    );

                    if (regularSeason?.categories) {
                      const allStats: PlayerStats[] = [];

                      for (const category of regularSeason.categories) {
                        if (category.type === 'event' && category.events) {
                          for (const gameEvent of category.events) {
                            const eventId = gameEvent.eventId;
                            const eventData = events[eventId];

                            if (eventData && gameEvent.stats) {
                              const isHome = eventData.homeTeamId === eventData.team?.id;

                              await supabase.from('nba_fixtures').upsert({
                                event_id: eventId,
                                game_date: eventData.gameDate,
                                home_team_id: eventData.homeTeamId || '',
                                home_team_name: isHome ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                                home_team_abbrev: isHome ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                                home_team_logo: isHome ? eventData.team?.logo : eventData.opponent?.logo,
                                home_team_score: parseInt(eventData.homeTeamScore || '0', 10),
                                away_team_id: eventData.awayTeamId || '',
                                away_team_name: !isHome ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                                away_team_abbrev: !isHome ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                                away_team_logo: !isHome ? eventData.team?.logo : eventData.opponent?.logo,
                                away_team_score: parseInt(eventData.awayTeamScore || '0', 10),
                                status: 'post',
                                status_detail: eventData.score || 'Final',
                                season: '2025-26',
                              }, { onConflict: 'event_id' });

                              const stats = parseGameStats(
                                eventId,
                                eventData.gameDate,
                                gameEvent.stats,
                                player.full_name,
                                player.id
                              );
                              allStats.push(stats);
                            }
                          }
                        }
                      }

                      if (allStats.length > 0) {
                        await supabase
                          .from('nba_player_stats')
                          .delete()
                          .eq('player_id', player.id);

                        await supabase
                          .from('nba_player_stats')
                          .insert(allStats);

                        results.playerStatsAdded += allStats.length;
                        results.boxscoresSynced++;
                        console.log(`[PRIORITY] Added ${allStats.length} stats for ${player.full_name}`);
                      }
                    }
                  }
                }
              } catch (err) {
                results.errors.push(`Priority sync failed for ${player.full_name}`);
              }

              await delay(150);
            }
          }
        }
      }
    }

    // ==================== PHASE 2: SYNC PLAYER GAMELOGS ====================
    // Strategy: Fetch gamelogs for players who have the fewest stats in DB
    // One gamelog call returns ALL games for a player - much more efficient than boxscore
    if (action === 'full-sync' || action === 'gamelog-sync') {
      // Get all players with api_player_id
      const { data: allPlayers } = await supabase
        .from('nba_players')
        .select('id, full_name, api_player_id, team_name')
        .not('api_player_id', 'is', null);

      // Get stat counts grouped by player_id in a single query
      const { data: statCounts } = await supabase
        .from('nba_player_stats')
        .select('player_id')
        .not('player_id', 'is', null);

      // Count stats per player
      const statCountMap = new Map<string, number>();
      if (statCounts) {
        for (const stat of statCounts) {
          const count = statCountMap.get(stat.player_id!) || 0;
          statCountMap.set(stat.player_id!, count + 1);
        }
      }

      if (allPlayers) {
        // Build list with stat counts
        const playersWithStatCount = allPlayers.map(p => ({
          ...p,
          api_player_id: p.api_player_id!,
          stat_count: statCountMap.get(p.id) || 0,
        }));

        // Sort by stat count ascending - prioritize players with fewest stats
        playersWithStatCount.sort((a, b) => a.stat_count - b.stat_count);

        // Sync gamelogs for players with least stats (limit to 50 to check quickly)
        for (const player of playersWithStatCount.slice(0, 50)) {
          if (results.apiCallsUsed >= maxApiCalls) break;
          
          // Skip players who already have 30+ games (likely complete season)
          if (player.stat_count >= 30) continue;

          console.log(`Syncing gamelog for ${player.full_name} (currently ${player.stat_count} stats)`);

          try {
            const response = await fetch(`${BASE_URL}/nba-player-gamelog?playerid=${player.api_player_id}`, {
              method: 'GET',
              headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': apiKey,
              },
            });
            results.apiCallsUsed++;

            if (response.ok) {
              const gamelogData = await response.json();
              const gamelog = gamelogData?.response?.gamelog;

              if (gamelog?.events && gamelog?.seasonTypes) {
                const events = gamelog.events;
                const regularSeason = gamelog.seasonTypes?.find(
                  (s: { displayName: string }) => s.displayName?.includes('Regular Season')
                );

                if (regularSeason?.categories) {
                  const allStats: PlayerStats[] = [];

                  for (const category of regularSeason.categories) {
                    if (category.type === 'event' && category.events) {
                      for (const gameEvent of category.events) {
                        const eventId = gameEvent.eventId;
                        const eventData = events[eventId];

                        if (eventData && gameEvent.stats) {
                          // Ensure fixture exists
                          const isHome = eventData.homeTeamId === eventData.team?.id;
                          
                          await supabase.from('nba_fixtures').upsert({
                            event_id: eventId,
                            game_date: eventData.gameDate,
                            home_team_id: eventData.homeTeamId || '',
                            home_team_name: isHome ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                            home_team_abbrev: isHome ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                            home_team_logo: isHome ? eventData.team?.logo : eventData.opponent?.logo,
                            home_team_score: parseInt(eventData.homeTeamScore || '0', 10),
                            away_team_id: eventData.awayTeamId || '',
                            away_team_name: !isHome ? eventData.team?.displayName || '' : eventData.opponent?.displayName || '',
                            away_team_abbrev: !isHome ? eventData.team?.abbreviation || '' : eventData.opponent?.abbreviation || '',
                            away_team_logo: !isHome ? eventData.team?.logo : eventData.opponent?.logo,
                            away_team_score: parseInt(eventData.awayTeamScore || '0', 10),
                            status: 'post',
                            status_detail: eventData.score || 'Final',
                            season: '2025-26',
                          }, { onConflict: 'event_id' });

                          const stats = parseGameStats(
                            eventId,
                            eventData.gameDate,
                            gameEvent.stats,
                            player.full_name,
                            player.id
                          );
                          allStats.push(stats);
                        }
                      }
                    }
                  }

                  // Delete old stats for this player and insert new
                  if (allStats.length > 0) {
                    await supabase
                      .from('nba_player_stats')
                      .delete()
                      .eq('player_id', player.id);

                    await supabase
                      .from('nba_player_stats')
                      .insert(allStats);

                    results.playerStatsAdded += allStats.length;
                    results.boxscoresSynced++; // Reusing this counter for players synced
                    console.log(`Added ${allStats.length} stats for ${player.full_name}`);
                  }
                }
              }
            }
          } catch (err) {
            results.errors.push(`Gamelog sync failed for ${player.full_name}`);
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
        message: `Used ${results.apiCallsUsed}/${maxApiCalls} API calls. Synced ${results.scheduleSynced} schedules, ${results.boxscoresSynced} players (${results.playerStatsAdded} game stats), linked ${results.playersLinked} api_ids, fixed ${results.orphanStatsLinked} orphan stats.`,
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
