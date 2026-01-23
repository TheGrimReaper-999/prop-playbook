import { supabase } from '@/integrations/supabase/client';

export interface GameIdResult {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
}

/**
 * Get today's date range in UTC for database queries
 */
function getTodayDateRange(): { start: string; end: string } {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);
  
  return {
    start: todayStart.toISOString(),
    end: todayEnd.toISOString(),
  };
}

/**
 * Normalize team name for matching
 * Handles partial matches like "Lakers" → "Los Angeles Lakers"
 */
function normalizeTeamName(teamName: string): string {
  return teamName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '');
}

/**
 * Find API-Sports game_id for a team playing today
 * Queries the api_sports_fixtures table by team name matching
 * 
 * @param teamName - The team name to search for (partial or full)
 * @returns GameIdResult with game_id and team names, or null if not found
 */
export async function findApiSportsGameId(
  teamName: string
): Promise<GameIdResult | null> {
  if (!teamName) {
    console.log('❌ findApiSportsGameId: No team name provided');
    return null;
  }

  const { start, end } = getTodayDateRange();
  const normalizedTeam = normalizeTeamName(teamName);
  
  console.log(`🔍 Looking for game in DB for team: "${teamName}" (normalized: "${normalizedTeam}")`);
  console.log(`📅 Date range: ${start} to ${end}`);

  try {
    // Query api_sports_fixtures for today's games matching the team
    const { data, error } = await supabase
      .from('api_sports_fixtures')
      .select('game_id, home_team_name, away_team_name')
      .gte('game_date', start)
      .lte('game_date', end)
      .or(`home_team_name.ilike.%${normalizedTeam}%,away_team_name.ilike.%${normalizedTeam}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ DB query error:', error.message);
      return null;
    }

    if (!data) {
      console.log(`❌ No game found in DB for team: "${teamName}" today`);
      return null;
    }

    console.log(`✅ Found game from DB: ${data.home_team_name} vs ${data.away_team_name} (game_id: ${data.game_id})`);

    return {
      gameId: data.game_id,
      homeTeam: data.home_team_name || '',
      awayTeam: data.away_team_name || '',
    };
  } catch (err) {
    console.error('❌ Error in findApiSportsGameId:', err);
    return null;
  }
}

/**
 * Find API-Sports game_id for a specific date (not just today)
 */
export async function findApiSportsGameIdForDate(
  teamName: string,
  date: Date
): Promise<GameIdResult | null> {
  if (!teamName) {
    return null;
  }

  const dateStart = new Date(date);
  dateStart.setUTCHours(0, 0, 0, 0);
  
  const dateEnd = new Date(date);
  dateEnd.setUTCHours(23, 59, 59, 999);

  const normalizedTeam = normalizeTeamName(teamName);

  try {
    const { data, error } = await supabase
      .from('api_sports_fixtures')
      .select('game_id, home_team_name, away_team_name')
      .gte('game_date', dateStart.toISOString())
      .lte('game_date', dateEnd.toISOString())
      .or(`home_team_name.ilike.%${normalizedTeam}%,away_team_name.ilike.%${normalizedTeam}%`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      gameId: data.game_id,
      homeTeam: data.home_team_name || '',
      awayTeam: data.away_team_name || '',
    };
  } catch {
    return null;
  }
}
