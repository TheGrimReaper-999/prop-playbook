import { useState, useCallback } from 'react';
import { fetchPlayerProps, fetchAlternateLines, findPlayerOdds, debugPlayerNameMatches, fetchAllPlayerData as fetchAllPlayerDataApi, fetchPlayerPropsByGame, fetchAlternateLinesByGame, findPlayerGame, findPlayerGameByTeam, findMatchingPlayerOdds as findMatchingPlayerOddsApi, PlayerOdds } from '@/lib/the-odds-api';

// Optimized player name normalization function
const normalizePlayerName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
};

// Local player matching function
const findMatchingPlayerOddsLocal = (allOdds: PlayerOdds[], playerName: string): PlayerOdds[] => {
  const normalizedSearch = normalizePlayerName(playerName);
  
  return allOdds.filter(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    
    // Exact match first
    if (normalizedOdds === normalizedSearch) {
      return true;
    }
    
    // Try partial match (more efficient than includes both ways)
    return normalizedOdds.includes(normalizedSearch) || normalizedSearch.includes(normalizedOdds);
  });
};

export interface UseOddsReturn {
  isLoading: boolean;
  error: string | null;
  rateLimit: {
    remaining: string | null;
    used: string | null;
    last: string | null;
  } | null;
  fetchOddsForPlayer: (
    playerName: string,
    statType: string
  ) => Promise<PlayerOdds | null>;
  fetchAlternateLinesForPlayer: (
    playerName: string,
    statType: string
  ) => Promise<PlayerOdds[]>;
  fetchAllPlayerData: (
    playerName: string
  ) => Promise<{
    mainLines: Record<string, PlayerOdds>;
    alternateLines: Record<string, PlayerOdds[]>;
  }>;
  fetchOddsForPlayerByGame: (
    playerName: string,
    statType: string
  ) => Promise<PlayerOdds | null>;
  fetchAlternateLinesForPlayerByGame: (
    playerName: string,
    statType: string
  ) => Promise<PlayerOdds[]>;
  fetchOddsForPlayerByTeam: (
    playerName: string,
    teamName: string,
    statType: string
  ) => Promise<PlayerOdds | null>;
  fetchAlternateLinesForPlayerByTeam: (
    playerName: string,
    teamName: string,
    statType: string
  ) => Promise<PlayerOdds[]>;
}

/**
 * Hook for fetching and managing player prop odds from The Odds API
 * Implements the developer guide for NBA player props from BetMGM
 */
