import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParlayLeg {
  legId: string;
  player: { id: string; name: string; team: string };
  statType: string;
  mainLine: string;
  decision: string;
  eventId?: string;
  [key: string]: unknown;
}

interface Parlay {
  id: string;
  name: string;
  created_at: string;
  legs: ParlayLeg[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { parlayIds } = await req.json() as { parlayIds?: string[] };

    // Fetch parlays - either specific ones or all that might need updating
    let query = supabase.from("parlays").select("id, name, created_at, legs");
    if (parlayIds && parlayIds.length > 0) {
      query = query.in("id", parlayIds);
    }
    
    const { data: parlays, error: parlaysError } = await query;
    if (parlaysError) throw parlaysError;

    console.log(`Processing ${parlays?.length || 0} parlays`);

    // Get all player names from all parlays
    const playerNames = new Set<string>();
    const allLegs: { parlayId: string; leg: ParlayLeg; createdAt: string }[] = [];
    
    for (const parlay of parlays || []) {
      const legs = parlay.legs as ParlayLeg[];
      for (const leg of legs) {
        // Skip legs that already have eventId
        if (leg.eventId) continue;
        playerNames.add(leg.player.name);
        allLegs.push({ parlayId: parlay.id, leg, createdAt: parlay.created_at });
      }
    }

    if (allLegs.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No legs need updating",
        updated: 0 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Found ${allLegs.length} legs without eventId for ${playerNames.size} players`);

    // Fetch all players
    const { data: players } = await supabase
      .from("nba_players")
      .select("id, full_name")
      .in("full_name", Array.from(playerNames));

    const playerIdMap = new Map<string, string>();
    players?.forEach(p => playerIdMap.set(p.full_name.toLowerCase(), p.id));

    // Get the earliest parlay date
    const earliestDate = allLegs.reduce((min, item) => 
      item.createdAt < min ? item.createdAt : min, 
      allLegs[0].createdAt
    );

    // Fetch all player stats since earliest parlay
    const playerIds = Array.from(playerIdMap.values());
    const { data: allStats } = await supabase
      .from("nba_player_stats")
      .select("player_id, event_id, game_date")
      .in("player_id", playerIds)
      .gte("game_date", earliestDate)
      .order("game_date", { ascending: true });

    // Group stats by player_id
    const statsByPlayer = new Map<string, typeof allStats>();
    (allStats || []).forEach(stat => {
      const existing = statsByPlayer.get(stat.player_id!) || [];
      existing.push(stat);
      statsByPlayer.set(stat.player_id!, existing);
    });

    // Track updates by parlay
    const parlayUpdates = new Map<string, { id: string; legs: ParlayLeg[] }>();

    // Initialize with original parlay data
    for (const parlay of parlays || []) {
      parlayUpdates.set(parlay.id, { id: parlay.id, legs: [...(parlay.legs as ParlayLeg[])] });
    }

    let updatedLegsCount = 0;

    // Match legs to events
    for (const { parlayId, leg, createdAt } of allLegs) {
      const playerId = playerIdMap.get(leg.player.name.toLowerCase());
      if (!playerId) {
        console.log(`Player not found: ${leg.player.name}`);
        continue;
      }

      const playerStats = statsByPlayer.get(playerId) || [];
      
      // Find the closest game to parlay creation (within a 24-hour window before or after)
      // Games might have started before the parlay was saved (e.g., user saves parlay at halftime)
      const parlayDate = new Date(createdAt);
      const windowStart = new Date(parlayDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
      const windowEnd = new Date(parlayDate.getTime() + 48 * 60 * 60 * 1000);   // 48 hours after
      
      // Find games within the window, prioritizing the closest one after parlay creation
      const gamesInWindow = playerStats.filter(s => {
        const gameDate = new Date(s.game_date);
        return gameDate >= windowStart && gameDate <= windowEnd;
      });
      
      // Sort by proximity to parlay creation (prefer games after, then games before but close)
      gamesInWindow.sort((a, b) => {
        const aDate = new Date(a.game_date);
        const bDate = new Date(b.game_date);
        const aAfter = aDate >= parlayDate;
        const bAfter = bDate >= parlayDate;
        
        // Prefer games after parlay creation
        if (aAfter && !bAfter) return -1;
        if (!aAfter && bAfter) return 1;
        
        // If both after, pick earliest
        if (aAfter && bAfter) return aDate.getTime() - bDate.getTime();
        
        // If both before, pick latest (closest to parlay creation)
        return bDate.getTime() - aDate.getTime();
      });
      
      const matchingStat = gamesInWindow[0];
      
      if (matchingStat) {
        console.log(`Matched ${leg.player.name} to event ${matchingStat.event_id} (game: ${matchingStat.game_date})`);
        
        // Update the leg with eventId
        const parlayData = parlayUpdates.get(parlayId)!;
        const legIndex = parlayData.legs.findIndex(l => l.legId === leg.legId);
        if (legIndex >= 0) {
          parlayData.legs[legIndex] = { ...parlayData.legs[legIndex], eventId: matchingStat.event_id };
          updatedLegsCount++;
        }
      } else {
        console.log(`No matching game found for ${leg.player.name} after ${createdAt}`);
      }
    }

    // Save updates
    const updateResults = [];
    for (const [parlayId, parlayData] of parlayUpdates) {
      const { error } = await supabase
        .from("parlays")
        .update({ legs: parlayData.legs })
        .eq("id", parlayId);
      
      if (error) {
        console.error(`Error updating parlay ${parlayId}:`, error);
        updateResults.push({ parlayId, success: false, error: error.message });
      } else {
        updateResults.push({ parlayId, success: true });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Updated ${updatedLegsCount} legs across ${parlayUpdates.size} parlays`,
      updatedLegs: updatedLegsCount,
      results: updateResults
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
