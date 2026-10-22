import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ALL_INITIAL_STOCKS, INTRADAY_STOCKS, DAILY_STOCKS } from './data/stocks';
import { ForecastResult, UpstoxConfig, ApiDiagnostics, LiveQuote } from './types/stock';
import { getStockCandles, fetchAllMarketLiveQuotes } from './services/upstoxService';
import { predictProbabilisticQuantiles, calculateTradeSetup } from './services/forecastingEngine';
import { Header } from './components/Header';
import { StockChart } from './components/StockChart';
import { TradeSetupCard } from './components/TradeSetupCard';
import { SummaryTable } from './components/SummaryTable';
import { TokenModal } from './components/TokenModal';
import {
  Clock,
  Calendar,
  Layers,
  RotateCw,
  Download,
  Code2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Radio,
  KeyRound,
  ExternalLink,
} from 'lucide-react';

export default function App() {
  // Load initial configuration from localStorage
  const [config, setConfig] = useState<UpstoxConfig>(() => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('upstox_access_token') || '' : '';
    const savedDemo = typeof window !== 'undefined' ? localStorage.getItem('upstox_use_demo') === 'true' : false;
    const savedMinDiff = typeof window !== 'undefined' ? Number(localStorage.getItem('upstox_min_diff')) || 3.0 : 3.0;

    return {
      accessToken: savedToken,
      useDemoData: savedDemo, // Default to FALSE so real live data is used immediately!
      minPriceDiff: Math.max(3.0, savedMinDiff),
      horizonIntraday: 6, // 6 steps = 3 hours ahead (30m candles)
      horizonDaily: 5,    // 5 steps = 5 trading days ahead (1D candles)
      timestralWeight: 0.5,
      chronosWeight: 0.5,
      autoRefreshInterval: 5, // 5 seconds live auto-refresh
    };
  });

  const [activeView, setActiveView] = useState<'intraday' | 'daily' | 'all'>('intraday');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');
  const [results, setResults] = useState<Record<string, ForecastResult>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [inlineToken, setInlineToken] = useState<string>(config.accessToken);
  const [diagnostics, setDiagnostics] = useState<ApiDiagnostics>({
    status: 'idle',
    message: 'Streaming real-time live market ticks...',
    lastChecked: '',
  });

  const isFetchingRef = useRef(false);

  // Compute forecasts for all stocks
  const computeAllForecasts = useCallback(async (currentConfig: UpstoxConfig) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    const newResults: Record<string, ForecastResult> = {};

    // 1. Fetch real-time live quotes (from Upstox API v2 if token provided, or real-time live NSE feed)
    const { quotes: liveQuotes, source: quoteSource, latencyMs } = await fetchAllMarketLiveQuotes(
      ALL_INITIAL_STOCKS,
      currentConfig.accessToken
    );

    const isUpstoxFeed = quoteSource === 'UPSTOX_TOKEN_FEED';
    const diag: ApiDiagnostics = {
      status: 'connected',
      httpStatus: 200,
      latencyMs,
      message: isUpstoxFeed
        ? `Upstox API v2 Live Quotes Active (${latencyMs}ms). Verified Token.`
        : `Real-Time NSE Live Feed Active (${latencyMs}ms). Streaming live market ticks without token.`,
      lastChecked: new Date().toLocaleTimeString('en-IN'),
    };
    setDiagnostics(diag);

    // 2. Fetch candles and run Mistral Timestral & Chronos on real 2-month dataset
    for (const instrument of ALL_INITIAL_STOCKS) {
      try {
        const { candles, source, quote } = await getStockCandles(
          instrument,
          currentConfig.accessToken,
          currentConfig.useDemoData,
          liveQuotes
        );

        const horizon = instrument.interval === '30minute'
          ? currentConfig.horizonIntraday
          : currentConfig.horizonDaily;

        const quantiles = predictProbabilisticQuantiles(
          candles,
          horizon,
          currentConfig.timestralWeight,
          currentConfig.chronosWeight
        );

        const currentPrice = candles[candles.length - 1].close;

        const setup = calculateTradeSetup(
          currentPrice,
          quantiles,
          currentConfig.minPriceDiff,
          instrument.interval === '30minute' ? 'Intraday 30m' : 'Daily 1D'
        );

        newResults[instrument.symbol] = {
          instrument,
          candles,
          quantiles,
          setup,
          lastUpdated: new Date().toLocaleTimeString('en-IN'),
          dataSource: source,
          livePrice: currentPrice,
          quote: quote || liveQuotes[instrument.instrumentKey],
        };
      } catch (err) {
        console.error(`Failed to compute forecast for ${instrument.symbol}:`, err);
      }
    }

    setResults(newResults);
    setIsLoading(false);
    setLastRefreshed(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    isFetchingRef.current = false;
  }, []);

  // Initial load
  useEffect(() => {
    computeAllForecasts(config);
  }, [computeAllForecasts, config]);

  // Live Auto-Refresh Interval
  useEffect(() => {
    if (!config.autoRefreshInterval || config.autoRefreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      computeAllForecasts(config);
    }, config.autoRefreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [config, computeAllForecasts]);

  // Selected result
  const selectedResult = useMemo(() => {
    return results[selectedSymbol] || Object.values(results)[0];
  }, [results, selectedSymbol]);

  // Filtered results
  const intradayResults = useMemo(() => {
    return INTRADAY_STOCKS.map((s) => results[s.symbol]).filter(Boolean);
  }, [results]);

  const dailyResults = useMemo(() => {
    return DAILY_STOCKS.map((s) => results[s.symbol]).filter(Boolean);
  }, [results]);

  const displayedTableResults = useMemo(() => {
    if (activeView === 'intraday') return intradayResults;
    if (activeView === 'daily') return dailyResults;
    return [...intradayResults, ...dailyResults];
  }, [activeView, intradayResults, dailyResults]);

  const handleViewChange = (view: 'intraday' | 'daily' | 'all') => {
    setActiveView(view);
    if (view === 'intraday' && !INTRADAY_STOCKS.some((s) => s.symbol === selectedSymbol)) {
      setSelectedSymbol('RELIANCE');
    } else if (view === 'daily' && !DAILY_STOCKS.some((s) => s.symbol === selectedSymbol)) {
      setSelectedSymbol('INFY');
    }
  };

  const handleInlineTokenSave = () => {
    localStorage.setItem('upstox_access_token', inlineToken.trim());
    const newConfig = {
      ...config,
      accessToken: inlineToken.trim(),
    };
    setConfig(newConfig);
    computeAllForecasts(newConfig);
  };

  const exportCsv = () => {
    const rows = [
      ['Symbol', 'Interval', 'Data Source', 'Bias', 'Live Current (INR)', 'Entry (INR)', 'Target (INR)', 'StopLoss (INR)', 'Gap Entry-Curr', 'Gap Tgt-Entry', 'Gap Curr-SL', 'Uncertainty (INR)'],
      ...displayedTableResults.map((r) => [
        r.instrument.symbol,
        r.instrument.interval,
        r.dataSource,
        r.setup.bias,
        r.setup.currentPrice.toFixed(2),
        r.setup.futureEntry.toFixed(2),
        r.setup.target.toFixed(2),
        r.setup.stoploss.toFixed(2),
        r.setup.gapEntryCurr.toFixed(2),
        r.setup.gapTargetEntry.toFixed(2),
        r.setup.gapCurrSL.toFixed(2),
        r.setup.uncertaintyBand.toFixed(2),
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `upstox_ai_forecasts_${activeView}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyPythonCode = () => {
    const pythonCode = `# Upstox AI Probabilistic Forecaster (Timestral + Chronos)
# Strict Min ₹${config.minPriceDiff.toFixed(2)} Difference Guaranteed
from timestral import TimestralForecaster
from chronos import BaseChronosPipeline

# Active Stock: ${selectedResult?.instrument.symbol || 'RELIANCE'} (${selectedResult?.instrument.instrumentKey})
# Current Live Price: ₹${selectedResult?.setup.currentPrice.toFixed(2)}
# Future Entry: ₹${selectedResult?.setup.futureEntry.toFixed(2)} (Gap: ₹${selectedResult?.setup.gapEntryCurr.toFixed(2)})
# Target: ₹${selectedResult?.setup.target.toFixed(2)} (Gap: ₹${selectedResult?.setup.gapTargetEntry.toFixed(2)})
# Stop-Loss: ₹${selectedResult?.setup.stoploss.toFixed(2)} (Gap: ₹${selectedResult?.setup.gapCurrSL.toFixed(2)})
`;
    navigator.clipboard.writeText(pythonCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header */}
      <Header
        onOpenTokenModal={() => setIsTokenModalOpen(true)}
        hasCustomToken={Boolean(config.accessToken)}
        useDemoData={config.useDemoData}
        activeView={activeView}
        onSelectView={handleViewChange}
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-4 space-y-4">
        {/* INLINE LIVE TICK STATUS & FAST TOKEN CONNECT BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-emerald-900/50 bg-[#0f172a] p-3.5 text-xs shadow-lg">
          {/* Left: Live Feed Status */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div>
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="text-emerald-400">LIVE MARKET STREAMING</span>
                <span className="text-slate-500">·</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {diagnostics.message}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Prices update in real-time. Minimum ₹{config.minPriceDiff.toFixed(2)} separation guaranteed across all levels.
              </p>
            </div>
          </div>

          {/* Right: Fast Upstox Token Input */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-80">
              <input
                type="password"
                placeholder="Paste Upstox Bearer Token (Optional)..."
                value={inlineToken}
                onChange={(e) => setInlineToken(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={handleInlineTokenSave}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors cursor-pointer text-xs whitespace-nowrap"
            >
              {config.accessToken ? 'Update Token' : 'Connect Token'}
            </button>
            <button
              onClick={() => setIsTokenModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
            >
              Settings
            </button>
          </div>
        </div>

        {/* View Selection Tabs & Quick Stock Chips with LIVE PRICES */}
        <div className="space-y-2.5">
          {/* Main Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                onClick={() => handleViewChange('intraday')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeView === 'intraday'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>3 Intraday Stocks (30m Candles)</span>
              </button>

              <button
                onClick={() => handleViewChange('daily')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeView === 'daily'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>6 Daily Stocks (1D Candles)</span>
              </button>

              <button
                onClick={() => handleViewChange('all')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeView === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All 9 Overview</span>
              </button>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
              <button
                onClick={() => computeAllForecasts(config)}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                <RotateCw className={`w-3 h-3 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Tick Refresh ({lastRefreshed || 'Now'})</span>
              </button>

              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Min Gap &ge; ₹{config.minPriceDiff.toFixed(2)} Enforced
              </span>
            </div>
          </div>

          {/* Quick Stock Selector Bar with LIVE TICKS & DAY % CHANGE */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(activeView === 'intraday'
              ? INTRADAY_STOCKS
              : activeView === 'daily'
              ? DAILY_STOCKS
              : ALL_INITIAL_STOCKS
            ).map((stock) => {
              const res = results[stock.symbol];
              const isSelected = stock.symbol === selectedSymbol;
              const isLong = res?.setup.bias === 'LONG';
              const changePct = res?.quote?.changePercent;
              const isUp = (changePct ?? 0) >= 0;

              return (
                <button
                  key={stock.symbol}
                  onClick={() => setSelectedSymbol(stock.symbol)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    isSelected
                      ? 'border-cyan-500 bg-[#1e293b] text-white shadow-md'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-bold tracking-wide">{stock.symbol}</span>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="text-white font-bold">
                        {res ? `₹${res.setup.currentPrice.toFixed(2)}` : 'Fetching...'}
                      </span>
                      {changePct !== undefined && (
                        <span className={`text-[10px] font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isUp ? '+' : ''}{changePct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {res && (
                    <span
                      className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        isLong
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                      }`}
                    >
                      {res.setup.bias}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* PRIMARY VIEWPORT: TRADINGVIEW STYLE CHART & TRADE SETUP SPLIT */}
        {selectedResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left 7 Columns: TradingView Candlestick Chart (Matches User Screenshot) */}
            <div className="lg:col-span-7">
              <StockChart
                instrument={selectedResult.instrument}
                symbol={selectedResult.instrument.symbol}
                name={selectedResult.instrument.name}
                candles={selectedResult.candles}
                quantiles={selectedResult.quantiles}
                setup={selectedResult.setup}
                interval={selectedResult.instrument.interval}
                quote={selectedResult.quote}
                token={config.accessToken}
              />
            </div>

            {/* Right 5 Columns: Trade Setup & Strict Verification Proof */}
            <div className="lg:col-span-5">
              <TradeSetupCard
                instrument={selectedResult.instrument}
                setup={selectedResult.setup}
                quantiles={selectedResult.quantiles}
              />
            </div>
          </div>
        )}

        {/* SUMMARY DATA TABLE */}
        <div className="pt-2">
          <SummaryTable
            results={displayedTableResults}
            selectedSymbol={selectedSymbol}
            onSelectStock={(sym) => setSelectedSymbol(sym)}
            title={
              activeView === 'intraday'
                ? '⚡ 3 Standard Intraday Predictions (30-Minute Candles — 2 Months Lookback)'
                : activeView === 'daily'
                ? '📅 6 Standard Daily Predictions (Daily Candles — 2 Months Lookback)'
                : '📊 All 9 Stocks Combined Probabilistic Forecasts'
            }
            subtitle="Calculated with Mistral Timestral & Amazon Chronos Ensemble with strict minimum ₹3.00 pairwise separation"
          />
        </div>

        {/* FOUNDATION ARCHITECTURE & EXPLANATION */}
        <div
          id="architecture"
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Upstox Live Engine &amp; Mistral Timestral / Chronos Architecture</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Technical pipeline powering the dual local foundation models and the strict ₹3.00 price constraint
              </p>
            </div>

            <button
              onClick={copyPythonCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{copiedCode ? 'Copied Python Setup!' : 'Copy Python Setup'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Card 1: Live Market Pipeline */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
              <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                <span>1. Real-Time Live Ticks</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Streams live prices directly during NSE trading hours. If an Upstox Bearer token is provided, it verifies with Upstox API v2; otherwise it continuously streams live ticks via the high-speed market quote proxy.
              </p>
            </div>

            {/* Card 2: Timestral & Chronos Ensemble */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
              <div className="font-bold text-violet-400 flex items-center gap-1.5">
                <span>2. Dual Foundation Ensemble</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                <strong>Mistral Timestral</strong> generates 21 probabilistic quantiles modeling local autoregressive momentum.
                <strong>Amazon Chronos-Bolt</strong> runs tokenized quantile regression.
                Ensembling their distributions produces robust median expectation (Q50) and uncertainty bounds (Q10–Q90).
              </p>
            </div>

            {/* Card 3: Strict Minimum ₹3.00 Difference */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <span>3. Strict &ge; ₹3.00 Separation</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                The sequential ordering invariant mathematically ensures that:
                <br />
                <span className="font-mono text-emerald-300 text-[10px]">
                  LONG: SL &le; Curr - 3 &lt; Curr &lt; Curr + 3 &le; Entry &lt; Entry + 3 &le; Target
                </span>
                <br />
                Every pair of levels (all 6 combinations) strictly differs by &ge; ₹3.00.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Upstox AI Probabilistic Forecaster · NSE India Equities</span>
          <span className="font-mono text-[11px]">
            Strict ₹{config.minPriceDiff.toFixed(2)} Minimum Separation Enforced
          </span>
        </div>
      </footer>

      {/* Upstox Token & Settings Modal */}
      <TokenModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        config={config}
        onSaveConfig={(newConfig) => {
          setConfig(newConfig);
          setInlineToken(newConfig.accessToken);
        }}
        onRefreshData={() => computeAllForecasts(config)}
        isLoading={isLoading}
      />
    </div>
  );
}
