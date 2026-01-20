import { supabase } from '@/integrations/supabase/client';

// Types for API-Sports odds response
export interface ApiSportsOddsValue {
  value: string;
  odd: string;
  line?: number;
}

export interface ApiSportsOdds {
  id: number;
  game: {
    id: number;
    date: string;
    time: string;
    timezone: string;
    status: string;
  };
  league: {
    id: number;
    name: string;
    season: number;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  bookmakers: Array<{
    id: number;
    name: string;
    bets: Array<{
      id: number;
      name: string;
      values: Array<ApiSportsOddsValue>;
    }>;
  }>;
}

export interface ApiSportsGame {
  id: number;
  date: string;
  time: string;
  status: { long: string; short: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  scores: {
    home: { total: number | null };
    away: { total: number | null };
  };
}

export interface ParsedPlayerOdds {
  playerName: string;
  line: number;
  overOdds: number;
  underOdds: number;
  overOddsAmerican: string;
  underOddsAmerican: string;
  originalOverValue: string;
  originalUnderValue: string;
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
 * Convert decimal odds to American format
 */
export function decimalToAmerican(decimalOdds: number): string {
  if (decimalOdds >= 2.0) {
    return `+${Math.round((decimalOdds - 1) * 100)}`;
  } else {
    return `${Math.round(-100 / (decimalOdds - 1))}`;
  }
}

/**
 * API-Sports client object with methods for different endpoints
 */
export const apiSports = {
  /**
   * Make a generic request to the api-sports-test edge function
   */
  async request(action: string, params: Record<string, any> = {}): Promise<any> {
    const { data, error } = await supabase.functions.invoke('api-sports-test', {
      body: { action, ...params },
    });

    if (error) {
      console.error('API-Sports error:', error);
      throw error;
    }

    return data;
  },

  /**
   * Get games for a specific date
   */
  async getGames(params: { league: number; season: string; date: string }): Promise<ApiSportsGame[]> {
    const response = await this.request('games-by-date', params);
    return response.data?.response || [];
  },

  /**
   * Get betting odds
   */
  async getOdds(params: { 
    league: number; 
    season: string; 
    bookmaker?: number; 
    bet: number; 
    game?: number 
  }): Promise<ApiSportsOdds[]> {
    const response = await this.request('odds-by-bet', {
      betId: params.bet,
      gameId: params.game,
    });
    return response.data?.response || [];
  },
};

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
 * Generic helper to parse player prop bets from a bet object
 */
function parseGenericPlayerOdds(bet: { values: ApiSportsOddsValue[] }): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  const playerValues: Record<string, Array<{ value: string; odd: string }>> = {};

  for (const value of bet.values) {
    // Try format: "Player Name - Over/Under X.X"
    let match = value.value.match(/^(.+?)\s*-\s*(Over|Under)\s*(\d+(?:\.\d+)?)$/i);
    
    // Try alternative format: "Player Name - Over X.X - description"
    if (!match) {
      match = value.value.match(/^(.+?)\s*-\s*(Over|Under)\s*(\d+(?:\.\d+)?)\s*-/i);
    }

    if (match) {
      const [, playerName, betType, lineStr] = match;
      const line = parseFloat(lineStr);
      const key = `${playerName.trim()}-${line}`;

      if (!playerValues[key]) {
        playerValues[key] = [];
      }
      playerValues[key].push({
        value: value.value,
        odd: value.odd,
      });
    }
  }

  // Combine over/under pairs
  for (const [key, values] of Object.entries(playerValues)) {
    const lastDash = key.lastIndexOf('-');
    const playerName = key.substring(0, lastDash);
    const line = parseFloat(key.substring(lastDash + 1));

    const overValue = values.find(v => v.value.toLowerCase().includes('over'));
    const underValue = values.find(v => v.value.toLowerCase().includes('under'));

    if (overValue && underValue) {
      const overOddsDecimal = parseFloat(overValue.odd);
      const underOddsDecimal = parseFloat(underValue.odd);

      if (overOddsDecimal > 0 && underOddsDecimal > 0) {
        playerOdds.push({
          playerName: playerName.trim(),
          line,
          overOdds: overOddsDecimal,
          underOdds: underOddsDecimal,
          overOddsAmerican: decimalToAmerican(overOddsDecimal),
          underOddsAmerican: decimalToAmerican(underOddsDecimal),
          originalOverValue: overValue.value,
          originalUnderValue: underValue.value,
        });
      }
    }
  }

  return playerOdds;
}

/**
 * Parse player points odds from API response (bet ID 117)
 * Targets Bet365 (bookmaker ID 4) for consistent odds
 */
export function parsePlayerPointsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  console.log('🔍 Parsing Player Points odds from', odds.length, 'entries');
  
