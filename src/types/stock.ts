export type CandleResolution = '1m' | '5m' | '15m' | '30m' | '1D';
export type MarketInterval = '1minute' | '5minute' | '15minute' | '30minute' | 'day';

export interface StockInstrument {
  symbol: string;
  name: string;
  instrumentKey: string;
  ticker: string; // e.g. 'RELIANCE.NS'
  category: 'intraday' | 'daily' | 'custom';
  interval: MarketInterval;
  basePrice: number;
  volatility: number;
  sector: string;
  lotSize?: number;
}

export interface Candle {
  timestamp: string; // ISO or formatted
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

export interface LiveQuote {
  instrumentKey: string;
  symbol: string;
  lastPrice: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  timestamp: string;
  source: 'UPSTOX_TOKEN_FEED' | 'NSE_LIVE_FEED';
}

export interface QuantileForecast {
  horizons: number[];
  timestamps: string[];
  q10: number[];
  q25: number[];
  q50: number[]; // Ensemble Median
  q75: number[];
  q90: number[];
  timestralQ10: number[];
  timestralQ50: number[];
  timestralQ90: number[];
  chronosQ10: number[];
  chronosQ50: number[];
  chronosQ90: number[];
  uncertaintyBand: number; // Avg (Q90 - Q10) / 2
}

export interface PairwiseGap {
  pair: string;
  gap: number;
  valid: boolean;
  required: number;
}

export interface TradeSetup {
  bias: 'LONG' | 'SHORT';
  currentPrice: number;
  futureEntry: number;
  target: number;
  stoploss: number;
  gapEntryCurr: number;
  gapTargetEntry: number;
  gapEntrySL: number;
  gapCurrSL: number;
  gapTargetCurr: number;
  gapTargetSL: number;
  pairwiseGaps: PairwiseGap[];
  allGapsValid: boolean;
  minDiff: number;
  uncertaintyBand: number;
  riskRewardRatio: number;
  expectedMovePercent: number;
  timeframeLabel: string;
  horizonSteps: number;
}


export interface ApiDiagnostics {
  status: 'connected' | 'expired_token' | 'no_token_historical_only' | 'error' | 'idle';
  httpStatus?: number;
  message: string;
  latencyMs?: number;
  lastChecked: string;
  rawResponse?: string;
}

export interface ForecastResult {
  instrument: StockInstrument;
  candles: Candle[];
  quantiles: QuantileForecast;
  setup: TradeSetup;
  lastUpdated: string;
  dataSource: 'UPSTOX_LIVE_LTP' | 'UPSTOX_HISTORICAL' | 'DEMO_SYNTHETIC' | 'NSE_LIVE_TICK';
  livePrice?: number;
  quote?: LiveQuote;
}

export interface UpstoxConfig {
  accessToken: string;
  useDemoData: boolean;
  minPriceDiff: number;
  horizonIntraday: number; // default 6 (3 hours)
  horizonDaily: number;    // default 5 (5 trading days)
  timestralWeight: number; // default 0.5
  chronosWeight: number;   // default 0.5
  autoRefreshInterval: number; // in seconds (0 = off, 5, 10, 30)
}

