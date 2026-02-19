import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.the-odds-api.com';

// Map internal stat types to The Odds API market keys
const STAT_TYPE_TO_MARKET: Record<string, string> = {
  'pts': 'player_points',
  'reb': 'player_rebounds',
  'ast': 'player_assists',
  '3pm': 'player_threes',
  'stl': 'player_steals',
  'blk': 'player_blocks',
  'pr': 'player_points_rebounds',
  'pa': 'player_points_assists',
  'ra': 'player_rebounds_assists',
  'pra': 'player_points_rebounds_assists',
};

const STAT_TYPE_TO_ALTERNATE_MARKET: Record<string, string> = {
  'pts': 'player_points_alternate',
  'reb': 'player_rebounds_alternate',
  'ast': 'player_assists_alternate',
  '3pm': 'player_threes_alternate',
  'stl': 'player_steals_alternate',
  'blk': 'player_blocks_alternate',
};

interface PlayerOdds {
  playerName: string;
  line: number;
  overOdds: number;
  underOdds: number;
  overOddsAmerican: string;
  underOddsAmerican: string;
}

interface TheOddsApiOutcome {
  name: string;
  description: string;
  price: number;
  point: number;
}

interface TheOddsApiMarket {
  key: string;
  outcomes: TheOddsApiOutcome[];
}

interface TheOddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: TheOddsApiMarket[];
}

interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

interface TheOddsApiGameWithOdds extends TheOddsApiEvent {
  bookmakers: TheOddsApiBookmaker[];
}

// Collect all available API keys
function getAllApiKeys(): string[] {
  const keyNames = [
    'THE_ODDS_API_KEY',
    'THE_ODDS_API_KEY_BACKUP',
    'THE_ODDS_API_KEY_TERTIARY',
    'THE_ODDS_API_KEY_4',
    'THE_ODDS_API_KEY_5',
    'THE_ODDS_API_KEY_6',
    'THE_ODDS_API_KEY_7',
  ];
  const keys: string[] = [];
  for (const name of keyNames) {
    const val = Deno.env.get(name);
    if (val) keys.push(val);
  }
  return keys;
}

function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

function formatAmerican(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}

function parsePlayerOdds(bookmakers: TheOddsApiBookmaker[], marketKey: string): PlayerOdds[] {
  const playerOdds: PlayerOdds[] = [];
  
  const bookmaker = bookmakers?.find(b => b.key === 'betmgm') 
    || bookmakers?.find(b => b.key === 'fanduel')
    || bookmakers?.find(b => b.key === 'draftkings')
    || bookmakers?.[0];
  
  if (!bookmaker) return playerOdds;
  
  const market = bookmaker.markets?.find(m => m.key === marketKey);
  if (!market) return playerOdds;
  
  const isAlternateMarket = marketKey.includes('_alternate');
  
  if (isAlternateMarket) {
    for (const outcome of market.outcomes) {
      if (outcome.name === 'Over') {
        playerOdds.push({
          playerName: outcome.description,
          line: outcome.point,
          overOdds: americanToDecimal(outcome.price),
          underOdds: 0,
          overOddsAmerican: formatAmerican(outcome.price),
          underOddsAmerican: '',
        });
      }
    }
  } else {
    const playerOutcomes: Record<string, { over?: TheOddsApiOutcome; under?: TheOddsApiOutcome }> = {};
    
    for (const outcome of market.outcomes) {
      const key = `${outcome.description}-${outcome.point}`;
      if (!playerOutcomes[key]) playerOutcomes[key] = {};
      
      if (outcome.name === 'Over') {
        playerOutcomes[key].over = outcome;
      } else if (outcome.name === 'Under') {
        playerOutcomes[key].under = outcome;
      }
    }
    
    for (const [, outcomes] of Object.entries(playerOutcomes)) {
      if (outcomes.over && outcomes.under) {
        playerOdds.push({
          playerName: outcomes.over.description,
          line: outcomes.over.point,
          overOdds: americanToDecimal(outcomes.over.price),
          underOdds: americanToDecimal(outcomes.under.price),
          overOddsAmerican: formatAmerican(outcomes.over.price),
          underOddsAmerican: formatAmerican(outcomes.under.price),
        });
      }
    }
  }
  
  return playerOdds;
}