  for (const gameOdds of odds) {
    // Target Bet365 (ID 4) for consistent odds
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    
    if (bet365) {
      const playerPointsBet = bet365.bets?.find(b => b.id === 117);
      
      if (playerPointsBet) {
        console.log(`✅ Found Player Points bet (ID 117) with ${playerPointsBet.values.length} values`);
        playerOdds.push(...parseGenericPlayerOdds(playerPointsBet));
      }
    }
    
    // Fallback: try any bookmaker if Bet365 not found
    if (playerOdds.length === 0) {
      for (const bookmaker of gameOdds.bookmakers || []) {
        const pointsBet = bookmaker.bets?.find(b => b.id === 117);
        if (pointsBet) {
          console.log(`✅ Found Player Points bet from ${bookmaker.name} with ${pointsBet.values.length} values`);
          playerOdds.push(...parseGenericPlayerOdds(pointsBet));
          break;
        }
      }
    }
  }
  
  console.log(`✅ Parsed ${playerOdds.length} player odds entries from Player Points section`);
  return playerOdds;
}

/**
 * Parse player rebounds odds from API response (bet ID 119)
 */
export function parsePlayerReboundsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  console.log('🔍 Parsing Player Rebounds odds from', odds.length, 'entries');
  
  for (const gameOdds of odds) {
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    
    if (bet365) {
      const reboundsBet = bet365.bets?.find(b => b.id === 119);
      
      if (reboundsBet) {
        console.log(`✅ Found Player Rebounds bet (ID 119) with ${reboundsBet.values.length} values`);
        playerOdds.push(...parseGenericPlayerOdds(reboundsBet));
      }
    }
  }
  
  console.log(`✅ Parsed ${playerOdds.length} player odds entries from Player Rebounds section`);
  return playerOdds;
}

/**
 * Parse player assists odds from API response (bet ID 118)
 */
export function parsePlayerAssistsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  console.log('🔍 Parsing Player Assists odds from', odds.length, 'entries');
  
  for (const gameOdds of odds) {
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    
    if (bet365) {
      const assistsBet = bet365.bets?.find(b => b.id === 118);
      
      if (assistsBet) {
        console.log(`✅ Found Player Assists bet (ID 118) with ${assistsBet.values.length} values`);
        playerOdds.push(...parseGenericPlayerOdds(assistsBet));
      }
    }
  }
  
  console.log(`✅ Parsed ${playerOdds.length} player odds entries from Player Assists section`);
  return playerOdds;
}

/**
 * Parse player triples (3-pointers) odds from API response (bet ID 120)
 */
export function parsePlayerTriplesOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  console.log('🔍 Parsing Player Triples (3-pointers) odds from', odds.length, 'entries');
  
  for (const gameOdds of odds) {
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    
    if (bet365) {
      const triplesBet = bet365.bets?.find(b => b.id === 120);
      
      if (triplesBet) {
        console.log(`✅ Found Player Triples bet (ID 120) with ${triplesBet.values.length} values`);
        playerOdds.push(...parseGenericPlayerOdds(triplesBet));
      }
    }
    
    // Fallback: try any bookmaker if Bet365 not found
    if (playerOdds.length === 0) {
      for (const bookmaker of gameOdds.bookmakers || []) {
        const triplesBet = bookmaker.bets?.find(b => b.id === 120);
        if (triplesBet) {
          console.log(`✅ Found Player Triples bet from ${bookmaker.name} with ${triplesBet.values.length} values`);
          playerOdds.push(...parseGenericPlayerOdds(triplesBet));
          break;
        }
      }
    }
  }
  
  console.log(`✅ Parsed ${playerOdds.length} player odds entries from Player Triples section`);
  return playerOdds;
}

/**
 * Parse points + assists combo odds (bet ID 238)
 */
export function parsePlayerPointsAssistsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  for (const gameOdds of odds) {
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    if (bet365) {
      const paBet = bet365.bets?.find(b => b.id === 238);
      if (paBet) {
        playerOdds.push(...parseGenericPlayerOdds(paBet));
      }
    }
  }
  
  return playerOdds;
}

/**
 * Parse points + rebounds combo odds (bet ID 241)
 */
export function parsePlayerPointsReboundsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  for (const gameOdds of odds) {
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    if (bet365) {
      const prBet = bet365.bets?.find(b => b.id === 241);
      if (prBet) {
        playerOdds.push(...parseGenericPlayerOdds(prBet));
      }
    }
  }
  
  return playerOdds;
}

/**
 * Parse points + rebounds + assists combo odds (bet ID 242)
 */
export function parsePlayerPointsReboundsAssistsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  for (const gameOdds of odds) {
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    if (bet365) {
      const praBet = bet365.bets?.find(b => b.id === 242);
      if (praBet) {
        playerOdds.push(...parseGenericPlayerOdds(praBet));
      }
    }
  }
  
  return playerOdds;
}

/**
 * Parse rebounds + assists combo odds (bet ID 240)
 */
export function parsePlayerRunsOdds(odds: ApiSportsOdds[]): ParsedPlayerOdds[] {
  const playerOdds: ParsedPlayerOdds[] = [];
  
  for (const gameOdds of odds) {
    const bet365 = gameOdds.bookmakers?.find(b => b.id === 4);
    if (bet365) {
      const raBet = bet365.bets?.find(b => b.id === 240);
      if (raBet) {
        playerOdds.push(...parseGenericPlayerOdds(raBet));
      }
    }
  }
  
  return playerOdds;
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
      return parsePlayerPointsOdds;
  }
}
