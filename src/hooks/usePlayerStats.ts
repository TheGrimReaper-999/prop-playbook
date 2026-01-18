import { supabase } from '@/integrations/supabase/client';
import { GameLogEntry } from './useNbaApi';

export interface PlayerGameStats {
  playerId: string;
  playerName: string;
  games: GameLogEntry[];
  fetchedAt: string;
}

export interface StatValues {
  pts: number[];
  reb: number[];
  ast: number[];
  '3pm': number[];
  pra: number[];
  pr: number[];
  pa: number[];
  ra: number[];
}

export interface DbPlayerStats {
  id: string;
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
  created_at: string;
}

// Convert database stats to GameLogEntry format
export const dbStatsToGameLogEntry = (stat: DbPlayerStats): GameLogEntry => {
  return {
    gameId: stat.event_id,
    gameDate: stat.game_date,
    matchup: '',
    opponent: '',
    wl: '',
    score: '',
    min: stat.minutes.toString(),
    pts: stat.points.toString(),
    reb: stat.rebounds.toString(),
    ast: stat.assists.toString(),
    blk: stat.blocks.toString(),
    stl: stat.steals.toString(),
    fgm: stat.field_goals_made.toString(),
    fga: stat.field_goals_attempted.toString(),
    fgPct: stat.field_goal_pct.toString(),
    fg3m: stat.three_pt_made.toString(),
    fg3a: stat.three_pt_attempted.toString(),
    fg3Pct: stat.three_pt_pct.toString(),
    ftm: stat.free_throws_made.toString(),
    fta: stat.free_throws_attempted.toString(),
    ftPct: stat.free_throw_pct.toString(),
  };
};

// Extract stat values from game log entries
export const extractStatValues = (games: GameLogEntry[]): StatValues => {
  // Games come in most recent first order from API
  const stats: StatValues = {
    pts: [],
    reb: [],
    ast: [],
    '3pm': [],
    pra: [],
    pr: [],
    pa: [],
    ra: [],
  };

  games.forEach((game) => {
    const pts = parseFloat(game.pts) || 0;
    const reb = parseFloat(game.reb) || 0;
    const ast = parseFloat(game.ast) || 0;
    const fg3m = parseFloat(game.fg3m) || 0;

    stats.pts.push(pts);
    stats.reb.push(reb);
    stats.ast.push(ast);
    stats['3pm'].push(fg3m);
    stats.pra.push(pts + reb + ast);
    stats.pr.push(pts + reb);
    stats.pa.push(pts + ast);
    stats.ra.push(reb + ast);
  });

  return stats;
};

// Get the last N stat values for a specific stat type (most recent first)
export const getStatValuesForType = (
  statValues: StatValues,
  statType: string,
  n: number = 10
): number[] => {
  const values = statValues[statType as keyof StatValues] || [];
  return values.slice(0, n);
};

// Fetch player stats from database
export const fetchPlayerStatsFromDb = async (
  dbPlayerId: string
): Promise<GameLogEntry[]> => {
  const { data: stats, error } = await supabase
    .from('nba_player_stats')
    .select('*')
    .eq('player_id', dbPlayerId)
    .order('game_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching stats from DB:', error);
    return [];
  }

  if (stats && stats.length > 0) {
    return stats.map((s: DbPlayerStats) => dbStatsToGameLogEntry(s));
  }

  return [];
};

// Populate player stats via edge function and return them
export const populateAndFetchPlayerStats = async (
  dbPlayerId: string,
  playerName: string
): Promise<GameLogEntry[]> => {
  // First get the API player ID
  const apiPlayerId = await getApiPlayerIdFromDb(dbPlayerId);
  
  if (!apiPlayerId) {
    console.error('Could not find API player ID for:', playerName);
    return [];
  }

  // Call edge function to populate stats
  const { data, error } = await supabase.functions.invoke('populate-stats', {
    body: {
      action: 'populate-player-stats',
      playerId: apiPlayerId,
      playerName: playerName,
      dbPlayerId: dbPlayerId,
    },
  });

  if (error) {
    console.error('Error populating stats:', error);
    return [];
  }

  console.log('Populate stats result:', data);

  // Now fetch the stats from database
  return fetchPlayerStatsFromDb(dbPlayerId);
};

