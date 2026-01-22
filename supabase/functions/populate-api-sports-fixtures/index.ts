import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("API_SPORTS_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Missing required environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Background processing function
  const processFixtures = async () => {
    const startDate = new Date("2025-10-01");
    const endDate = new Date("2026-06-30");
    
    let currentDate = new Date(startDate);
    let totalGames = 0;
    let daysProcessed = 0;
    const errors: string[] = [];

    console.log(`Starting API-Sports fixtures population from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format
      
      try {
        const response = await fetch(
          `https://v1.basketball.api-sports.io/games?league=12&season=2025-2026&date=${dateStr}`,
          {
            headers: {
              "x-apisports-key": apiKey,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const games = data.response || [];

        if (games.length > 0) {
          // Map games to database rows
          const rows = games.map((game: any) => ({
            game_id: game.id,
            game_date: game.date,
            game_time: game.time,
            game_timestamp: game.timestamp,
            timezone: game.timezone || "UTC",
            stage: game.stage,
            week: game.week,
            venue: game.venue,
            status_long: game.status?.long,
            status_short: game.status?.short,
            status_timer: game.status?.timer,
            league_id: game.league?.id,
            league_name: game.league?.name,
            league_type: game.league?.type,
            league_season: game.league?.season,
            league_logo: game.league?.logo,
            country_id: game.country?.id,
            country_name: game.country?.name,
            country_code: game.country?.code,
            country_flag: game.country?.flag,
            home_team_id: game.teams?.home?.id,
            home_team_name: game.teams?.home?.name,
            home_team_logo: game.teams?.home?.logo,
            away_team_id: game.teams?.away?.id,
            away_team_name: game.teams?.away?.name,
            away_team_logo: game.teams?.away?.logo,
            home_score_q1: game.scores?.home?.quarter_1,
            home_score_q2: game.scores?.home?.quarter_2,
            home_score_q3: game.scores?.home?.quarter_3,
            home_score_q4: game.scores?.home?.quarter_4,
            home_score_ot: game.scores?.home?.over_time,
            home_score_total: game.scores?.home?.total,
            away_score_q1: game.scores?.away?.quarter_1,
            away_score_q2: game.scores?.away?.quarter_2,
            away_score_q3: game.scores?.away?.quarter_3,
            away_score_q4: game.scores?.away?.quarter_4,
            away_score_ot: game.scores?.away?.over_time,
            away_score_total: game.scores?.away?.total,
            raw_data: game,
          }));

          // Upsert games
          const { error: upsertError } = await supabase
            .from("api_sports_fixtures")
            .upsert(rows, { onConflict: "game_id" });

          if (upsertError) {
            console.error(`Error upserting games for ${dateStr}:`, upsertError);
            errors.push(`${dateStr}: ${upsertError.message}`);
          } else {
            totalGames += games.length;
          }
        }

        daysProcessed++;
        
        // Log progress every 10 days
        if (daysProcessed % 10 === 0) {
          console.log(`Processed ${daysProcessed} days, ${totalGames} games so far`);
        }

        // Rate limiting - 100ms delay between requests
        await delay(100);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error fetching games for ${dateStr}:`, errorMsg);
        errors.push(`${dateStr}: ${errorMsg}`);
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Completed! Processed ${daysProcessed} days, ${totalGames} total games`);
    if (errors.length > 0) {
      console.log(`Errors encountered: ${errors.length}`);
    }
  };

  // Start background processing
  (globalThis as any).EdgeRuntime.waitUntil(processFixtures());

  // Return immediately
  return new Response(
    JSON.stringify({
      success: true,
      message: "API-Sports fixtures population started in background",
      dateRange: {
        start: "2025-10-01",
        end: "2026-06-30",
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
