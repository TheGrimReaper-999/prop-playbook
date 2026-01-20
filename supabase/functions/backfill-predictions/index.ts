import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParlayLeg {
  id: string;
  legId?: string;
  player: { id: string; name: string; team?: string };
  statType: string;
  line?: number;
  mainLine?: number;
  decision: string;
  predictedMean?: number;
}

interface PlayerStats {
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  three_pt_made: number | null;
  game_date: string;
  event_id: string;
}

function getStatValue(stats: PlayerStats, statType: string): number {
  const type = statType.toLowerCase();
  switch (type) {
    case 'points':
    case 'pts':
      return stats.points ?? 0;
    case 'rebounds':
    case 'reb':
      return stats.rebounds ?? 0;
    case 'assists':
    case 'ast':
      return stats.assists ?? 0;
    case 'steals':
    case 'stl':
      return stats.steals ?? 0;
    case 'blocks':
    case 'blk':
      return stats.blocks ?? 0;
    case 'turnovers':
    case 'to':
      return stats.turnovers ?? 0;
    case '3pm':
    case 'threes':
    case 'three_pt_made':
      return stats.three_pt_made ?? 0;
    case 'pts+reb':
    case 'points+rebounds':
      return (stats.points ?? 0) + (stats.rebounds ?? 0);
    case 'pts+ast':
    case 'points+assists':
      return (stats.points ?? 0) + (stats.assists ?? 0);
    case 'reb+ast':
    case 'rebounds+assists':
      return (stats.rebounds ?? 0) + (stats.assists ?? 0);
    case 'pra':
    case 'pts+reb+ast':
      return (stats.points ?? 0) + (stats.rebounds ?? 0) + (stats.assists ?? 0);
    case 'stl+blk':
    case 'stocks':
      return (stats.steals ?? 0) + (stats.blocks ?? 0);
    default:
      return 0;
  }
}

function calculateMovingAverage(stats: number[]): number {
  if (stats.length === 0) return 0;
  return stats.reduce((sum, val) => sum + val, 0) / stats.length;
}

function calculateEma(stats: number[], weight: number = 0.6): number {
  if (stats.length === 0) return 0;
  if (stats.length === 1) return stats[0];
  
  const k = weight;
  let ema = stats[0];
  for (let i = 1; i < stats.length; i++) {
    ema = k * stats[i] + (1 - k) * ema;
  }
  return ema;
}

function calculateOutcome(decision: string, actualValue: number, propLine: number): 'win' | 'loss' | 'push' {
  const isOver = decision.toLowerCase().includes('over');
  
  if (actualValue === propLine) return 'push';
  if (isOver) {
    return actualValue > propLine ? 'win' : 'loss';
  } else {
    return actualValue < propLine ? 'win' : 'loss';
  }
}