// Get player stats - first try DB, then populate if empty
export const getPlayerStats = async (
  dbPlayerId: string,
  playerName: string
): Promise<GameLogEntry[]> => {
  // Try fetching from database first
  let stats = await fetchPlayerStatsFromDb(dbPlayerId);
  
  if (stats.length === 0) {
    // No stats in DB, need to populate
    console.log(`No stats in DB for ${playerName}, populating...`);
    stats = await populateAndFetchPlayerStats(dbPlayerId, playerName);
  }

  return stats;
};

// Fetch player game log by API player ID (fallback to API)
export const fetchPlayerGameLog = async (
  apiPlayerId: string
): Promise<GameLogEntry[]> => {
  const { data, error } = await supabase.functions.invoke('nba-stats', {
    body: { action: 'player-gamelog', playerId: apiPlayerId },
  });

  if (error) throw error;

  // Parse the gamelog response structure
  const gamelog = data?.response?.gamelog;
  if (!gamelog?.events || !gamelog?.seasonTypes) return [];

  const events = gamelog.events;
  const seasonTypes = gamelog.seasonTypes || [];

  // Find the regular season stats
  const regularSeason = seasonTypes.find(
    (season: { displayName: string }) =>
      season.displayName?.includes('Regular Season')
  );

  if (!regularSeason?.categories) return [];

  // Collect all game events from all months
  const allGameEvents: { eventId: string; stats: string[] }[] = [];

  for (const category of regularSeason.categories) {
    if (category.type === 'event' && category.events) {
      allGameEvents.push(...category.events);
    }
  }

  // Map events to GameLogEntry - take only first 10 recent games
  const entries: GameLogEntry[] = [];

  for (const gameEvent of allGameEvents.slice(0, 10)) {
    const eventId = gameEvent.eventId;
    const eventData = events[eventId];
    const stats = gameEvent.stats || [];

    if (eventData) {
      const fgSplit = (stats[1] || '0-0').split('-');
      const fg3Split = (stats[3] || '0-0').split('-');
      const ftSplit = (stats[5] || '0-0').split('-');

      entries.push({
        gameId: eventId,
        gameDate: eventData.gameDate || '',
        matchup: `${eventData.atVs || ''} ${eventData.opponent?.abbreviation || ''}`,
        opponent: eventData.opponent?.displayName || '',
        opponentLogo: eventData.opponent?.logo,
        wl: eventData.gameResult || '',
        score: eventData.score || '',
        min: stats[0] || '0',
        pts: stats[13] || '0',
        reb: stats[7] || '0',
        ast: stats[8] || '0',
        blk: stats[9] || '0',
        stl: stats[10] || '0',
        fgm: fgSplit[0] || '0',
        fga: fgSplit[1] || '0',
        fgPct: stats[2] || '0',
        fg3m: fg3Split[0] || '0',
        fg3a: fg3Split[1] || '0',
        fg3Pct: stats[4] || '0',
        ftm: ftSplit[0] || '0',
        fta: ftSplit[1] || '0',
        ftPct: stats[6] || '0',
      });
    }
  }

  return entries;
};

