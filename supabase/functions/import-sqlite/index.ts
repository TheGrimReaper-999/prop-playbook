import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, data } = await req.json();
    
    if (type === "fixtures") {
      // Parse fixtures from the JSON format
      const fixtures = data.map((row: any) => {
        // Parse raw_fixture_data if present
        let rawData: any = {};
        if (row.raw_fixture_data) {
          try {
            rawData = JSON.parse(row.raw_fixture_data);
          } catch (e) {
            console.error("Error parsing raw_fixture_data:", e);
          }
        }
        
        // Extract competitors from raw data
        const homeTeam = rawData.competitors?.find((c: any) => c.isHome === true) || {};
        const awayTeam = rawData.competitors?.find((c: any) => c.isHome === false) || {};
        
        return {
          event_id: row.fixture_id || row.event_id,
          game_date: row.date || row.game_date,
          status: row.status_state || row.status || 'scheduled',
          status_detail: row.status_detail || rawData.status?.detail,
          season: row.season || '2025-26',
          home_team_id: homeTeam.id,
          home_team_name: homeTeam.displayName || homeTeam.name,
          home_team_abbrev: homeTeam.abbrev,
          home_team_logo: homeTeam.logo,
          home_team_score: homeTeam.score,
          away_team_id: awayTeam.id,
          away_team_name: awayTeam.displayName || awayTeam.name,
          away_team_abbrev: awayTeam.abbrev,
          away_team_logo: awayTeam.logo,
          away_team_score: awayTeam.score,
          venue_name: row.venue_fullName || rawData.venue?.fullName,
          venue_city: row.venue_city || rawData.venue?.address?.city,
          venue_state: row.venue_state || rawData.venue?.address?.state,
        };
      });

      console.log(`Processing ${fixtures.length} fixtures`);

      // Batch upsert
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < fixtures.length; i += batchSize) {
        const batch = fixtures.slice(i, i + batchSize);
        const { error } = await supabase
          .from("nba_fixtures")
          .upsert(batch, { onConflict: "event_id" });
        if (error) {
          console.error("Upsert error:", error);
          throw error;
        }
        inserted += batch.length;
        console.log(`Inserted ${inserted}/${fixtures.length} fixtures`);
      }

      return new Response(
        JSON.stringify({ success: true, inserted, type: "fixtures" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "stats") {
      // Parse stats from the JSON format
      const stats = data.map((row: any) => ({
        event_id: row.game_id || row.event_id,
        game_date: row.game_date,
        player_id: row.player_id,
        player_name: row.player_name || "Unknown",
        minutes: row.minutes ? parseInt(row.minutes) : null,
        points: row.points,
        rebounds: row.rebounds,
        assists: row.assists,
        steals: row.steals,
        blocks: row.blocks,
        turnovers: row.turnovers,
        fouls: row.fouls,
        plus_minus: row.plus_minus,
        field_goals_made: row.field_goals_made,
        field_goals_attempted: row.field_goals_attempted,
        field_goal_pct: row.field_goal_pct,
        three_pt_made: row.three_point_made,
        three_pt_attempted: row.three_point_attempted,
        three_pt_pct: row.three_point_pct,
        free_throws_made: row.free_throws_made,
        free_throws_attempted: row.free_throws_attempted,
        free_throw_pct: row.free_throw_pct,
      }));

      console.log(`Processing ${stats.length} player stats`);

      // Batch insert (use upsert to avoid duplicates)
      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < stats.length; i += batchSize) {
        const batch = stats.slice(i, i + batchSize);
        const { error } = await supabase
          .from("nba_player_stats")
          .upsert(batch, { 
            onConflict: "player_id,event_id",
          });
        if (error) {
          console.error("Insert error:", error);
          // Continue with next batch
        } else {
          inserted += batch.length;
        }
        if (i % 2000 === 0) {
          console.log(`Processed ${i}/${stats.length} stats`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, inserted, type: "stats" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid type. Use 'fixtures' or 'stats'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
