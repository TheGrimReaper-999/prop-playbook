/**
 * Betting utilities - odds conversion, probability calculations, and decision logic.
 * Based on the Python model.py and math_odds.py logic.
 */

// ============= ODDS CONVERSION =============

export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  } else {
    return 1 + 100 / Math.abs(americanOdds);
  }
}

export function toDecimalOdds(odds: number, oddsFormat: string): number {
  if (oddsFormat === 'decimal') {
    return odds;
  } else if (oddsFormat === 'multiplier') {
    // Profit multiplier: e.g., 0.91 means you win 0.91 for every 1 bet
    return 1 + odds;
  } else {
    // American
    return americanToDecimal(odds);
  }
}

export function impliedProbability(odds: number, oddsFormat: string = 'american'): number {
  if (oddsFormat === 'decimal') {
    return 1.0 / odds;
  } else if (oddsFormat === 'multiplier') {
    return 1.0 / (1 + odds);
  } else {
    // American odds
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }
}

// ============= DEVIGGING =============

export function devigTwoWay(pOverImplied: number, pUnderImplied: number): [number, number] {
  const total = pOverImplied + pUnderImplied;
  if (total === 0) {
    return [0.5, 0.5];
  }
  
  const pOverFair = pOverImplied / total;
  const pUnderFair = pUnderImplied / total;
  
  return [pOverFair, pUnderFair];
}

// ============= STATISTICAL FUNCTIONS =============

