import { useState, useCallback } from 'react';
import { 
  apiSports, 
  STAT_TYPE_TO_BET_ID,
  getParserForStatType,
  findPlayerOdds,
  ParsedPlayerOdds,
  ApiSportsGame,
} from '@/lib/api-sports';

interface FetchOddsOptions {
  statType: string;
  teamName?: string;
  gameId?: number;
}

/**
 * Find the game ID for a player's team from today's schedule
 */
async function findPlayerGame(teamName: string): Promise<number | null> {
  try {
    const today = new Date();
    const utcDate = today.toISOString().split('T')[0];
    
    console.log(`🔍 Looking for game for team: ${teamName} on ${utcDate}`);
    
    const games = await apiSports.getGames({
      league: 12,
      season: '2024-2025',
      date: utcDate,
    });
    
    console.log(`📅 Found ${games.length} games for today`);
    
    // Normalize team name for matching
    const normalizedTeam = teamName.toLowerCase().trim();
    
    const game = games.find((g: ApiSportsGame) => {
      const homeName = g.teams.home.name.toLowerCase();
      const awayName = g.teams.away.name.toLowerCase();
      return homeName.includes(normalizedTeam) || 
             awayName.includes(normalizedTeam) ||
             normalizedTeam.includes(homeName.split(' ').pop() || '') ||
             normalizedTeam.includes(awayName.split(' ').pop() || '');
    });
    
    if (game) {
      console.log(`✅ Found game for ${teamName}: ${game.teams.home.name} vs ${game.teams.away.name} (ID: ${game.id})`);
      return game.id;
    }
    
    console.log(`❌ No game found for ${teamName} today`);
    return null;
  } catch (error) {
    console.error('Error finding player game:', error);
    return null;
  }
}

/**
 * Fetch odds directly without React state management
 * Useful for one-off fetches in callbacks
 */
export async function fetchOddsDirect({ 
  statType, 
  teamName, 
  gameId 
}: FetchOddsOptions): Promise<ParsedPlayerOdds[]> {
  console.log(`🔍 fetchOddsDirect called with statType: "${statType}", team: "${teamName}"`);
  
  if (!statType) {
    console.log('❌ fetchOddsDirect: No statType provided');
    return [];
  }

  const betId = STAT_TYPE_TO_BET_ID[statType];
  if (!betId) {
    console.log(`❌ No bet ID found for stat type: "${statType}"`);
    throw new Error(`No odds available for stat type: ${statType}`);
  }

  console.log(`✅ Found bet ID ${betId} for stat type: ${statType}`);

  try {
    // Get game ID if not provided but we have a team name
    let targetGameId = gameId;
    if (!targetGameId && teamName) {
      targetGameId = await findPlayerGame(teamName) || undefined;
    }

    console.log(`🎯 Fetching odds with bet ID: ${betId}, game: ${targetGameId || 'all games'}`);

    // Fetch odds from API
    const apiOdds = await apiSports.getOdds({
      league: 12,
      season: '2024-2025',
      bookmaker: 4, // Bet365
      bet: betId,
      game: targetGameId,
    });

    console.log(`📊 Received ${apiOdds.length} odds entries`);

    // Parse odds using the appropriate parser
    const parser = getParserForStatType(statType);
    const parsedOdds = parser(apiOdds);

    console.log(`✅ Parsed ${parsedOdds.length} player odds entries for ${statType}`);
    return parsedOdds;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch odds';
    console.error('Error in fetchOddsDirect:', errorMessage);
    throw new Error(errorMessage);
  }
}

interface UseOddsReturn {
  isLoading: boolean;
  error: string | null;
  fetchOddsForPlayer: (
    playerName: string, 
    statType: string, 
    teamName?: string,
    gameId?: number
  ) => Promise<ParsedPlayerOdds | null>;
}

/**
 * Hook for fetching and managing player prop odds from API-Sports
 */
export function useOdds(): UseOddsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOddsForPlayer = useCallback(async (
    playerName: string,
    statType: string,
    teamName?: string,
    gameId?: number
  ): Promise<ParsedPlayerOdds | null> => {
    const betId = STAT_TYPE_TO_BET_ID[statType];
    if (!betId) {
      console.warn(`No bet ID mapping for stat type: ${statType}`);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching odds for ${playerName}, stat: ${statType}, team: ${teamName}`);

      // Fetch all odds for this stat type
      const allOdds = await fetchOddsDirect({ statType, teamName, gameId });

      console.log(`🎯 Received ${allOdds.length} player odds entries`);

      // Find the matching player
      const playerOdds = findPlayerOdds(allOdds, playerName);
      
      if (playerOdds) {
        console.log(`🎯 Found odds for ${playerName}:`, playerOdds);
      } else {
        console.log(`🎯 No odds found for ${playerName} among ${allOdds.length} entries`);
        // Log available players for debugging
        if (allOdds.length > 0) {
          console.log('Available players:', allOdds.slice(0, 10).map(o => o.playerName));
        }
      }

      return playerOdds;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch odds';
      console.error('Error fetching odds:', err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    fetchOddsForPlayer,
  };
}
