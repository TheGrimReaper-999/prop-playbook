import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'nba-api-free-data.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Endpoint mapping for the RapidAPI NBA Free Data API
const ENDPOINTS = {
  // Player endpoints
  'player-list': '/nba-player-list',           // ?teamid=13
  'player-info': '/nba-player-info',           // ?playerid=4869342
  'player-gamelog': '/nba-player-gamelog',     // ?playerid=4869342
  // Team division endpoints
  'teams-southwest': '/nba-southwest-team-list',
  'teams-pacific': '/nba-pacific-team-list',
  'teams-northwest': '/nba-northwest-team-list',
  'teams-southeast': '/nba-southeast-team-list',
  'teams-atlantic': '/nba-atlantic-team-list',
  'teams-central': '/nba-central-team-list',
} as const;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, teamId, playerId } = await req.json();
    const apiKey = Deno.env.get('RAPIDAPI_NBA_KEY');
    
    if (!apiKey) {
      console.error('RAPIDAPI_NBA_KEY is not configured');
      throw new Error('API key not configured');
    }

    let url: string;
    
    switch (action) {
      case 'player-list':
        if (!teamId) throw new Error('teamId is required for player-list');
        url = `${BASE_URL}${ENDPOINTS['player-list']}?teamid=${teamId}`;
        break;
      case 'player-info':
        if (!playerId) throw new Error('playerId is required for player-info');
        url = `${BASE_URL}${ENDPOINTS['player-info']}?playerid=${playerId}`;
        break;
      case 'player-gamelog':
        if (!playerId) throw new Error('playerId is required for player-gamelog');
        url = `${BASE_URL}${ENDPOINTS['player-gamelog']}?playerid=${playerId}`;
        break;
      // Team division endpoints
      case 'teams-southwest':
        url = `${BASE_URL}${ENDPOINTS['teams-southwest']}`;
        break;
      case 'teams-pacific':
        url = `${BASE_URL}${ENDPOINTS['teams-pacific']}`;
        break;
      case 'teams-northwest':
        url = `${BASE_URL}${ENDPOINTS['teams-northwest']}`;
        break;
      case 'teams-southeast':
        url = `${BASE_URL}${ENDPOINTS['teams-southeast']}`;
        break;
      case 'teams-atlantic':
        url = `${BASE_URL}${ENDPOINTS['teams-atlantic']}`;
        break;
      case 'teams-central':
        url = `${BASE_URL}${ENDPOINTS['teams-central']}`;
        break;
      case 'all-teams':
        // Fetch all divisions in parallel and combine
        console.log('Fetching all NBA teams from all divisions...');
        const divisions = ['southwest', 'pacific', 'northwest', 'southeast', 'atlantic', 'central'];
        const divisionPromises = divisions.map(async (div) => {
          const divUrl = `${BASE_URL}/nba-${div}-team-list`;
          const response = await fetch(divUrl, {
            method: 'GET',
            headers: {
              'x-rapidapi-host': RAPIDAPI_HOST,
              'x-rapidapi-key': apiKey,
            },
          });
          if (!response.ok) {
            console.error(`Failed to fetch ${div} division: ${response.status}`);
            return { division: div, teams: [] };
          }
          const data = await response.json();
          return { division: div, teams: data };
        });
        
        const allDivisions = await Promise.all(divisionPromises);
        console.log('Successfully fetched all NBA divisions');
        
        return new Response(JSON.stringify(allDivisions), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      default:
        throw new Error(`Unknown action: ${action}. Available actions: player-list, player-info, player-gamelog, teams-southwest, teams-pacific, teams-northwest, teams-southeast, teams-atlantic, teams-central, all-teams`);
    }

    console.log(`Fetching NBA data: action=${action}, url=${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`RapidAPI error: ${response.status} - ${errorText}`);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully fetched NBA data for action: ${action}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch NBA data';
    console.error('Error in nba-stats function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