// Look up API player ID from database player ID
export const getApiPlayerIdFromDb = async (
  dbPlayerId: string
): Promise<string | null> => {
  // First try to find the player in nba_players table
  const { data: player, error } = await supabase
    .from('nba_players')
    .select('full_name, team_name, api_player_id')
    .eq('id', dbPlayerId)
    .single();

  if (error || !player) return null;

  // If we already have the API player ID cached, use it
  if (player.api_player_id) {
    return player.api_player_id;
  }

  // We need to find the API player ID by matching the name
  // Get team info to find team ID
  const { data: team } = await supabase
    .from('nba_teams')
    .select('team_id')
    .eq('name', player.team_name)
    .maybeSingle();

  if (!team?.team_id) return null;

  // Fetch player list for team
  const { data: playerListData } = await supabase.functions.invoke('nba-stats', {
    body: { action: 'player-list', teamId: team.team_id },
  });

  const playerList = playerListData?.response?.PlayerList || [];
  
  // Find matching player by name
  const matchingPlayer = playerList.find((p: { fullName?: string; id?: string }) => {
    const apiName = (p.fullName || '').toLowerCase();
    const dbName = player.full_name.toLowerCase();
    return apiName === dbName || apiName.includes(dbName) || dbName.includes(apiName);
  });

  const apiPlayerId = matchingPlayer?.id || null;

  // Cache the API player ID for future use
  if (apiPlayerId) {
    await supabase
      .from('nba_players')
      .update({ api_player_id: apiPlayerId })
      .eq('id', dbPlayerId);
  }

  return apiPlayerId;
};

// Fetch stats for multiple legs
export interface LegStats {
  legId: string;
  playerId: string;
  apiPlayerId: string | null;
  games: GameLogEntry[];
  statValues: StatValues;
  error?: string;
}

export const fetchStatsForLegs = async (
  legs: { legId: string; player: { id: string; name: string } }[]
): Promise<Map<string, LegStats>> => {
  const statsMap = new Map<string, LegStats>();

  // Process legs in parallel
  const results = await Promise.allSettled(
    legs.map(async (leg) => {
      try {
        // Use the new database-first approach
        const games = await getPlayerStats(leg.player.id, leg.player.name);
        const statValues = extractStatValues(games);

        return {
          legId: leg.legId,
          playerId: leg.player.id,
          apiPlayerId: null, // We don't need this anymore
          games,
          statValues,
        };
      } catch (err) {
        console.error(`Error fetching stats for ${leg.player.name}:`, err);
        return {
          legId: leg.legId,
          playerId: leg.player.id,
          apiPlayerId: null,
          games: [],
          statValues: extractStatValues([]),
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    })
  );

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      statsMap.set(result.value.legId, result.value);
    }
  });

  return statsMap;
};

// Calculate MA (simple moving average)
export const calculateMA = (values: number[], period: number): number[] => {
  // values are most recent first
  // We need to return MA values that align with the chart (oldest to recent)
  // So reverse first, calculate MA, then we have oldest to recent
  const chronological = [...values].reverse(); // oldest first
  const maValues: number[] = [];

  for (let i = 0; i < chronological.length; i++) {
    if (i < period - 1) {
      maValues.push(NaN); // Not enough data for MA
    } else {
      const sum = chronological.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      maValues.push(sum / period);
    }
  }

  return maValues; // oldest to recent
};

// Calculate EMA (exponential moving average)
// EMA is calculated recent to oldest, plotted over recent 5 games
export const calculateEMA = (values: number[], period: number = 5): number[] => {
  // values are most recent first (index 0 = most recent)
  // We need to calculate EMA from recent to oldest
  // Then plot it over the last 5 games (most recent 5)
  
  if (values.length === 0) return [];
  
  const alpha = 2 / (period + 1);
  const chronological = [...values].reverse(); // oldest first for chart
  const n = chronological.length;
  
  // Calculate EMA going from most recent backwards
  // Start with most recent value as initial EMA
  const emaFromRecent: number[] = new Array(n).fill(NaN);
  
  // EMA calculated recent to oldest
  // Start from most recent (index n-1 in chronological array)
  let ema = values[0]; // most recent value
  
  // Fill in the last 5 positions (most recent 5 games)
  const startIdx = Math.max(0, n - 5);
  for (let i = n - 1; i >= startIdx; i--) {
    const val = chronological[i];
    if (i === n - 1) {
      emaFromRecent[i] = ema;
    } else {
      ema = alpha * val + (1 - alpha) * ema;
      emaFromRecent[i] = ema;
    }
  }
  
  return emaFromRecent; // oldest to recent, only last 5 have values
};
