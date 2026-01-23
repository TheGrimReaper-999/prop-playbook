import { useState, useCallback } from 'react';
import { 
  apiSports, 
  STAT_TYPE_TO_BET_ID,
  getParserForStatType,
  findPlayerOdds,
  ParsedPlayerOdds,
} from '@/lib/api-sports';
import { findApiSportsGameId } from './useGameId';

interface FetchOddsOptions {
  statType: string;
  teamName?: string;
  gameId?: number;
}

/**
 * Calculate NBA season string based on current date
 * NBA season runs from October to June
 * e.g., games in Jan 2025 are part of "2024-2025" season
 */
function getCurrentNBASeason(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed (0 = January)
  
  // If we're in Jan-June, we're in the second half of the season
  // Season started in October of previous year
  if (month < 6) { // January (0) through June (5)
    return `${year - 1}-${year}`;
  } else {
    // July onwards, new season starts in October
    return `${year}-${year + 1}`;
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

  const season = getCurrentNBASeason();

  try {
    // Get game ID from database if not provided but we have a team name
    let targetGameId = gameId;
    if (!targetGameId && teamName) {
      const gameResult = await findApiSportsGameId(teamName);
      if (gameResult) {
        targetGameId = gameResult.gameId;
        console.log(`✅ Found game from DB: ${gameResult.homeTeam} vs ${gameResult.awayTeam}`);
      } else {
        console.log(`❌ No game found in DB for team: ${teamName}`);
      }
    }

    console.log(`🎯 Fetching odds with bet ID: ${betId}, game: ${targetGameId || 'all games'}, season: ${season}`);

    // Fetch odds from API
    const apiOdds = await apiSports.getOdds({
      league: 12,
      season: season,
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