export function useOdds(): UseOddsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<{
    remaining: string | null;
    used: string | null;
    last: string | null;
  } | null>(null);

  const fetchOddsForPlayer = useCallback(async (
    playerName: string,
    statType: string
  ): Promise<PlayerOdds | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching odds for ${playerName}, stat: ${statType}`);

      // Fetch all odds for this stat type
      const { odds, rateLimit: rateLimitInfo } = await fetchPlayerProps(statType);
      
      // Update rate limit info
      if (rateLimitInfo) {
        setRateLimit(rateLimitInfo);
      }

      console.log(`🎯 Received ${odds.length} player odds entries for ${statType}`);

      // Find the matching player
      const playerOdds = findPlayerOdds(odds, playerName);
      
      if (playerOdds) {
        console.log(`✅ Found odds for ${playerName}:`, playerOdds);
      } else {
        console.log(`❌ No odds found for ${playerName}`);
        if (odds.length > 0) {
          console.log('Available players (first 5):', odds.slice(0, 5).map(o => o.playerName));
          debugPlayerNameMatches(odds, playerName);
        } else {
          console.log(`❌ No odds data received for stat type: ${statType}`);
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

  const fetchAlternateLinesForPlayer = useCallback(async (
    playerName: string,
    statType: string
  ): Promise<PlayerOdds[]> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching alternate lines for ${playerName}, stat: ${statType}`);

      // Fetch all alternate odds for this stat type
      const { odds, rateLimit: rateLimitInfo } = await fetchAlternateLines(statType);
      
      // Update rate limit info
      if (rateLimitInfo) {
        setRateLimit(rateLimitInfo);
      }

      console.log(`🎯 Received ${odds.length} alternate line entries for ${statType}`);

      // Find all matching player odds (alternate lines can have multiple entries per player)
      const playerAlternateOdds = findMatchingPlayerOddsLocal(odds, playerName);

      console.log(`🎯 Found ${playerAlternateOdds.length} alternate lines for ${playerName}`);

      return playerAlternateOdds;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch alternate lines';
      console.error('Error fetching alternate lines:', err);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllPlayerData = useCallback(async (
    playerName: string
  ): Promise<{
    mainLines: Record<string, PlayerOdds>;
    alternateLines: Record<string, PlayerOdds[]>;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching all player data for ${playerName}`);

      const { mainLines, alternateLines, rateLimit: rateLimitInfo } = await fetchAllPlayerDataApi(playerName);
      
      // Update rate limit info
      if (rateLimitInfo) {
        setRateLimit(rateLimitInfo);
      }

      console.log(`🎯 Received complete data for ${playerName}: ${Object.keys(mainLines).length} main lines, ${Object.keys(alternateLines).length} alternate line types`);

      return { mainLines, alternateLines };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch player data';
      console.error('Error fetching player data:', err);
      setError(message);
      return { mainLines: {}, alternateLines: {} };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOddsForPlayerByGame = useCallback(async (
    playerName: string,
    statType: string
  ): Promise<PlayerOdds | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching odds for ${playerName} by game, stat: ${statType}`);

      // First find which game the player is in
      const eventId = await findPlayerGame(playerName);
      
      if (!eventId) {
        console.log(`❌ Could not find game for ${playerName}`);
        return null;
      }

      // Fetch odds for that specific game
      const { odds, rateLimit: rateLimitInfo } = await fetchPlayerPropsByGame(eventId, statType);
      
      // Update rate limit info
      if (rateLimitInfo) {
        setRateLimit(rateLimitInfo);
      }

      console.log(`🎯 Received ${odds.length} player odds from game ${eventId} for ${statType}`);

      // Find the matching player
      const playerOdds = findPlayerOdds(odds, playerName);
      
      if (playerOdds) {
        console.log(`✅ Found odds for ${playerName}:`, playerOdds);
      } else {
        console.log(`❌ No odds found for ${playerName} in this game`);
        if (odds.length > 0) {
          console.log('Available players in this game (first 10):', odds.slice(0, 10).map(o => o.playerName));
          debugPlayerNameMatches(odds, playerName);
        }
      }

      return playerOdds;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch odds by game';
      console.error('Error fetching odds by game:', err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAlternateLinesForPlayerByGame = useCallback(async (
    playerName: string,
    statType: string
  ): Promise<PlayerOdds[]> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching alternate lines for ${playerName} by game, stat: ${statType}`);

      // First find which game the player is in
      const eventId = await findPlayerGame(playerName);
      
      if (!eventId) {
        console.log(`❌ Could not find game for ${playerName}`);
        return [];
      }

      // Fetch alternate lines for that specific game
      const { odds, rateLimit: rateLimitInfo } = await fetchAlternateLinesByGame(eventId, statType);
      
      // Update rate limit info
      if (rateLimitInfo) {
        setRateLimit(rateLimitInfo);
      }

      console.log(`🎯 Received ${odds.length} alternate line entries from game ${eventId} for ${statType}`);

      // Find all matching player odds
      const playerAlternateOdds = findMatchingPlayerOddsLocal(odds, playerName);

      console.log(`🎯 Found ${playerAlternateOdds.length} alternate lines for ${playerName}`);

      return playerAlternateOdds;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch alternate lines by game';
      console.error('Error fetching alternate lines by game:', err);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOddsForPlayerByTeam = useCallback(async (
    playerName: string,
    teamName: string,
    statType: string
  ): Promise<PlayerOdds | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching odds for ${playerName} by team (${teamName}), stat: ${statType}`);

      // First find the team's game
      const eventId = await findPlayerGameByTeam(playerName, teamName);
      
      if (!eventId) {
        console.log(`❌ Could not find game for ${playerName} in team ${teamName}`);
        return null;
      }

      // Fetch odds for that specific game
      const { odds, rateLimit: rateLimitInfo } = await fetchPlayerPropsByGame(eventId, statType);
      
      // Update rate limit info
      if (rateLimitInfo) {
        setRateLimit(rateLimitInfo);
      }

      console.log(`🎯 Received ${odds.length} player odds from team game ${eventId} for ${statType}`);

      // Find the matching player
      const playerOdds = findPlayerOdds(odds, playerName);
      
      if (playerOdds) {
        console.log(`✅ Found odds for ${playerName}:`, playerOdds);
      } else {
        console.log(`❌ No odds found for ${playerName} in team game`);
        if (odds.length > 0) {
          console.log('Available players in this game (first 5):', odds.slice(0, 5).map(o => o.playerName));
          debugPlayerNameMatches(odds, playerName);
        } else {
          console.log(`❌ No odds data received for team game and stat type: ${statType}`);
        }
      }

      return playerOdds;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch odds by team';
      console.error('Error fetching odds by team:', err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAlternateLinesForPlayerByTeam = useCallback(async (
    playerName: string,
    teamName: string,
    statType: string
  ): Promise<PlayerOdds[]> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🎯 Fetching alternate lines for ${playerName} by team (${teamName}), stat: ${statType}`);

      // First find the team's game
      const eventId = await findPlayerGameByTeam(playerName, teamName);
      
      if (!eventId) {
        console.log(`❌ Could not find game for ${playerName} in team ${teamName}`);
        return [];
      }

      // Fetch alternate lines for that specific game
      const { odds, rateLimit: rateLimitInfo } = await fetchAlternateLinesByGame(eventId, statType);
      
      // Update rate limit info
      if (rateLimitInfo) {
        setRateLimit(rateLimitInfo);
      }

      console.log(`🎯 Received ${odds.length} alternate line entries from team game ${eventId} for ${statType}`);

      // Find all matching player odds
      const playerAlternateOdds = findMatchingPlayerOddsLocal(odds, playerName);

      console.log(`🎯 Found ${playerAlternateOdds.length} alternate lines for ${playerName}`);

      return playerAlternateOdds;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch alternate lines by team';
      console.error('Error fetching alternate lines by team:', err);
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    rateLimit,
    fetchOddsForPlayer,
    fetchAlternateLinesForPlayer,
    fetchAllPlayerData,
    fetchOddsForPlayerByGame,
    fetchAlternateLinesForPlayerByGame,
    fetchOddsForPlayerByTeam,
    fetchAlternateLinesForPlayerByTeam,
  };
}