/**
 * Fetch a URL trying all available API keys in sequence.
 * Returns the first successful response, or throws if all keys fail.
 */
async function fetchWithAllKeys(urlTemplate: string, keys: string[]): Promise<Response> {
  let lastError = '';
  
  for (let i = 0; i < keys.length; i++) {
    const url = urlTemplate.replace('API_KEY_PLACEHOLDER', keys[i]);
    console.log(`🔑 Trying key ${i + 1}/${keys.length}...`);
    
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        console.log(`✅ Key ${i + 1} succeeded`);
        return response;
      }
      
      const errorText = await response.text();
      lastError = `Key ${i + 1}: ${response.status} - ${errorText}`;
      console.log(`⚠️ Key ${i + 1} failed (${response.status})`);
      
      // Only rotate on auth/rate-limit errors; other errors likely affect all keys
      if (response.status !== 401 && response.status !== 403 && response.status !== 429) {
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('API error:')) {
        throw err;
      }
      lastError = `Key ${i + 1}: ${err instanceof Error ? err.message : 'Network error'}`;
      console.log(`⚠️ Key ${i + 1} network error`);
    }
  }
  
  throw new Error(`All ${keys.length} API keys exhausted. Last error: ${lastError}`);
}

async function getTodayNBAEvents(keys: string[]): Promise<TheOddsApiEvent[]> {
  const eventsUrl = `${API_BASE}/v4/sports/basketball_nba/events?apiKey=API_KEY_PLACEHOLDER`;
  
  const response = await fetchWithAllKeys(eventsUrl, keys);
  const events: TheOddsApiEvent[] = await response.json();
  
  // Filter events for next 24 hours
  const now = Date.now();
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
  
  return events.filter(event => {
    const eventDate = new Date(event.commence_time);
    return eventDate >= new Date(now) && eventDate <= tomorrow;
  });
}

async function fetchGameOdds(
  eventId: string, 
  marketKey: string,
  keys: string[]
): Promise<PlayerOdds[]> {
  const oddsUrl = `${API_BASE}/v4/sports/basketball_nba/events/${eventId}/odds?apiKey=API_KEY_PLACEHOLDER&regions=us&bookmakers=betmgm,fanduel,draftkings&markets=${marketKey}&oddsFormat=american`;
  
  const response = await fetchWithAllKeys(oddsUrl, keys);
  const gameWithOdds: TheOddsApiGameWithOdds = await response.json();
  
  if (!gameWithOdds.bookmakers?.length) {
    return [];
  }

  return parsePlayerOdds(gameWithOdds.bookmakers, marketKey);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const keys = getAllApiKeys();
    
    if (keys.length === 0) {
      throw new Error('No API keys configured');
    }
    
    console.log(`🔑 ${keys.length} API keys available for rotation`);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'props';
    const statType = url.searchParams.get('statType') || 'pts';
    const eventId = url.searchParams.get('eventId');
    const alternate = url.searchParams.get('alternate') === 'true';

    console.log(`📊 The Odds API request: action=${action}, statType=${statType}, eventId=${eventId}, alternate=${alternate}`);

    // Get market key
    const marketKey = alternate 
      ? STAT_TYPE_TO_ALTERNATE_MARKET[statType] 
      : STAT_TYPE_TO_MARKET[statType];
    
    if (!marketKey) {
      throw new Error(`Unsupported stat type: ${statType}`);
    }

    let allPlayerOdds: PlayerOdds[] = [];

    if (action === 'events') {
      const events = await getTodayNBAEvents(keys);
      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (eventId) {
      allPlayerOdds = await fetchGameOdds(eventId, marketKey, keys);
    } else {
      const events = await getTodayNBAEvents(keys);
      
      if (events.length === 0) {
        console.log('No NBA games found for today');
        return new Response(JSON.stringify({ odds: [], events: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      for (const event of events) {
        try {
          const odds = await fetchGameOdds(event.id, marketKey, keys);
          allPlayerOdds = allPlayerOdds.concat(odds);
        } catch (error) {
          console.error(`Failed to fetch odds for event ${event.id}:`, error);
          continue;
        }
      }
    }

    console.log(`📊 Returning ${allPlayerOdds.length} player odds`);

    return new Response(JSON.stringify({ odds: allPlayerOdds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('The Odds API error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