export function normalCdf(x: number, mu: number = 0, sigma: number = 1): number {
  if (sigma <= 0) {
    return x >= mu ? 0.5 : 0.0;
  }
  
  const z = (x - mu) / sigma;
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

// Error function approximation
function erf(x: number): number {
  // Approximation of the error function
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

export function calculateMovingAverage(stats: number[], n: number): number {
  if (stats.length < n) {
    n = stats.length;
  }
  if (n === 0) return 0;
  return stats.slice(0, n).reduce((a, b) => a + b, 0) / n;
}

export function calculateEma(stats: number[], n: number, alpha?: number): number {
  if (stats.length < n) {
    n = stats.length;
  }
  
  if (n === 0) return 0.0;
  
  if (alpha === undefined) {
    alpha = 2.0 / (n + 1);
  }
  
  alpha = Math.max(0.01, Math.min(1.0, alpha));
  
  // Reverse stats to get chronological order (oldest to newest)
  const chronologicalValues = stats.slice(0, n).reverse();
  
  let ema = chronologicalValues[0];
  
  for (let i = 1; i < chronologicalValues.length; i++) {
    ema = alpha * chronologicalValues[i] + (1 - alpha) * ema;
  }
  
  return ema;
}

export function calculateStochastic(stats: number[], n: number): [number, number, number] {
  if (stats.length < n) {
    n = stats.length;
  }
  
  if (n === 0) return [0.5, 0, 0];
  
  const window = stats.slice(0, n);
  const rollingHigh = Math.max(...window);
  const rollingLow = Math.min(...window);
  
  const current = stats[0];
  
  let stochastic: number;
  if (rollingHigh === rollingLow) {
    stochastic = 0.5;
  } else {
    stochastic = (current - rollingLow) / (rollingHigh - rollingLow);
    stochastic = Math.max(0.0, Math.min(1.0, stochastic));
  }
  
  return [stochastic, rollingHigh, rollingLow];
}

// ============= MODEL PROBABILITIES =============

export function calculateModelProbabilities(
  last10Stats: number[],
  propLine: number,
  muAdjustment: number = 0.0
): [number, number] {
  if (last10Stats.length !== 10) {
    // Pad with average if not enough data
    const avg = last10Stats.length > 0 
      ? last10Stats.reduce((a, b) => a + b, 0) / last10Stats.length 
      : propLine;
    while (last10Stats.length < 10) {
      last10Stats.push(avg);
    }
  }
  
  // Calculate base mean for std dev calculation
  const avg10 = last10Stats.reduce((a, b) => a + b, 0) / last10Stats.length;
  
  // Calculate sample standard deviation
  const variance = last10Stats.reduce((sum, x) => sum + Math.pow(x - avg10, 2), 0) / (last10Stats.length - 1);
  let std10 = Math.sqrt(variance);
  
  // Floor stddev if extremely small
  if (std10 < 0.1) {
    std10 = 0.1;
  }
  
  // Time-sensitive means
  const avg5 = calculateMovingAverage(last10Stats, 5);
  const avg10Base = calculateMovingAverage(last10Stats, 10);
  const ema10 = calculateEma(last10Stats, 10);
  
  // Calculate divergence
  const divergence = Math.abs(avg5 - avg10Base);
  const normalizedDivergence = std10 > 0 ? divergence / Math.max(std10, 0.1) : 0.0;
  const divergenceWeight = Math.min(1.0, normalizedDivergence);
  
  // EMA weight
  const emaWeight = 0.3 + (0.3 * divergenceWeight);
  const baseWeight = 1.0 - emaWeight;
  
  // Stochastic adjustment
  const [stochastic] = calculateStochastic(last10Stats, 10);
  const stochAdjustmentFactor = 1.5 - stochastic;
  const adjustedEma = ema10 * stochAdjustmentFactor;
  
  // Blended mean
  const blendedMean = baseWeight * avg10Base + emaWeight * adjustedEma;
  const mu = blendedMean + muAdjustment;
  
  // Probability calculation
  const z = (propLine - mu) / std10;
  const pOverModel = 1 - normalCdf(z);
  const pUnderModel = 1 - pOverModel;
  
  return [pOverModel, pUnderModel];
}

// ============= EV AND KELLY =============

export function calculateEv(decimalOdds: number, winProb: number): number {
  const profitIfWin = decimalOdds - 1;
  return winProb * profitIfWin - (1 - winProb);
}

export function calculateKellyStake(
  decimalOdds: number,
  winProb: number,
  bankroll: number,
  kellyMultiplier: number,
  maxBetPct: number
): number {
  const b = decimalOdds - 1;
  
  if (b === 0) return 0.0;
  
  // Full Kelly
  const kFull = (winProb * b - (1 - winProb)) / b;
  
  if (kFull < 0) return 0.0;
  
  // Fractional Kelly
  let stake = bankroll * kFull * kellyMultiplier;
  
  // Apply cap
  stake = Math.min(stake, bankroll * maxBetPct);
  
  return Math.max(stake, 0.0);
}

// ============= DECISION LOGIC =============

export interface BetDecisionInput {
  propLine: number;
  overOdds: number;
  underOdds: number;
  oddsFormat: string;
  // For now, we'll use placeholder stats - in real implementation, these would come from API
  last10Stats?: number[];
  muAdjustment?: number;
}

export interface BetDecisionResult {
  decision: 'TAKE OVER' | 'TAKE UNDER' | 'NO BET';
  pOverModel: number;
  pUnderModel: number;
  pOverImplied: number;
  pUnderImplied: number;
  pOverFair: number;
  pUnderFair: number;
  evOver: number;
  evUnder: number;
  edgeOver: number;
  edgeUnder: number;
  confidence: number;
}

export interface Settings {
  bankroll: number;
  kellyMultiplier: number;
  maxBetPct: number;
  minEdgeThreshold: number;
}

const DEFAULT_SETTINGS: Settings = {
  bankroll: 1000,
  kellyMultiplier: 0.25,
  maxBetPct: 0.05,
  minEdgeThreshold: 0.02,
};

export function evaluateProp(input: BetDecisionInput, settings: Settings = DEFAULT_SETTINGS): BetDecisionResult {
  const overOddsNum = parseFloat(String(input.overOdds)) || 0;
  const underOddsNum = parseFloat(String(input.underOdds)) || 0;
  
  // If no valid odds, return NO BET
  if (overOddsNum === 0 && underOddsNum === 0) {
    return {
      decision: 'NO BET',
      pOverModel: 0.5,
      pUnderModel: 0.5,
      pOverImplied: 0.5,
      pUnderImplied: 0.5,
      pOverFair: 0.5,
      pUnderFair: 0.5,
      evOver: 0,
      evUnder: 0,
      edgeOver: 0,
      edgeUnder: 0,
      confidence: 0,
    };
  }
  
  // Use placeholder stats if not provided - generate around the prop line
  const last10Stats = input.last10Stats || generatePlaceholderStats(input.propLine);
  
  // Calculate model probabilities
  const [pOverModel, pUnderModel] = calculateModelProbabilities(
    last10Stats,
    input.propLine,
    input.muAdjustment || 0
  );
  
  // Convert to decimal odds
  const overDecimal = overOddsNum !== 0 ? toDecimalOdds(overOddsNum, input.oddsFormat) : 2.0;
  const underDecimal = underOddsNum !== 0 ? toDecimalOdds(underOddsNum, input.oddsFormat) : 2.0;
  
  // Calculate implied probabilities
  const pOverImplied = overOddsNum !== 0 ? impliedProbability(overOddsNum, input.oddsFormat) : 0.5;
  const pUnderImplied = underOddsNum !== 0 ? impliedProbability(underOddsNum, input.oddsFormat) : 0.5;
  
  // Devig to get fair probabilities
  const [pOverFair, pUnderFair] = devigTwoWay(pOverImplied, pUnderImplied);
  
  // Calculate EVs
  const evOver = calculateEv(overDecimal, pOverModel);
  const evUnder = calculateEv(underDecimal, pUnderModel);
  
  // Calculate edges
  const edgeOver = pOverModel - pOverFair;
  const edgeUnder = pUnderModel - pUnderFair;
  
  // Calculate stakes
  const stakeOver = calculateKellyStake(
    overDecimal,
    pOverModel,
    settings.bankroll,
    settings.kellyMultiplier,
    settings.maxBetPct
  );
  
  const stakeUnder = calculateKellyStake(
    underDecimal,
    pUnderModel,
    settings.bankroll,
    settings.kellyMultiplier,
    settings.maxBetPct
  );
  
  // Decision logic
  let decision: 'TAKE OVER' | 'TAKE UNDER' | 'NO BET' = 'NO BET';
  
  if (evOver > evUnder) {
    if (evOver > 0 && edgeOver >= settings.minEdgeThreshold && stakeOver > 0) {
      decision = 'TAKE OVER';
    }
  } else {
    if (evUnder > 0 && edgeUnder >= settings.minEdgeThreshold && stakeUnder > 0) {
      decision = 'TAKE UNDER';
    }
  }
  
  // Calculate confidence (0-100)
  const maxEdge = Math.max(edgeOver, edgeUnder);
  const confidence = Math.min(100, Math.max(0, maxEdge * 500)); // Scale edge to 0-100
  
  return {
    decision,
    pOverModel,
    pUnderModel,
    pOverImplied,
    pUnderImplied,
    pOverFair,
    pUnderFair,
    evOver,
    evUnder,
    edgeOver,
    edgeUnder,
    confidence,
  };
}

// Generate placeholder stats around the prop line for demo purposes
function generatePlaceholderStats(propLine: number): number[] {
  const stats: number[] = [];
  const stdDev = propLine * 0.2; // 20% standard deviation
  
  for (let i = 0; i < 10; i++) {
    // Generate random value around the prop line
    const randomOffset = (Math.random() - 0.5) * 2 * stdDev;
    stats.push(Math.max(0, propLine + randomOffset));
  }
  
  return stats;
}
