import { supabase } from '@/integrations/supabase/client';

export interface TheOddsPlayerOdds {
  playerName: string;
  line: number;
  overOdds: number;
  underOdds: number;
  overOddsAmerican: string;
  underOddsAmerican: string;
}

interface TheOddsApiResponse {
  success: boolean;
  action: string;
  market: string;
  odds: TheOddsPlayerOdds[];
  rateLimit?: {
    remaining: string | null;
    used: string | null;
  };
  error?: string;
}

/**
 * Normalize player name for matching
 */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove non-letters except spaces
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
}

/**
 * Fetch player prop odds from The Odds API via edge function
 */
export async function fetchTheOddsApiPlayerProps(
  statType: string,
  teamName?: string
): Promise<TheOddsPlayerOdds[]> {
  console.log(`🎲 Fetching from The Odds API: statType=${statType}, team=${teamName}`);

  const { data, error } = await supabase.functions.invoke<TheOddsApiResponse>('the-odds-api', {
    body: {
      action: 'get_player_props',
      statType,
      homeTeam: teamName,
      awayTeam: teamName, // Search in both home/away
    },
  });

  if (error) {
    console.error('The Odds API error:', error);
    throw error;
  }

  if (!data?.success) {
    console.error('The Odds API failed:', data?.error);
    throw new Error(data?.error || 'Failed to fetch odds');
  }

  console.log(`🎲 The Odds API returned ${data.odds.length} player odds for ${statType}`);
  if (data.rateLimit) {
    console.log(`🎲 Rate limit - Remaining: ${data.rateLimit.remaining}, Used: ${data.rateLimit.used}`);
  }

  return data.odds;
}

/**
 * Find odds for a specific player using fuzzy name matching
 */
export function findTheOddsApiPlayerOdds(
  allOdds: TheOddsPlayerOdds[],
  playerName: string
): TheOddsPlayerOdds | null {
  const normalizedSearch = normalizePlayerName(playerName);
  
  // Exact match first
  const exactMatch = allOdds.find(
    odds => normalizePlayerName(odds.playerName) === normalizedSearch
  );
  
  if (exactMatch) return exactMatch;
  
  // Try partial match
  const partialMatch = allOdds.find(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    return normalizedOdds.includes(normalizedSearch) || normalizedSearch.includes(normalizedOdds);
  });
  
  return partialMatch || null;
}
