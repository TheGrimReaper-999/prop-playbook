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
  
  // Prefer BetMGM, then FanDuel, then DraftKings
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

async function fetchWithFallback(url: string, primaryKey: string, backupKey: string | null, tertiaryKey: string | null): Promise<Response> {
  // Try primary key first
  const primaryUrl = url.replace('API_KEY_PLACEHOLDER', primaryKey);
  console.log(`🔑 Trying primary API key...`);
  
  let response = await fetch(primaryUrl);
  
  // If primary fails with auth/rate limit error and we have a backup, try backup
  if (!response.ok && backupKey && (response.status === 401 || response.status === 429 || response.status === 403)) {
    console.log(`⚠️ Primary key failed (${response.status}), trying backup key...`);
    const backupUrl = url.replace('API_KEY_PLACEHOLDER', backupKey);
    response = await fetch(backupUrl);
    
    if (response.ok) {
      console.log(`✅ Backup key succeeded!`);
    } else {
      console.log(`❌ Backup key also failed (${response.status})`);
      
      // If backup also fails, try tertiary key
      if (tertiaryKey && (response.status === 401 || response.status === 429 || response.status === 403)) {
        console.log(`⚠️ Backup key failed (${response.status}), trying tertiary key...`);
        const tertiaryUrl = url.replace('API_KEY_PLACEHOLDER', tertiaryKey);
        response = await fetch(tertiaryUrl);
        
        if (response.ok) {
          console.log(`✅ Tertiary key succeeded!`);
        } else {
          console.log(`❌ Tertiary key also failed (${response.status})`);
        }
      }
    }
  }
  
  return response;
}

async function getTodayNBAEvents(primaryKey: string, backupKey: string | null, tertiaryKey: string | null): Promise<TheOddsApiEvent[]> {
  const eventsUrl = `${API_BASE}/v4/sports/basketball_nba/events?apiKey=API_KEY_PLACEHOLDER`;
  
  const response = await fetchWithFallback(eventsUrl, primaryKey, backupKey, tertiaryKey);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Events API error: ${response.status} - ${errorText}`);
  }

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
  primaryKey: string,
  backupKey: string | null,
  tertiaryKey: string | null
): Promise<PlayerOdds[]> {
  const oddsUrl = `${API_BASE}/v4/sports/basketball_nba/events/${eventId}/odds?apiKey=API_KEY_PLACEHOLDER&regions=us&bookmakers=betmgm,fanduel,draftkings&markets=${marketKey}&oddsFormat=american`;
  
  const response = await fetchWithFallback(oddsUrl, primaryKey, backupKey, tertiaryKey);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Odds API error: ${response.status} - ${errorText}`);
  }

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
    const primaryKey = Deno.env.get('THE_ODDS_API_KEY');
    const backupKey = Deno.env.get('THE_ODDS_API_KEY_BACKUP') ?? null;
    const tertiaryKey = Deno.env.get('THE_ODDS_API_KEY_TERTIARY') ?? null;
    
    if (!primaryKey) {
      throw new Error('THE_ODDS_API_KEY not configured');
    }

    const primaryKeyStr = primaryKey;
    const backupKeyStr = backupKey;
    const tertiaryKeyStr = tertiaryKey;

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
      // Just return events
      const events = await getTodayNBAEvents(primaryKeyStr, backupKeyStr, tertiaryKeyStr);
      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (eventId) {
      // Fetch odds for specific event
      allPlayerOdds = await fetchGameOdds(eventId, marketKey, primaryKeyStr, backupKeyStr, tertiaryKeyStr);
    } else {
      // Fetch odds for all today's events
      const events = await getTodayNBAEvents(primaryKeyStr, backupKeyStr, tertiaryKeyStr);
      
      if (events.length === 0) {
        console.log('No NBA games found for today');
        return new Response(JSON.stringify({ odds: [], events: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      for (const event of events) {
        try {
          const odds = await fetchGameOdds(event.id, marketKey, primaryKeyStr, backupKeyStr, tertiaryKeyStr);
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
