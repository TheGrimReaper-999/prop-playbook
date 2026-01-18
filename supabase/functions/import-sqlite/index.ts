import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";

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
      // Expecting array of fixture objects
      const fixtures = data.map((row: any) => ({
        event_id: row.event_id || row.eventId,
        game_date: row.game_date || row.gameDate,
        status: row.status || 'scheduled',
        status_detail: row.status_detail || row.statusDetail,
        season: row.season,
        home_team_id: row.home_team_id || row.homeTeamId,
        home_team_name: row.home_team_name || row.homeTeamName,
        home_team_abbrev: row.home_team_abbrev || row.homeTeamAbbrev,
        home_team_logo: row.home_team_logo || row.homeTeamLogo,
        home_team_score: row.home_team_score || row.homeTeamScore,
        away_team_id: row.away_team_id || row.awayTeamId,
        away_team_name: row.away_team_name || row.awayTeamName,
        away_team_abbrev: row.away_team_abbrev || row.awayTeamAbbrev,
        away_team_logo: row.away_team_logo || row.awayTeamLogo,
        away_team_score: row.away_team_score || row.awayTeamScore,
        venue_name: row.venue_name || row.venueName,
        venue_city: row.venue_city || row.venueCity,
        venue_state: row.venue_state || row.venueState,
      }));

      // Batch upsert
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < fixtures.length; i += batchSize) {
        const batch = fixtures.slice(i, i + batchSize);
        const { error } = await supabase
          .from("nba_fixtures")
          .upsert(batch, { onConflict: "event_id" });
        if (error) throw error;
        inserted += batch.length;
      }

      return new Response(
        JSON.stringify({ success: true, inserted, type: "fixtures" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "stats") {
      // Expecting array of stat objects
      const stats = data.map((row: any) => ({
        event_id: row.event_id || row.eventId,
        game_date: row.game_date || row.gameDate,
        player_id: row.player_id || row.playerId || null,
        player_name: row.player_name || row.playerName,
        minutes: row.minutes || row.min,
        points: row.points || row.pts,
        rebounds: row.rebounds || row.reb,
        assists: row.assists || row.ast,
        steals: row.steals || row.stl,
        blocks: row.blocks || row.blk,
        turnovers: row.turnovers || row.tov,
        fouls: row.fouls || row.pf,
        plus_minus: row.plus_minus || row.plusMinus,
        field_goals_made: row.field_goals_made || row.fgm,
        field_goals_attempted: row.field_goals_attempted || row.fga,
        field_goal_pct: row.field_goal_pct || row.fgPct,
        three_pt_made: row.three_pt_made || row.fg3m,
        three_pt_attempted: row.three_pt_attempted || row.fg3a,
        three_pt_pct: row.three_pt_pct || row.fg3Pct,
        free_throws_made: row.free_throws_made || row.ftm,
        free_throws_attempted: row.free_throws_attempted || row.fta,
        free_throw_pct: row.free_throw_pct || row.ftPct,
      }));

      // Batch insert
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < stats.length; i += batchSize) {
        const batch = stats.slice(i, i + batchSize);
        const { error } = await supabase
          .from("nba_player_stats")
          .insert(batch);
        if (error) {
          console.error("Insert error:", error);
          // Continue with next batch
        } else {
          inserted += batch.length;
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
