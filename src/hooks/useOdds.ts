import { useState, useCallback } from 'react';
import { 
  apiSports, 
  STAT_TYPE_TO_BET_ID,
  getParserForStatType,
  findPlayerOdds,
  ParsedPlayerOdds,
} from '@/lib/api-sports';

interface UseOddsReturn {
  isLoading: boolean;
  error: string | null;
  fetchOddsForPlayer: (
    playerName: string, 
    statType: string, 
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
      console.log(`🎯 Fetching odds for ${playerName}, stat: ${statType}, betId: ${betId}`);

      // If we have a specific game ID, use it
      const params: Record<string, any> = {
        betId,
      };

      if (gameId) {
        params.gameId = gameId;
      }

      const response = await apiSports('odds-by-bet', params);

      if (!response.success || !response.data?.response) {
        console.warn('No odds data in response:', response);
        return null;
      }

      const oddsData = response.data.response;
      console.log(`🎯 Received ${oddsData.length} odds entries`);

      // Parse the odds using the appropriate parser
      const parser = getParserForStatType(statType);
      
      // Flatten all bookmaker odds into a single array for parsing
      const allOdds: any[] = [];
      for (const game of oddsData) {
        for (const bookmaker of game.bookmakers || []) {
          allOdds.push(...(bookmaker.bets || []));
        }
      }

      const parsedOdds = parser(allOdds);
      console.log(`🎯 Parsed ${parsedOdds.length} player odds`);

      // Find the matching player
      const playerOdds = findPlayerOdds(parsedOdds, playerName);
      
      if (playerOdds) {
        console.log(`🎯 Found odds for ${playerName}:`, playerOdds);
      } else {
        console.log(`🎯 No odds found for ${playerName}`);
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
