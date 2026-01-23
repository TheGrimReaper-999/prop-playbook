import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Prediction {
  id: string;
  player_id: string | null;
  player_name: string;
  stat_type: string;
  prop_line: number;
  predicted_mean: number;
  decision: string;
  event_id: string | null;
  created_at: string;
}

interface PlayerStats {
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  three_pt_made: number | null;
  steals: number | null;
  blocks: number | null;
  event_id: string;
  game_date: string;
  player_id: string;
}

interface ErrorTracker {
  id: string;
  player_id: string;
  stat_type: string;
  error_ema: number;
  recent_errors: number[];
  beta: number;
  total_predictions: number;
}

// Get the actual stat value based on stat type
function getStatValue(stats: PlayerStats, statType: string): number {
  const pts = stats.points || 0;
  const reb = stats.rebounds || 0;
  const ast = stats.assists || 0;
  const fg3m = stats.three_pt_made || 0;
  const stl = stats.steals || 0;
  const blk = stats.blocks || 0;

  switch (statType) {
    case 'pts': return pts;
    case 'reb': return reb;
    case 'ast': return ast;
    case '3pm': return fg3m;
    case 'stl': return stl;
    case 'blk': return blk;
    case 'pra': return pts + reb + ast;
    case 'pr': return pts + reb;
    case 'pa': return pts + ast;
    case 'ra': return reb + ast;
    case 'stl+blk': return stl + blk;
    default: return 0;
  }
}

// Check if a game has finished based on fixture status
function isGameFinished(status: string): boolean {
  const finishedStatuses = ['post', 'final', 'completed', 'finished'];
  return finishedStatuses.some(s => status?.toLowerCase().includes(s));
}

// Calculate outcome (win/loss/push)
function calculateOutcome(
  decision: string,
  actualValue: number,
  propLine: number
): 'win' | 'loss' | 'push' {
  if (actualValue === propLine) return 'push';
  
  if (decision === 'TAKE OVER') {
    return actualValue > propLine ? 'win' : 'loss';
  } else if (decision === 'TAKE UNDER') {
    return actualValue < propLine ? 'win' : 'loss';
  }
  
  return 'push'; // NO BET case
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for admin operations
    const authHeader = req.headers.get('Authorization');
    const expectedToken = Deno.env.get('CRON_SECRET');
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[process-prediction-feedback] Starting feedback processing...');

    // 1. Fetch unprocessed predictions
    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select('*')
      .eq('processed', false)
      .limit(100);

    if (predError) {
      console.error('[process-prediction-feedback] Error fetching predictions:', predError);
      throw predError;
    }

    if (!predictions || predictions.length === 0) {
      console.log('[process-prediction-feedback] No unprocessed predictions found');
      return new Response(
        JSON.stringify({ message: 'No predictions to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-prediction-feedback] Found ${predictions.length} unprocessed predictions`);

    // 2. Get unique player IDs/names to batch lookup
    const playerNames = [...new Set(predictions.map(p => p.player_name))];
    
    // Batch fetch player IDs
    const { data: players } = await supabase
      .from('nba_players')
      .select('id, full_name')
      .in('full_name', playerNames);

    const playerIdMap = new Map<string, string>();
    players?.forEach(p => playerIdMap.set(p.full_name.toLowerCase(), p.id));

    // 3. Process each prediction
    let processedCount = 0;
    let errorTrackerUpdates: Map<string, ErrorTracker> = new Map();

    for (const prediction of predictions as Prediction[]) {
      try {
        // Get player ID
        const playerId = prediction.player_id || playerIdMap.get(prediction.player_name.toLowerCase());
        
        if (!playerId) {
          console.log(`[process-prediction-feedback] Player not found: ${prediction.player_name}`);
          continue;
        }

        // Find the player's next game AFTER the prediction was made
        const { data: stats } = await supabase
          .from('nba_player_stats')
          .select('*')
          .eq('player_id', playerId)
          .gte('game_date', prediction.created_at)
          .order('game_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!stats) {
          // No game found yet, skip
          continue;
        }

        // Check if the game is finished
        const { data: fixture } = await supabase
          .from('nba_fixtures')
          .select('status')
          .eq('event_id', stats.event_id)
          .maybeSingle();

        if (!fixture || !isGameFinished(fixture.status)) {
          // Game not finished yet
          continue;
        }

        // Game is finished! Calculate actual value and outcome
        const actualValue = getStatValue(stats as PlayerStats, prediction.stat_type);
        const outcome = calculateOutcome(prediction.decision, actualValue, prediction.prop_line);
        const error = actualValue - prediction.predicted_mean;

        // Update the prediction record
        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            player_id: playerId,
            event_id: stats.event_id,
            actual_value: actualValue,
            outcome,
            processed: true,
          })
          .eq('id', prediction.id);

        if (updateError) {
          console.error(`[process-prediction-feedback] Error updating prediction ${prediction.id}:`, updateError);
          continue;
        }

        // Update error tracker (aggregate by player_id + stat_type)
        const trackerKey = `${playerId}:${prediction.stat_type}`;
        let tracker = errorTrackerUpdates.get(trackerKey);
        
        if (!tracker) {
          // Fetch existing tracker
          const { data: existingTracker } = await supabase
            .from('player_error_trackers')
            .select('*')
            .eq('player_id', playerId)
            .eq('stat_type', prediction.stat_type)
            .maybeSingle();

          if (existingTracker) {
            tracker = existingTracker as ErrorTracker;
          } else {
            tracker = {
              id: '',
              player_id: playerId,
              stat_type: prediction.stat_type,
              error_ema: 0,
              recent_errors: [],
              beta: 0.3,
              total_predictions: 0,
            };
          }
        }

        // Update error EMA: E_t = β * e + (1-β) * E_{t-1}
        const beta = tracker.beta;
        tracker.error_ema = beta * error + (1 - beta) * tracker.error_ema;
        
        // Add to recent errors (keep last 20)
        tracker.recent_errors = [...tracker.recent_errors, error].slice(-20);
        tracker.total_predictions += 1;

        errorTrackerUpdates.set(trackerKey, tracker);
        processedCount++;

        console.log(`[process-prediction-feedback] Processed: ${prediction.player_name} ${prediction.stat_type} - actual: ${actualValue}, outcome: ${outcome}`);
      } catch (err) {
        console.error(`[process-prediction-feedback] Error processing prediction ${prediction.id}:`, err);
      }
    }

    // 4. Batch upsert error trackers
    for (const [key, tracker] of errorTrackerUpdates) {
      const { error: upsertError } = await supabase
        .from('player_error_trackers')
        .upsert({
          player_id: tracker.player_id,
          stat_type: tracker.stat_type,
          error_ema: tracker.error_ema,
          recent_errors: tracker.recent_errors,
          beta: tracker.beta,
          total_predictions: tracker.total_predictions,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id,stat_type',
        });

      if (upsertError) {
        console.error(`[process-prediction-feedback] Error upserting error tracker ${key}:`, upsertError);
      }
    }

    console.log(`[process-prediction-feedback] Done. Processed ${processedCount} predictions, updated ${errorTrackerUpdates.size} error trackers`);

    return new Response(
      JSON.stringify({
        message: 'Feedback processing complete',
        processed: processedCount,
        trackersUpdated: errorTrackerUpdates.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[process-prediction-feedback] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
