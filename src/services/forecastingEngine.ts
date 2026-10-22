import { Candle, PairwiseGap, QuantileForecast, TradeSetup } from '../types/stock';

/**
 * Predict quantiles using dual simulated local foundation models:
 * 1. Mistral Timestral (autoregressive multi-quantile transformer)
 * 2. Amazon Chronos (Chronos-bolt quantile pipeline)
 */
export function predictProbabilisticQuantiles(
  candles: Candle[],
  horizon: number,
  timestralWeight: number = 0.5,
  chronosWeight: number = 0.5
): QuantileForecast {
  const closePrices = candles.map((c) => c.close);
  const n = closePrices.length;
  if (n === 0) {
    throw new Error('Cannot forecast empty candle series');
  }

  const currentPrice = closePrices[n - 1];

  // Calculate recent momentum, exponential moving averages, and historical volatility
  const lookback = Math.min(n, 40);
  const recentCloses = closePrices.slice(n - lookback);
  
  // Historical log returns volatility
  let sumReturns = 0;
  let sumSqReturns = 0;
  for (let i = 1; i < recentCloses.length; i++) {
    const ret = Math.log(recentCloses[i] / recentCloses[i - 1]);
    sumReturns += ret;
    sumSqReturns += ret * ret;
  }
  const meanRet = sumReturns / (recentCloses.length - 1);
  const varianceRet = (sumSqReturns / (recentCloses.length - 1)) - (meanRet * meanRet);
  const dailyVol = Math.sqrt(Math.max(varianceRet, 0.00005));

  // Short term trend momentum
  const emaFast = recentCloses.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const emaSlow = recentCloses.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const momentumBias = (emaFast - emaSlow) / emaSlow;

  // Timestamps for future predictions
  const lastTimestamp = new Date(candles[n - 1].timestamp);
  const isIntraday = candles[n - 1].timestamp.includes(':') && !candles[n - 1].timestamp.includes('15:30:00');
  const timestamps: string[] = [];
  const horizons: number[] = [];

  for (let step = 1; step <= horizon; step++) {
    horizons.push(step);
    const nextTime = new Date(lastTimestamp.getTime() + (isIntraday ? step * 30 * 60 * 1000 : step * 24 * 60 * 60 * 1000));
    timestamps.push(nextTime.toISOString());
  }

  // 1. Mistral Timestral: Strong autoregressive inertia + localized multi-quantile cones
  const timestralQ10: number[] = [];
  const timestralQ50: number[] = [];
  const timestralQ90: number[] = [];

  // 2. Amazon Chronos: Broad distribution tokenization + heavy-tail uncertainty bounds
  const chronosQ10: number[] = [];
  const chronosQ50: number[] = [];
  const chronosQ90: number[] = [];

  // Ensembled arrays
  const q10: number[] = [];
  const q25: number[] = [];
  const q50: number[] = [];
  const q75: number[] = [];
  const q90: number[] = [];

  for (let t = 1; t <= horizon; t++) {
    const sqrtT = Math.sqrt(t);
    // Timestral path
    const tsDrift = momentumBias * 0.45 * t * (currentPrice * 0.004);
    const tsSigma = dailyVol * currentPrice * sqrtT * 1.35;
    const tsMedian = currentPrice + tsDrift;
    const tq10 = tsMedian - 1.28 * tsSigma;
    const tq50 = tsMedian;
    const tq90 = tsMedian + 1.28 * tsSigma;

    timestralQ10.push(roundTo2(tq10));
    timestralQ50.push(roundTo2(tq50));
    timestralQ90.push(roundTo2(tq90));

    // Chronos path: wider tail recognition
    const chDrift = momentumBias * 0.35 * t * (currentPrice * 0.0035);
    const chSigma = dailyVol * currentPrice * sqrtT * 1.55;
    const chMedian = currentPrice + chDrift;
    const cq10 = chMedian - 1.32 * chSigma;
    const cq50 = chMedian;
    const cq90 = chMedian + 1.32 * chSigma;

    chronosQ10.push(roundTo2(cq10));
    chronosQ50.push(roundTo2(cq50));
    chronosQ90.push(roundTo2(cq90));

    // Weighted Ensemble
    const totalWeight = timestralWeight + chronosWeight;
    const wTs = timestralWeight / totalWeight;
    const wCh = chronosWeight / totalWeight;

    const ensQ10 = roundTo2(tq10 * wTs + cq10 * wCh);
    const ensQ50 = roundTo2(tq50 * wTs + cq50 * wCh);
    const ensQ90 = roundTo2(tq90 * wTs + cq90 * wCh);
    const ensQ25 = roundTo2(ensQ50 - (ensQ50 - ensQ10) * 0.55);
    const ensQ75 = roundTo2(ensQ50 + (ensQ90 - ensQ50) * 0.55);

    q10.push(ensQ10);
    q25.push(ensQ25);
    q50.push(ensQ50);
    q75.push(ensQ75);
    q90.push(ensQ90);
  }

  // Uncertainty band (half of average 80% confidence span)
  const bandSum = q90.reduce((acc, val, i) => acc + (val - q10[i]), 0);
  const uncertaintyBand = roundTo2((bandSum / horizon) / 2);

  return {
    horizons,
    timestamps,
    q10,
    q25,
    q50,
    q75,
    q90,
    timestralQ10,
    timestralQ50,
    timestralQ90,
    chronosQ10,
    chronosQ50,
    chronosQ90,
    uncertaintyBand,
  };
}

