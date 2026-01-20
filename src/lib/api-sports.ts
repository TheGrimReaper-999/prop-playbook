import { supabase } from '@/integrations/supabase/client';

// Types for API-Sports odds response
export interface ApiSportsOddsValue {
  value: string;
  odd: string;
}

export interface ApiSportsOdds {
  id: number;
  name: string;
  values: ApiSportsOddsValue[];
}

export interface ParsedPlayerOdds {
  playerName: string;
  line: number;
  overOdds: string;
  underOdds: string;
}

// Stat type to bet ID mapping based on API-Sports documentation
export const STAT_TYPE_TO_BET_ID: Record<string, number> = {
  'pts': 117,   // Player Points
  'reb': 119,   // Player Rebounds
  'ast': 118,   // Player Assists
  '3pm': 120,   // Player Triples (3-pointers)
  'pra': 242,   // Points + Rebounds + Assists
  'pr': 241,    // Points + Rebounds
  'pa': 238,    // Points + Assists
  'ra': 240,    // Rebounds + Assists (Runs)
};

/**
 * Call the api-sports-test edge function
 */
export async function apiSports(action: string, params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await supabase.functions.invoke('api-sports-test', {
    body: { action, ...params },
  });

  if (error) {
    console.error('API-Sports error:', error);
    throw error;
  }

  return data;
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
 * Generic parser for player prop odds
 * Handles formats like:
 * - "LeBron James - Over 24.5"
 * - "LeBron James - Under 24.5"
 */
function parsePlayerPropOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOddsMap = new Map<string, Partial<ParsedPlayerOdds>>();

  for (const oddGroup of odds) {
    for (const value of oddGroup.values) {
      // Try format: "Player Name - Over/Under X.X"
      let match = value.value.match(/^(.+?)\s*-\s*(Over|Under)\s*(\d+(?:\.\d+)?)$/i);
      
      // Try alternative format: "Player Name - Over X.X - description"
      if (!match) {
        match = value.value.match(/^(.+?)\s*-\s*(Over|Under)\s*(\d+(?:\.\d+)?)\s*-/i);
      }

      if (match) {
        const [, playerName, direction, lineStr] = match;
        const normalizedName = normalizePlayerName(playerName);
        const line = parseFloat(lineStr);

        if (!playerOddsMap.has(normalizedName)) {
          playerOddsMap.set(normalizedName, {
            playerName: playerName.trim(),
            line,
          });
        }

        const entry = playerOddsMap.get(normalizedName)!;
        
        if (direction.toLowerCase() === 'over') {
          entry.overOdds = value.odd;
        } else {
          entry.underOdds = value.odd;
        }
      }
    }
  }

  // Convert map to array, only include entries with both over and under odds
  return Array.from(playerOddsMap.values())
    .filter((entry): entry is ParsedPlayerOdds => 
      entry.playerName !== undefined &&
      entry.line !== undefined &&
      entry.overOdds !== undefined &&
      entry.underOdds !== undefined
    );
}

// Export parsing functions for specific stat types
export function parsePlayerPointsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

export function parsePlayerReboundsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

export function parsePlayerAssistsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

export function parsePlayerTriplesOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

export function parsePlayerPointsAssistsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

export function parsePlayerPointsReboundsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

export function parsePlayerPointsReboundsAssistsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

export function parsePlayerRunsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  return parsePlayerPropOdds(odds);
}

/**
 * Find odds for a specific player using fuzzy name matching
 */
export function findPlayerOdds(allOdds: ParsedPlayerOdds[], playerName: string): ParsedPlayerOdds | null {
  const normalizedSearch = normalizePlayerName(playerName);
  
  // Try exact match first
  const exactMatch = allOdds.find(
    odds => normalizePlayerName(odds.playerName) === normalizedSearch
  );
  if (exactMatch) return exactMatch;

  // Try partial match (search name contains or is contained in player name)
  const partialMatch = allOdds.find(odds => {
    const normalizedOdds = normalizePlayerName(odds.playerName);
    return normalizedOdds.includes(normalizedSearch) || normalizedSearch.includes(normalizedOdds);
  });
  
  return partialMatch || null;
}

/**
 * Get the appropriate parsing function for a stat type
 */
export function getParserForStatType(statType: string): (odds: ApiSportsOdds[]) => ParsedPlayerOdds[] {
  switch (statType) {
    case 'pts':
      return parsePlayerPointsOdds;
    case 'reb':
      return parsePlayerReboundsOdds;
    case 'ast':
      return parsePlayerAssistsOdds;
    case '3pm':
      return parsePlayerTriplesOdds;
    case 'pa':
      return parsePlayerPointsAssistsOdds;
    case 'pr':
      return parsePlayerPointsReboundsOdds;
    case 'pra':
      return parsePlayerPointsReboundsAssistsOdds;
    case 'ra':
      return parsePlayerRunsOdds;
    default:
      return parsePlayerPropOdds;
  }
}