function isGameFinished(status: string): boolean {
  const finishedStatuses = ['final', 'completed', 'closed', 'finished', 'post'];
  return finishedStatuses.some(s => status.toLowerCase().includes(s));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for options
    let options = { dryRun: false, limit: 100, parlayId: null as string | null };
    try {
      const body = await req.json();
      options = { ...options, ...body };
    } catch {
      // No body provided, use defaults
    }

    console.log('Backfill starting with options:', options);

    // Fetch all parlays
    let parlayQuery = supabase.from('parlays').select('*').order('created_at', { ascending: true });
    if (options.parlayId) {
      parlayQuery = parlayQuery.eq('id', options.parlayId);
    }
    if (options.limit) {
      parlayQuery = parlayQuery.limit(options.limit);
    }

    const { data: parlays, error: parlaysError } = await parlayQuery;
    if (parlaysError) throw parlaysError;

    console.log(`Found ${parlays?.length || 0} parlays to process`);

    let predictionsCreated = 0;
    let trackersUpdated = 0;
    const processedLegs: Array<{ parlay: string; player: string; statType: string; outcome: string }> = [];
    const skippedLegs: Array<{ parlay: string; player: string; reason: string }> = [];

    for (const parlay of parlays || []) {
      const legs = parlay.legs as ParlayLeg[];
      if (!Array.isArray(legs)) continue;

      for (const leg of legs) {
        // Skip legs that already have predictedMean (already processed by new system)
        if (leg.predictedMean !== undefined) {
          skippedLegs.push({ parlay: parlay.name, player: leg.player?.name || 'unknown', reason: 'already has predictedMean' });
          continue;
        }

        // Skip legs without a decision
        if (!leg.decision || leg.decision === 'NO BET') {
          skippedLegs.push({ parlay: parlay.name, player: leg.player?.name || 'unknown', reason: 'no decision' });
          continue;
        }

        const playerName = leg.player?.name;
        if (!playerName) {
          skippedLegs.push({ parlay: parlay.name, player: 'unknown', reason: 'no player name' });
          continue;
        }

        // Look up player in database
        const { data: playerData } = await supabase
          .from('nba_players')
          .select('id, full_name')
          .ilike('full_name', playerName)
          .single();

        if (!playerData) {
          skippedLegs.push({ parlay: parlay.name, player: playerName, reason: 'player not found in db' });
          continue;
        }

        const playerId = playerData.id;

        // Check if prediction already exists for this parlay/player/stat combination
        const { data: existingPrediction } = await supabase
          .from('predictions')
          .select('id')
          .eq('parlay_id', parlay.id)
          .eq('player_id', playerId)
          .eq('stat_type', leg.statType)
          .single();

        if (existingPrediction) {
          skippedLegs.push({ parlay: parlay.name, player: playerName, reason: 'prediction already exists' });
          continue;
        }

        // Get player's games BEFORE parlay creation
        const parlayCreatedAt = new Date(parlay.created_at);
        const { data: historicalStats } = await supabase
          .from('nba_player_stats')
          .select('points, rebounds, assists, steals, blocks, turnovers, three_pt_made, game_date, event_id')
          .eq('player_id', playerId)
          .lt('game_date', parlayCreatedAt.toISOString())
          .order('game_date', { ascending: false })
          .limit(10);

        if (!historicalStats || historicalStats.length < 3) {
          skippedLegs.push({ parlay: parlay.name, player: playerName, reason: `insufficient historical data (${historicalStats?.length || 0} games)` });
          continue;
        }

        // Calculate synthetic prediction from historical data
        const statValues = historicalStats.map(s => getStatValue(s as PlayerStats, leg.statType));
        const muMA = calculateMovingAverage(statValues);
        const muEMA = calculateEma(statValues);
        const predictedMean = 0.6 * muEMA + 0.4 * muMA;
        
        const variance = statValues.reduce((sum, x) => sum + Math.pow(x - muMA, 2), 0) / (statValues.length - 1);
        const predictedSigma = Math.sqrt(variance);

        // Find player's NEXT game AFTER parlay creation
        const { data: nextGameStats } = await supabase
          .from('nba_player_stats')
          .select('points, rebounds, assists, steals, blocks, turnovers, three_pt_made, game_date, event_id')
          .eq('player_id', playerId)
          .gte('game_date', parlayCreatedAt.toISOString())
          .order('game_date', { ascending: true })
          .limit(1)
          .single();

        if (!nextGameStats) {
          skippedLegs.push({ parlay: parlay.name, player: playerName, reason: 'no game found after parlay creation' });
          continue;
        }

        // Check if game is finished
        const { data: fixture } = await supabase
          .from('nba_fixtures')
          .select('status')
          .eq('event_id', nextGameStats.event_id)
          .single();

        if (!fixture || !isGameFinished(fixture.status)) {
          skippedLegs.push({ parlay: parlay.name, player: playerName, reason: `game not finished (status: ${fixture?.status || 'unknown'})` });
          continue;
        }

        // Get prop line (supports both old 'mainLine' and new 'line' format)
        const propLine = leg.line ?? leg.mainLine;
        if (propLine === undefined) {
          skippedLegs.push({ parlay: parlay.name, player: playerName, reason: 'no prop line found' });
          continue;
        }

        // Calculate actual value and outcome
        const actualValue = getStatValue(nextGameStats as PlayerStats, leg.statType);
        const outcome = calculateOutcome(leg.decision, actualValue, propLine);
        const error = actualValue - predictedMean;

        console.log(`Processing: ${playerName} ${leg.statType} - predicted: ${predictedMean.toFixed(1)}, actual: ${actualValue}, outcome: ${outcome}`);

        if (!options.dryRun) {
          // Insert prediction record
          const { error: insertError } = await supabase.from('predictions').insert({
            parlay_id: parlay.id,
            player_id: playerId,
            player_name: playerName,
            stat_type: leg.statType,
            prop_line: propLine,
            decision: leg.decision,
            predicted_mean: predictedMean,
            predicted_sigma: predictedSigma,
            actual_value: actualValue,
            outcome: outcome,
            event_id: nextGameStats.event_id,
            processed: true,
            user_id: parlay.user_id,
          });

          if (insertError) {
            console.error(`Error inserting prediction for ${playerName}:`, insertError);
            continue;
          }

          predictionsCreated++;

          // Update or create error tracker
          const { data: existingTracker } = await supabase
            .from('player_error_trackers')
            .select('*')
            .eq('player_id', playerId)
            .eq('stat_type', leg.statType)
            .single();

          if (existingTracker) {
            // Update existing tracker
            const beta = existingTracker.beta || 0.3;
            const newErrorEma = beta * error + (1 - beta) * (existingTracker.error_ema || 0);
            const recentErrors = [...(existingTracker.recent_errors || []), error].slice(-20);

            await supabase
              .from('player_error_trackers')
              .update({
                error_ema: newErrorEma,
                recent_errors: recentErrors,
                total_predictions: (existingTracker.total_predictions || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingTracker.id);

            trackersUpdated++;
          } else {
            // Create new tracker
            await supabase.from('player_error_trackers').insert({
              player_id: playerId,
              stat_type: leg.statType,
              error_ema: error,
              recent_errors: [error],
              total_predictions: 1,
              beta: 0.3,
            });

            trackersUpdated++;
          }
        }

        processedLegs.push({
          parlay: parlay.name,
          player: playerName,
          statType: leg.statType,
          outcome: outcome,
        });
      }
    }

    const result = {
      message: options.dryRun ? 'Dry run complete (no changes made)' : 'Backfill complete',
      parlaysScanned: parlays?.length || 0,
      predictionsCreated: options.dryRun ? 0 : predictionsCreated,
      trackersUpdated: options.dryRun ? 0 : trackersUpdated,
      processedLegs,
      skippedLegs,
    };

    console.log('Backfill result:', result);

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