/**
 * Helper to round to 2 decimals
 */
export function roundTo2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Strict Trade Setup Calculator enforcing at least minDiff (default ₹3.00)
 * difference between EVERY pair of price levels:
 * Long:  StopLoss <= (Curr - 3) < Curr < (Curr + 3) <= FutureEntry < (FutureEntry + 3) <= Target
 * Short: Target <= (FutureEntry - 3) < FutureEntry <= (Curr - 3) < Curr < (Curr + 3) <= StopLoss
 */
export function calculateTradeSetup(
  currentPrice: number,
  quantiles: QuantileForecast,
  minDiff: number = 3.0,
  timeframeLabel: string = 'Intraday'
): TradeSetup {
  const curr = roundTo2(currentPrice);
  const q10Path = quantiles.q10;
  const q50Path = quantiles.q50;
  const q90Path = quantiles.q90;

  const endMedian = q50Path[q50Path.length - 1];
  const maxQ90 = Math.max(...q90Path);
  const minQ10 = Math.min(...q10Path);

  // Directional bias derived from median trajectory
  const isBullish = endMedian >= curr;
  let bias: 'LONG' | 'SHORT';
  let entry: number;
  let target: number;
  let stoploss: number;

  if (isBullish) {
    bias = 'LONG';
    // 1. Future Entry: Must be at least ₹3.00 ABOVE Current Price
    entry = roundTo2(Math.max(q50Path[0], curr + minDiff));
    if (entry - curr < minDiff) {
      entry = roundTo2(curr + minDiff);
    }

    // 2. Target: Must be at least ₹3.00 ABOVE Future Entry
    target = roundTo2(Math.max(endMedian, maxQ90, entry + minDiff));
    if (target - entry < minDiff) {
      target = roundTo2(entry + minDiff);
    }

    // 3. Stop-Loss: Must be at least ₹3.00 BELOW Current Price (and >= ₹6.00 below Entry)
    stoploss = roundTo2(Math.min(minQ10, curr - minDiff));
    if (curr - stoploss < minDiff) {
      stoploss = roundTo2(curr - minDiff);
    }
  } else {
    bias = 'SHORT';
    // 1. Future Entry: Must be at least ₹3.00 BELOW Current Price
    entry = roundTo2(Math.min(q50Path[0], curr - minDiff));
    if (curr - entry < minDiff) {
      entry = roundTo2(curr - minDiff);
    }

    // 2. Target: Must be at least ₹3.00 BELOW Future Entry
    target = roundTo2(Math.min(endMedian, minQ10, entry - minDiff));
    if (entry - target < minDiff) {
      target = roundTo2(entry - minDiff);
    }

    // 3. Stop-Loss: Must be at least ₹3.00 ABOVE Current Price (and >= ₹6.00 above Entry)
    stoploss = roundTo2(Math.max(maxQ90, curr + minDiff));
    if (stoploss - curr < minDiff) {
      stoploss = roundTo2(curr + minDiff);
    }
  }

  // Calculate gaps
  const gapEntryCurr = roundTo2(Math.abs(entry - curr));
  const gapTargetEntry = roundTo2(Math.abs(target - entry));
  const gapEntrySL = roundTo2(Math.abs(entry - stoploss));
  const gapCurrSL = roundTo2(Math.abs(curr - stoploss));
  const gapTargetCurr = roundTo2(Math.abs(target - curr));
  const gapTargetSL = roundTo2(Math.abs(target - stoploss));

  // Compute all 6 pairwise gap validations
  const pairwiseGaps: PairwiseGap[] = [
    { pair: '|Entry - Current|', gap: gapEntryCurr, valid: gapEntryCurr >= minDiff, required: minDiff },
    { pair: '|Target - Entry|', gap: gapTargetEntry, valid: gapTargetEntry >= minDiff, required: minDiff },
    { pair: '|Current - StopLoss|', gap: gapCurrSL, valid: gapCurrSL >= minDiff, required: minDiff },
    { pair: '|Entry - StopLoss|', gap: gapEntrySL, valid: gapEntrySL >= minDiff, required: minDiff },
    { pair: '|Target - Current|', gap: gapTargetCurr, valid: gapTargetCurr >= minDiff, required: minDiff },
    { pair: '|Target - StopLoss|', gap: gapTargetSL, valid: gapTargetSL >= minDiff, required: minDiff },
  ];

  const allGapsValid = pairwiseGaps.every((p) => p.valid);

  // Risk to reward ratio
  const risk = Math.abs(entry - stoploss);
  const reward = Math.abs(target - entry);
  const riskRewardRatio = risk > 0 ? roundTo2(reward / risk) : 1;
  const expectedMovePercent = roundTo2((Math.abs(target - entry) / entry) * 100);

  return {
    bias,
    currentPrice: curr,
    futureEntry: entry,
    target,
    stoploss,
    gapEntryCurr,
    gapTargetEntry,
    gapEntrySL,
    gapCurrSL,
    gapTargetCurr,
    gapTargetSL,
    pairwiseGaps,
    allGapsValid,
    minDiff,
    uncertaintyBand: quantiles.uncertaintyBand,
    riskRewardRatio,
    expectedMovePercent,
    timeframeLabel,
    horizonSteps: quantiles.horizons.length,
  };
}
