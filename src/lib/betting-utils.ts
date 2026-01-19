/**
 * Betting Math - Odds conversion, probability calculations, and decision logic.
 * Implemented exactly according to specifications.
 */

// ============= ODDS CONVERSION =============

export function americanToDecimal(americanOdds: number): number {
  if (americanOdds < 0) {
    return 1 + 100 / Math.abs(americanOdds);
  } else {
    return 1 + americanOdds / 100;
  }
}

export function toDecimalOdds(odds: number, oddsFormat: 'american' | 'decimal' | 'multiplier'): number {
  if (oddsFormat === 'decimal') {
    return odds; // Decimal stays decimal
  } else if (oddsFormat === 'multiplier') {
    return odds; // Decimal odds are literally the payout multiplier
  } else {
    // American
    return americanToDecimal(odds);
  }
}

export function getProfitMultiplier(decimalOdds: number): number {
  return decimalOdds - 1;
}

// ============= IMPLIED PROBABILITY =============

export function impliedProbability(decimalOdds: number): number {
  return 1 / decimalOdds;
}

// ============= DEVIGGING =============

export function devigTwoWay(pOverImplied: number, pUnderImplied: number): [number, number] {
  const s = pOverImplied + pUnderImplied;
  if (s === 0) {
    return [0.5, 0.5];
  }
  
  const pOverFair = pOverImplied / s;
  const pUnderFair = pUnderImplied / s;
  
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
  // Abramowitz and Stegun formula 7.1.46
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

export function calculateMovingAverage(stats: number[]): number {
  if (stats.length === 0) return 0;
  return stats.reduce((a, b) => a + b, 0) / stats.length;
}

export function calculateEma(stats: number[]): number {
  if (stats.length === 0) return 0;
  
  const N = 10;
  const alpha = 2 / (N + 1); // α = 2/(N+1) = 2/11
  
  // Assuming stats[0] is most recent, stats[n-1] is oldest
  const n = stats.length;
  
  // Initialize EMA_n = x_n (oldest)
  let ema = stats[n - 1];
  
  // For k = n-1 → 1 (from second-oldest to most recent)
  for (let k = n - 2; k >= 0; k--) {
    ema = alpha * stats[k] + (1 - alpha) * ema;
  }
  
  return ema;
}

// ============= ERROR TRACKING & BIAS CORRECTION =============

export interface PredictionRecord {
  predictedValue: number;
  actualValue: number;
  error: number;
  timestamp: number;
}

export interface ErrorTracker {
  // EMA of error for bias correction
  errorEma: number;
  // Residuals for sigma inflation
  recentErrors: number[];
  // EMA parameters
  beta: number; // EMA smoothing factor for errors
  maxResiduals: number; // Max residuals to store for sigma calculation
}

export function initializeErrorTracker(beta: number = 0.3, maxResiduals: number = 20): ErrorTracker {
  return {
    errorEma: 0,
    recentErrors: [],
    beta,
    maxResiduals,
  };
}

export function updateErrorTracker(
  tracker: ErrorTracker,
  predictedValue: number,
  actualValue: number
): void {
  const error = actualValue - predictedValue;
  
  // Update EMA of error: E_t = β * e_{t-1} + (1-β) * E_{t-1}
  tracker.errorEma = tracker.beta * error + (1 - tracker.beta) * tracker.errorEma;
  
  // Store recent residuals for sigma calculation
  tracker.recentErrors.push(error);
  if (tracker.recentErrors.length > tracker.maxResiduals) {
    tracker.recentErrors.shift(); // Remove oldest
  }
}

export function applyBiasCorrection(
  baseMean: number,
  tracker: ErrorTracker,
  lambda: number = 0.5
): number {
  // μ'_t = μ_t + λ * E_t
  return baseMean + lambda * tracker.errorEma;
}

export function calculateResidualStd(tracker: ErrorTracker): number {
  if (tracker.recentErrors.length < 2) return 0;
  
  const meanError = tracker.recentErrors.reduce((sum, e) => sum + e, 0) / tracker.recentErrors.length;
  const variance = tracker.recentErrors.reduce((sum, e) => sum + Math.pow(e - meanError, 2), 0) / (tracker.recentErrors.length - 1);
  return Math.sqrt(variance);
}

export function inflateSigmaWithResiduals(
  baseSigma: number,
  tracker: ErrorTracker,
  gamma: number = 0.5
): number {
  const residualStd = calculateResidualStd(tracker);
  // σ'_t = sqrt(σ_t^2 + γ * σ_e^2)
  return Math.sqrt(Math.pow(baseSigma, 2) + gamma * Math.pow(residualStd, 2));
}

// ============= MODEL PROBABILITY =============

export function calculateModelProbabilities(
  last10Stats: number[],
  propLine: number,
  muAdjustment: number = 0,
  emaWeight: number = 0.6,
  errorTracker?: ErrorTracker,
  biasCorrectionLambda: number = 0.5,
  sigmaInflationGamma: number = 0.5
): [number, number] {
  if (last10Stats.length === 0) {
    return [0.5, 0.5];
  }
  
  // A) Mean (L10 average)
  const muMA = calculateMovingAverage(last10Stats);
  
  // B) EMA (recent weighted)
  const muEMA = calculateEma(last10Stats);
  
  // C) Blended mean
  const muBlend = emaWeight * muEMA + (1 - emaWeight) * muMA;
  
  // D) Optional adjustment
  let mu = muBlend + muAdjustment;
  
  // E) Apply bias correction if error tracker provided
  if (errorTracker) {
    mu = applyBiasCorrection(mu, errorTracker, biasCorrectionLambda);
  }
  
  // F) Std dev from L10 with floor
  const n = last10Stats.length;
  const variance = last10Stats.reduce((sum, x) => sum + Math.pow(x - muMA, 2), 0) / (n - 1);
  let sigma = Math.sqrt(variance);
  const sigmaMin = 1e-6;
  sigma = Math.max(sigma, sigmaMin);
  
  // G) Inflate sigma with residuals if error tracker provided
  if (errorTracker) {
    sigma = inflateSigmaWithResiduals(sigma, errorTracker, sigmaInflationGamma);
  }
  
  // H) Convert to probability using Normal CDF
  const pOverModel = 1 - normalCdf(propLine, mu, sigma);
  const pUnderModel = 1 - pOverModel;
  
  return [pOverModel, pUnderModel];
}

// ============= EDGE CALCULATION =============

export function calculateEdge(
  pOverModel: number,
  pUnderModel: number,
  pOverFair: number,
  pUnderFair: number
): [number, number] {
  const edgeOver = pOverModel - pOverFair;
  const edgeUnder = pUnderModel - pUnderFair;
  return [edgeOver, edgeUnder];
}

// ============= EXPECTED VALUE =============

export function calculateEv(decimalOdds: number, winProb: number): number {
  return winProb * decimalOdds - 1;
}

// ============= DECISION LOGIC =============

export function makeDecision(
  evOver: number,
  evUnder: number,
  edgeOver: number,
  edgeUnder: number,
  minEdgeThreshold: number
): 'TAKE OVER' | 'TAKE UNDER' | 'NO BET' {
  const bestSide = evOver >= evUnder ? 'over' : 'under';
  
  if (bestSide === 'over') {
    if (edgeOver >= minEdgeThreshold && evOver > 0) {
      return 'TAKE OVER';
    }
  } else {
    if (edgeUnder >= minEdgeThreshold && evUnder > 0) {
      return 'TAKE UNDER';
    }
  }
  
  return 'NO BET';
}

// ============= CONFIDENCE SCORE =============

export type ConfidenceLevel = 'NO CONFIDENCE' | 'LOW CONFIDENCE' | 'MEDIUM CONFIDENCE' | 'HIGH CONFIDENCE' | 'MAX CONFIDENCE';

export function calculateConfidence(
  edgeOver: number,
  edgeUnder: number,
  scalingConstant: number = 0.10
): ConfidenceLevel {
  const maxEdge = Math.max(edgeOver, edgeUnder);
  const confidenceValue = Math.min(1, maxEdge / scalingConstant);
  
  if (confidenceValue >= 0.75) {
    return 'MAX CONFIDENCE';
  } else if (confidenceValue >= 0.50) {
    return 'HIGH CONFIDENCE';
  } else if (confidenceValue >= 0.25) {
    return 'MEDIUM CONFIDENCE';
  } else if (confidenceValue > 0) {
    return 'LOW CONFIDENCE';
  } else {
    return 'NO CONFIDENCE';
  }
}

// Alternative confidence calculation (distance from fair)
export function calculateConfidenceDistance(
  pOverModel: number,
  pUnderModel: number,
  pOverFair: number,
  pUnderFair: number,
  scalingConstant: number = 0.10
): ConfidenceLevel {
  const distanceOver = Math.abs(pOverModel - pOverFair);
  const distanceUnder = Math.abs(pUnderModel - pUnderFair);
  const maxDistance = Math.max(distanceOver, distanceUnder);
  const confidenceValue = Math.min(1, maxDistance / scalingConstant);
  
  if (confidenceValue >= 0.75) {
    return 'MAX CONFIDENCE';
  } else if (confidenceValue >= 0.50) {
    return 'HIGH CONFIDENCE';
  } else if (confidenceValue >= 0.25) {
    return 'MEDIUM CONFIDENCE';
  } else if (confidenceValue > 0) {
    return 'LOW CONFIDENCE';
  } else {
    return 'NO CONFIDENCE';
  }
}

// ============= KELLY BET SIZING =============

export function calculateKellyFraction(decimalOdds: number, winProb: number): number {
  const b = decimalOdds - 1;
  if (b === 0) return 0;
  
  const fStar = (winProb * decimalOdds - 1) / b;
  return Math.max(0, fStar);
}

export function calculateKellyStake(
  decimalOdds: number,
  winProb: number,
  bankroll: number,
  kellyMultiplier: number,
  maxBetPct: number
): number {
  const kellyFraction = calculateKellyFraction(decimalOdds, winProb);
  const adjustedFraction = Math.min(kellyFraction * kellyMultiplier, maxBetPct);
  return bankroll * Math.max(0, adjustedFraction);
}

// ============= TYPES =============

export interface BetDecisionInput {
  propLine: number;
  overOdds: number;
  underOdds: number;
  oddsFormat: 'american' | 'decimal' | 'multiplier';
  last10Stats?: number[];
  muAdjustment?: number;
  errorTracker?: ErrorTracker;
  biasCorrectionLambda?: number;
  sigmaInflationGamma?: number;
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
  confidence: ConfidenceLevel;
}

export interface Settings {
  bankroll: number;
  kellyMultiplier: number;
  maxBetPct: number;
  minEdgeThreshold: number;
  emaWeight?: number;
  confidenceScaling?: number;
}

const DEFAULT_SETTINGS: Settings = {
  bankroll: 1000,
  kellyMultiplier: 0.25,
  maxBetPct: 0.05,
  minEdgeThreshold: 0.02,
  emaWeight: 0.6,
  confidenceScaling: 0.20,
};

// ============= MAIN EVALUATION FUNCTION =============

export function evaluateProp(
  input: BetDecisionInput,
  settings: Settings = DEFAULT_SETTINGS
): BetDecisionResult {
  // Handle invalid odds
  if (input.overOdds === 0 && input.underOdds === 0) {
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
      confidence: 'NO CONFIDENCE',
    };
  }
  
  // 1) Convert odds to decimal
  const dOver = toDecimalOdds(input.overOdds || 2.0, input.oddsFormat);
  const dUnder = toDecimalOdds(input.underOdds || 2.0, input.oddsFormat);
  
  // 2) Calculate implied probabilities
  const pOverImplied = input.overOdds !== 0 ? impliedProbability(dOver) : 0.5;
  const pUnderImplied = input.underOdds !== 0 ? impliedProbability(dUnder) : 0.5;
  
  // 3) Devig to get fair probabilities
  const [pOverFair, pUnderFair] = devigTwoWay(pOverImplied, pUnderImplied);
  
  // 4) Calculate model probabilities
  const [pOverModel, pUnderModel] = calculateModelProbabilities(
    input.last10Stats || [],
    input.propLine,
    input.muAdjustment || 0,
    settings.emaWeight || 0.6,
    input.errorTracker,
    input.biasCorrectionLambda || 0.5,
    input.sigmaInflationGamma || 0.5
  );
  
  // 5) Calculate edges
  const [edgeOver, edgeUnder] = calculateEdge(pOverModel, pUnderModel, pOverFair, pUnderFair);
  
  // 6) Calculate EVs
  const evOver = calculateEv(dOver, pOverModel);
  const evUnder = calculateEv(dUnder, pUnderModel);
  
  // 7) Make decision
  const decision = makeDecision(evOver, evUnder, edgeOver, edgeUnder, settings.minEdgeThreshold);
  
  // 8) Calculate confidence
  const confidence = calculateConfidence(edgeOver, edgeUnder, settings.confidenceScaling || 0.10);
  
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
