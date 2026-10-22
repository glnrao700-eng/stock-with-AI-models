import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Candle, CandleResolution, QuantileForecast, TradeSetup, LiveQuote, StockInstrument } from '../types/stock';
import { ChartTimeframe, fetchTimeframeCandles, fetchCandlesByResolution } from '../services/upstoxService';
import { Maximize2, Minimize2, Eye, RefreshCw } from 'lucide-react';

interface StockChartProps {
  instrument?: StockInstrument;
  symbol: string;
  name: string;
  candles: Candle[];
  quantiles: QuantileForecast;
  setup: TradeSetup;
  interval: string;
  quote?: LiveQuote;
  token?: string;
}

export const StockChart: React.FC<StockChartProps> = ({
  instrument,
  symbol,
  name,
  candles: initialCandles,
  quantiles,
  setup,
  interval,
  quote,
  token,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartMode, setChartMode] = useState<'candle' | 'line'>('candle');
  const [selectedResolution, setSelectedResolution] = useState<CandleResolution>('5m');
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('1D');
  const [activeCandles, setActiveCandles] = useState<Candle[]>(initialCandles);
  const [isLoadingTimeframe, setIsLoadingTimeframe] = useState<boolean>(false);
  const [showModels, setShowModels] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    price: number;
    timeText: string;
    candle?: Candle;
    forecast?: { step: number; q10: number; q50: number; q90: number; time: string };
  } | null>(null);

  // Handle switching candle interval resolution (1m, 5m, 15m, 30m, 1D)
  const handleResolutionChange = async (res: CandleResolution) => {
    setSelectedResolution(res);
    if (res === '1m' || res === '5m') {
      setSelectedTimeframe('1D');
    } else if (res === '15m' || res === '30m') {
      if (selectedTimeframe === '1M' || selectedTimeframe === '3M' || selectedTimeframe === '6M' || selectedTimeframe === '1Y') {
        setSelectedTimeframe('5D');
      }
    }
    if (!instrument) return;

    setIsLoadingTimeframe(true);
    try {
      const fetched = await fetchCandlesByResolution(instrument, res, token);
      if (fetched && fetched.length > 0) {
        if (quote && quote.lastPrice > 0) {
          fetched[fetched.length - 1].close = quote.lastPrice;
        }
        setActiveCandles(fetched);
      }
    } catch (err) {
      console.warn(`Failed to switch to ${res} candle resolution:`, err);
    } finally {
      setIsLoadingTimeframe(false);
    }
  };

  // Handle switching timeframe (1D, 5D, 1M, 3M, 6M, 1Y)
  const handleTimeframeChange = async (tf: ChartTimeframe) => {
    setSelectedTimeframe(tf);
    if (!instrument) return;

    // Automatically pick an appropriate candle resolution for this timeframe
    if (tf === '1D') {
      setSelectedResolution('5m');
    } else if (tf === '5D') {
      setSelectedResolution('15m');
    } else if (tf === '1M' || tf === '3M' || tf === '6M' || tf === '1Y') {
      setSelectedResolution('1D');
    }

    setIsLoadingTimeframe(true);
    try {
      const fetched = await fetchTimeframeCandles(instrument, tf, token);
      if (fetched && fetched.length > 0) {
        if (quote && quote.lastPrice > 0) {
          fetched[fetched.length - 1].close = quote.lastPrice;
        }
        setActiveCandles(fetched);
      }
    } catch (err) {
      console.warn('Failed to switch timeframe candles:', err);
    } finally {
      setIsLoadingTimeframe(false);
    }
  };

  // Automatically load selected resolution whenever symbol changes
  useEffect(() => {
    if (instrument) {
      handleResolutionChange(selectedResolution);
    }
  }, [instrument?.symbol]);

  // Auto-refresh 1m and 5m live intraday candles every 12 seconds during active trading
  useEffect(() => {
    if (!instrument || (selectedResolution !== '1m' && selectedResolution !== '5m')) return;
    const intervalId = setInterval(async () => {
      try {
        const fetched = await fetchCandlesByResolution(instrument, selectedResolution, token);
        if (fetched && fetched.length > 0) {
          if (quote && quote.lastPrice > 0) {
            fetched[fetched.length - 1].close = quote.lastPrice;
          }
          setActiveCandles(fetched);
        }
      } catch {
        // Silent fail for periodic poll
      }
    }, 12000);

    return () => clearInterval(intervalId);
  }, [instrument?.symbol, selectedResolution, token, quote?.lastPrice]);

  // Keep latest live price synced to the last candle
  const displayCandles = useMemo(() => {
    if (!activeCandles || activeCandles.length === 0) return initialCandles;
    const list = [...activeCandles];
    if (quote && quote.lastPrice > 0 && list.length > 0) {
      const last = { ...list[list.length - 1] };
      last.close = quote.lastPrice;
      if (quote.dayHigh) last.high = Math.max(last.high, quote.dayHigh);
      if (quote.dayLow) last.low = Math.min(last.low, quote.dayLow);
      list[list.length - 1] = last;
    }
    return list;
  }, [activeCandles, initialCandles, quote]);

  // Display ALL candles of the selected timeframe without cutting off the month!
  const candlesToShow = useMemo(() => {
    return displayCandles;
  }, [displayCandles]);

  // Dimensions matching TradingView layout
  const svgWidth = 920;
  const svgHeight = 440;
  const margin = { top: 25, right: 85, bottom: 55, left: 15 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const mainPlotHeight = svgHeight - margin.top - margin.bottom - (showVolume ? 60 : 0);
  const volumeTop = margin.top + mainPlotHeight + 8;
  const volumeHeight = showVolume ? 45 : 0;

  // Price boundaries
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    const historicalLows = candlesToShow.map((c) => c.low);
    const historicalHighs = candlesToShow.map((c) => c.high);
    const forecastLows = quantiles.q10;
    const forecastHighs = quantiles.q90;
    const setupLevels = [setup.currentPrice, setup.futureEntry, setup.target, setup.stoploss];

    const allMins = [...historicalLows, ...forecastLows, ...setupLevels].filter((v) => !isNaN(v) && v > 0);
    const allMaxs = [...historicalHighs, ...forecastHighs, ...setupLevels].filter((v) => !isNaN(v) && v > 0);

    const rawMin = Math.min(...allMins);
    const rawMax = Math.max(...allMaxs);
    const pad = (rawMax - rawMin) * 0.08 || 4;

    const minP = Math.floor(rawMin - pad);
    const maxP = Math.ceil(rawMax + pad);
    return { minPrice: minP, maxPrice: maxP, priceRange: maxP - minP || 1 };
  }, [candlesToShow, quantiles, setup]);

  // Volume boundaries
  const maxVolume = useMemo(() => {
    const vols = candlesToShow.map((c) => c.volume || 0);
    return Math.max(...vols, 1000);
  }, [candlesToShow]);

  // Scaling helpers
  const totalPoints = candlesToShow.length + quantiles.horizons.length;

  const getX = (index: number) => {
    return margin.left + (index / (totalPoints - 1)) * plotWidth;
  };

  const getY = (price: number) => {
    const norm = (price - minPrice) / priceRange;
    return margin.top + (1 - norm) * mainPlotHeight;
  };

  const getPriceFromY = (y: number) => {
    const norm = 1 - (y - margin.top) / mainPlotHeight;
    return minPrice + norm * priceRange;
  };

  const getVolY = (vol: number) => {
    const norm = Math.min(vol / maxVolume, 1);
    return volumeTop + volumeHeight - norm * volumeHeight;
  };

  // Historical coordinates
  const historyPoints = useMemo(() => {
    return candlesToShow.map((c, i) => ({
      x: getX(i),
      candle: c,
    }));
  }, [candlesToShow, totalPoints, plotWidth]);

  // Forecast path coordinates
  const lastHistIdx = candlesToShow.length - 1;
  const lastHistX = getX(lastHistIdx);
  const lastClose = candlesToShow[lastHistIdx]?.close ?? setup.currentPrice;

  const forecastPoints = useMemo(() => {
    return quantiles.horizons.map((h, i) => {
      const idx = lastHistIdx + 1 + i;
      return {
        x: getX(idx),
        step: h,
        q10: quantiles.q10[i],
        q25: quantiles.q25[i],
        q50: quantiles.q50[i],
        q75: quantiles.q75[i],
        q90: quantiles.q90[i],
        timestralQ50: quantiles.timestralQ50[i],
        chronosQ50: quantiles.chronosQ50[i],
        time: quantiles.timestamps[i],
      };
    });
  }, [quantiles, lastHistIdx, totalPoints, plotWidth]);

  // Shaded cone paths
  const outerConePath = useMemo(() => {
    if (forecastPoints.length === 0) return '';
    let path = `M ${lastHistX} ${getY(lastClose)}`;
    forecastPoints.forEach((pt) => {
      path += ` L ${pt.x} ${getY(pt.q90)}`;
    });
    for (let i = forecastPoints.length - 1; i >= 0; i--) {
      path += ` L ${forecastPoints[i].x} ${getY(forecastPoints[i].q10)}`;
    }
    path += ` Z`;
    return path;
  }, [forecastPoints, lastHistX, lastClose, minPrice, priceRange, mainPlotHeight]);

  const medianLinePath = useMemo(() => {
    let path = `M ${lastHistX} ${getY(lastClose)}`;
    forecastPoints.forEach((pt) => {
      path += ` L ${pt.x} ${getY(pt.q50)}`;
    });
    return path;
  }, [forecastPoints, lastHistX, lastClose, minPrice, priceRange, mainPlotHeight]);

  // Y-axis grid lines (e.g. ₹1192, ₹1190, ₹1188 as in user's screenshot)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const count = 6;
    const step = priceRange / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(roundToDecimal(minPrice + i * step, 1));
    }
    return ticks;
  }, [minPrice, priceRange]);

  // X-axis time labels spanning the full timeframe or resolution
  const xTimeTicks = useMemo(() => {
    if (candlesToShow.length === 0) return [];
    const ticks: { x: number; label: string }[] = [];
    const count = Math.min(6, candlesToShow.length);
    const step = Math.max(Math.floor((candlesToShow.length - 1) / (count - 1)), 1);

    for (let i = 0; i < candlesToShow.length; i += step) {
      const c = candlesToShow[i];
      if (!c) continue;
      const d = new Date(c.timestamp);
      let label = '';
      if (selectedResolution === '1m' || selectedResolution === '5m' || selectedTimeframe === '1D') {
        label = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
      } else if (selectedResolution === '15m' || selectedResolution === '30m' || selectedTimeframe === '5D') {
        label = `${d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })}`;
      } else {
        label = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
      }
      ticks.push({ x: getX(i), label });
    }

    const lastIdx = candlesToShow.length - 1;
    if (lastIdx > 0 && !ticks.some((t) => Math.abs(t.x - getX(lastIdx)) < 45)) {
      const lastC = candlesToShow[lastIdx];
      const d = new Date(lastC.timestamp);
      const label = (selectedResolution === '1m' || selectedResolution === '5m' || selectedTimeframe === '1D')
        ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
      ticks.push({ x: getX(lastIdx), label });
    }

    return ticks;
  }, [candlesToShow, selectedTimeframe, selectedResolution, totalPoints, plotWidth]);

  // Crosshair event handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((e.clientY - rect.top) / rect.height) * svgHeight;

    if (mouseX < margin.left || mouseX > svgWidth - margin.right) {
      setHoverData(null);
      return;
    }

    const calculatedPrice = getPriceFromY(mouseY);

    let closestCandle: Candle | undefined;
    let closestForecast: typeof forecastPoints[0] | undefined;
    let minD = Infinity;

    historyPoints.forEach((pt) => {
      const d = Math.abs(pt.x - mouseX);
      if (d < minD) {
        minD = d;
        closestCandle = pt.candle;
        closestForecast = undefined;
      }
    });

    forecastPoints.forEach((pt) => {
      const d = Math.abs(pt.x - mouseX);
      if (d < minD) {
        minD = d;
        closestForecast = pt;
        closestCandle = undefined;
      }
    });

    let timeText = '';
    if (closestCandle) {
      const cd = new Date(closestCandle.timestamp);
      if (selectedResolution === '1m' || selectedResolution === '5m') {
        timeText = `${cd.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })} (${selectedResolution})`;
      } else if (selectedResolution === '1D') {
        timeText = cd.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
      } else {
        timeText = `${cd.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })} ${cd.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })}`;
      }
    } else if (closestForecast) {
      timeText = `+${closestForecast.step} (${selectedResolution === '1m' ? `${closestForecast.step}m` : selectedResolution === '5m' ? `${closestForecast.step * 5}m` : selectedTimeframe === '1D' ? `${closestForecast.step * 5}m` : `${closestForecast.step}d`})`;
    }

    setHoverData({
      x: mouseX,
      y: mouseY,
      price: calculatedPrice,
      timeText,
      candle: closestCandle,
      forecast: closestForecast,
    });
  };

  const isUp = (quote?.change ?? 0) >= 0;

  return (
    <div
      ref={containerRef}
      className="flex flex-col rounded-xl border border-[#2a2e39] bg-[#131722] overflow-hidden shadow-2xl font-sans"
    >
      {/* 1. TRADINGVIEW TOP BAR (Stock, Live Price, Status & Controls) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2e39] px-4 py-2.5 bg-[#171b26]">
        {/* Left: Symbol & Live Tick Quote */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white tracking-wide">{symbol}</span>
            <span className="text-xs text-slate-500 font-mono">NSE</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-400 font-medium">{name}</span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-lg font-bold text-white">
              ₹{setup.currentPrice.toFixed(2)}
            </span>
            {quote && quote.change !== undefined && (
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  isUp ? 'text-[#26a69a] bg-[#26a69a]/10' : 'text-[#ef5350] bg-[#ef5350]/10'
                }`}
              >
                {isUp ? '+' : ''}{quote.change.toFixed(2)} ({isUp ? '+' : ''}{quote.changePercent?.toFixed(2)}%)
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#26a69a] bg-[#26a69a]/15 px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-[#26a69a] animate-pulse" />
              LIVE TICK
            </span>
          </div>
        </div>

        {/* Center: Candle Interval Resolution Selector (1m, 5m, 15m, 30m, 1D) */}
        <div className="flex items-center gap-1.5 bg-[#131722] px-2.5 py-1 rounded-lg border border-[#2a2e39] shadow-inner">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-1 tracking-wider">Interval:</span>
          {(['1m', '5m', '15m', '30m', '1D'] as CandleResolution[]).map((res) => (
            <button
              key={res}
              onClick={() => handleResolutionChange(res)}
              className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded transition-all cursor-pointer ${
                selectedResolution === res
                  ? 'bg-[#2962ff] text-white shadow-sm ring-1 ring-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-[#2a2e39]'
              }`}
              title={`Switch chart to ${res} candlesticks`}
            >
              {res}
            </button>
          ))}
          {selectedResolution === '1m' && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded ml-1">
              TODAY'S SESSION
            </span>
          )}
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setChartMode(chartMode === 'candle' ? 'line' : 'candle')}
            className="px-2.5 py-1 rounded bg-[#2a2e39] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {chartMode === 'candle' ? 'Candles' : 'Line'}
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              showVolume ? 'bg-[#2a2e39] text-[#26a69a]' : 'bg-[#1e222d] text-slate-500'
            }`}
          >
            Vol
          </button>
          <button
            onClick={() => setShowModels(!showModels)}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              showModels ? 'bg-[#2a2e39] text-purple-400' : 'bg-[#1e222d] text-slate-500'
            }`}
          >
            Forecast Fan
          </button>
        </div>
      </div>

      {/* 2. OHLC LEGEND DISPLAY (Updates when hovering candles) */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#1e222d] px-4 py-1.5 text-[11px] font-mono text-slate-400 bg-[#131722]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded text-[10px]">
            {selectedResolution} BARS
          </span>
          {hoverData?.candle ? (
            <>
              <span>O: <strong className="text-white">₹{hoverData.candle.open.toFixed(2)}</strong></span>
              <span>H: <strong className="text-[#26a69a]">₹{hoverData.candle.high.toFixed(2)}</strong></span>
              <span>L: <strong className="text-[#ef5350]">₹{hoverData.candle.low.toFixed(2)}</strong></span>
              <span>C: <strong className={hoverData.candle.close >= hoverData.candle.open ? 'text-[#26a69a]' : 'text-[#ef5350]'}>₹{hoverData.candle.close.toFixed(2)}</strong></span>
              <span>Vol: <strong className="text-slate-300">{(hoverData.candle.volume || 0).toLocaleString('en-IN')}</strong></span>
            </>
          ) : (
            <>
              <span>Entry: <strong className="text-amber-400">₹{setup.futureEntry.toFixed(2)}</strong></span>
              <span>Target: <strong className="text-[#26a69a]">₹{setup.target.toFixed(2)}</strong></span>
              <span>SL: <strong className="text-[#ef5350]">₹{setup.stoploss.toFixed(2)}</strong></span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400">Δ Pairwise Gap &ge; ₹{setup.minDiff.toFixed(2)} Guaranteed</span>
            </>
          )}
        </div>

        {isLoadingTimeframe && (
          <div className="flex items-center gap-1.5 text-cyan-400 animate-pulse text-[10px]">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Streaming {selectedResolution} candles...</span>
          </div>
        )}
      </div>

      {/* 3. TRADINGVIEW CANVAS (Candlesticks, Volume, Right Price Scale, Fan Cone) */}
      <div className="relative w-full select-none overflow-hidden bg-[#131722]">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverData(null)}
        >
          <defs>
            {/* Shaded Forecast Fan Gradient */}
            <linearGradient id={`fanGrad-${symbol}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.10" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines (Horizontal Price Grid) */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke="#1e222d"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                {/* Right Axis Price Text (e.g. ₹1192.00, ₹1190.00, ₹1188.00) */}
                <text
                  x={svgWidth - margin.right + 6}
                  y={y + 3.5}
                  fill="#787b86"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  ₹{tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Vertical Time Grid Lines */}
          {xTimeTicks.map((tick, i) => (
            <line
              key={i}
              x1={tick.x}
              y1={margin.top}
              x2={tick.x}
              y2={svgHeight - margin.bottom}
              stroke="#1e222d"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          ))}

          {/* Now Divider (Separates History from Future Forecast) */}
          <line
            x1={lastHistX}
            y1={margin.top}
            x2={lastHistX}
            y2={svgHeight - margin.bottom}
            stroke="#434651"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />

          {/* VOLUME HISTOGRAM (Bottom bars matching red/green candles) */}
          {showVolume &&
            historyPoints.map((pt, i) => {
              const { open, close, volume } = pt.candle;
              const isGreen = close >= open;
              const barColor = isGreen ? '#26a69a' : '#ef5350';
              const yVol = getVolY(volume || 0);
              const barHeight = Math.max(volumeTop + volumeHeight - yVol, 1.5);
              const barWidth = Math.max((plotWidth / totalPoints) * 0.75, 2.5);

              return (
                <rect
                  key={`vol-${i}`}
                  x={pt.x - barWidth / 2}
                  y={yVol}
                  width={barWidth}
                  height={barHeight}
                  fill={barColor}
                  opacity="0.45"
                />
              );
            })}

          {/* PROBABILISTIC FORECAST FAN CONE (Mistral Timestral & Chronos) */}
          {showModels && (
            <>
              {/* Shaded Uncertainty Cloud (Q10 - Q90) */}
              <path d={outerConePath} fill={`url(#fanGrad-${symbol})`} />

              {/* Median Projection Trajectory (Q50) */}
              <path
                d={medianLinePath}
                fill="none"
                stroke="#c084fc"
                strokeWidth="2.2"
                strokeDasharray="3 2"
              />

              {forecastPoints.map((pt) => (
                <circle
                  key={pt.step}
                  cx={pt.x}
                  cy={getY(pt.q50)}
                  r="3"
                  fill="#c084fc"
                  stroke="#131722"
                  strokeWidth="1.5"
                />
              ))}
            </>
          )}

          {/* CANDLESTICKS OR LINE */}
          {chartMode === 'line' ? (
            <path
              d={historyPoints.reduce((acc, pt, i) => {
                const y = getY(pt.candle.close);
                return i === 0 ? `M ${pt.x} ${y}` : `${acc} L ${pt.x} ${y}`;
              }, '')}
              fill="none"
              stroke="#2962ff"
              strokeWidth="2"
            />
          ) : (
            historyPoints.map((pt, i) => {
              const { open, high, low, close } = pt.candle;
              const isGreen = close >= open;
              const candleColor = isGreen ? '#26a69a' : '#ef5350';
              const yHigh = getY(high);
              const yLow = getY(low);
              const yOpen = getY(open);
              const yClose = getY(close);

              const candleTop = Math.min(yOpen, yClose);
              const candleHeight = Math.max(Math.abs(yClose - yOpen), 1.5);
              const candleWidth = Math.max((plotWidth / totalPoints) * 0.75, 2.5);

              return (
                <g key={`candle-${i}`}>
                  {/* High - Low Wick */}
                  <line
                    x1={pt.x}
                    y1={yHigh}
                    x2={pt.x}
                    y2={yLow}
                    stroke={candleColor}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body */}
                  <rect
                    x={pt.x - candleWidth / 2}
                    y={candleTop}
                    width={candleWidth}
                    height={candleHeight}
                    fill={candleColor}
                    rx="0.5"
                  />
                </g>
              );
            })
          )}

          {/* KEY LEVELS WITH RIGHT AXIS BADGES (Matching User Screenshot) */}
          {/* 1. Stop-Loss Line (Rose) */}
          {(() => {
            const y = getY(setup.stoploss);
            return (
              <g>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke="#ef5350"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <rect
                  x={svgWidth - margin.right + 2}
                  y={y - 8}
                  width="78"
                  height="16"
                  fill="#ef5350"
                  rx="2"
                />
                <text
                  x={svgWidth - margin.right + 6}
                  y={y + 3.5}
                  fill="#ffffff"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  SL: ₹{setup.stoploss.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* 2. Target Line (Green) */}
          {(() => {
            const y = getY(setup.target);
            return (
              <g>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke="#26a69a"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <rect
                  x={svgWidth - margin.right + 2}
                  y={y - 8}
                  width="78"
                  height="16"
                  fill="#26a69a"
                  rx="2"
                />
                <text
                  x={svgWidth - margin.right + 6}
                  y={y + 3.5}
                  fill="#ffffff"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  TG: ₹{setup.target.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* 3. Future Entry Line (Amber) */}
          {(() => {
            const y = getY(setup.futureEntry);
            return (
              <g>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <rect
                  x={svgWidth - margin.right + 2}
                  y={y - 8}
                  width="78"
                  height="16"
                  fill="#b45309"
                  rx="2"
                />
                <text
                  x={svgWidth - margin.right + 6}
                  y={y + 3.5}
                  fill="#fef3c7"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  EN: ₹{setup.futureEntry.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* 4. CURRENT LIVE PRICE (Highlighted solid badge on right axis, exactly like in user's red box!) */}
          {(() => {
            const y = getY(setup.currentPrice);
            const badgeColor = isUp ? '#26a69a' : '#ef5350';
            return (
              <g>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke={badgeColor}
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                {/* P0 Ref Badge */}
                <rect
                  x={svgWidth - margin.right - 58}
                  y={y - 8}
                  width="54"
                  height="16"
                  fill="#2a2e39"
                  rx="2"
                />
                <text
                  x={svgWidth - margin.right - 31}
                  y={y + 3.5}
                  fill="#d1d4dc"
                  fontSize="9"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                >
                  P₀ Ref
                </text>

                {/* Right Axis Live Price Badge (Red/Green solid badge as in screenshot!) */}
                <rect
                  x={svgWidth - margin.right + 2}
                  y={y - 9}
                  width="80"
                  height="18"
                  fill={badgeColor}
                  rx="2"
                />
                <text
                  x={svgWidth - margin.right + 6}
                  y={y + 4}
                  fill="#ffffff"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  ₹{setup.currentPrice.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* Interactive Crosshair & Pinned Badges */}
          {hoverData && (
            <g>
              {/* Vertical line */}
              <line
                x1={hoverData.x}
                y1={margin.top}
                x2={hoverData.x}
                y2={svgHeight - margin.bottom}
                stroke="#787b86"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {/* Horizontal line */}
              <line
                x1={margin.left}
                y1={hoverData.y}
                x2={svgWidth - margin.right}
                y2={hoverData.y}
                stroke="#787b86"
                strokeWidth="1"
                strokeDasharray="2 2"
              />

              {/* Pinned Price Badge on Right Axis */}
              <rect
                x={svgWidth - margin.right + 2}
                y={hoverData.y - 8}
                width="80"
                height="16"
                fill="#2a2e39"
                rx="2"
              />
              <text
                x={svgWidth - margin.right + 6}
                y={hoverData.y + 3.5}
                fill="#ffffff"
                fontSize="9.5"
                fontFamily="JetBrains Mono"
                fontWeight="bold"
              >
                ₹{hoverData.price.toFixed(2)}
              </text>

              {/* Pinned Time Badge on Bottom Axis */}
              <rect
                x={hoverData.x - 32}
                y={svgHeight - margin.bottom + 2}
                width="64"
                height="16"
                fill="#2a2e39"
                rx="2"
              />
              <text
                x={hoverData.x}
                y={svgHeight - margin.bottom + 13.5}
                fill="#ffffff"
                fontSize="9.5"
                fontFamily="JetBrains Mono"
                textAnchor="middle"
              >
                {hoverData.timeText}
              </text>
            </g>
          )}

          {/* 4. BOTTOM TIME AXIS LABELS (e.g. 10:20, 11:30, 13:00, 14:30 as in user's red box!) */}
          {xTimeTicks.map((tick, i) => (
            <text
              key={`time-${i}`}
              x={tick.x}
              y={svgHeight - margin.bottom + 16}
              fill="#787b86"
              fontSize="10"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
            >
              {tick.label}
            </text>
          ))}
        </svg>
      </div>

      {/* 5. BOTTOM TIMEFRAME SELECTORS BAR (Exact match to user's red boxes: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y) */}
      <div className="flex flex-wrap items-center justify-between border-t border-[#2a2e39] px-4 py-2 bg-[#171b26] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono">
            {(['1D', '5D', '1M', '3M', '6M', '1Y'] as ChartTimeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  selectedTimeframe === tf
                    ? 'bg-[#2962ff] text-white shadow-sm'
                    : 'text-[#787b86] hover:text-white hover:bg-[#2a2e39]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-[#1e222d] px-2 py-0.5 rounded border border-[#2a2e39]">
            <span>Candle:</span>
            <span className="text-cyan-400 font-bold">{selectedResolution}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono text-[#787b86]">
          <span className="text-amber-400">Entry Gap: +₹{setup.gapEntryCurr.toFixed(2)} (&ge; ₹{setup.minDiff.toFixed(2)})</span>
          <span className="text-[#26a69a]">Target Gain: +₹{setup.gapTargetEntry.toFixed(2)}</span>
          <span className="text-[#ef5350]">SL Gap: -₹{setup.gapCurrSL.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

function roundToDecimal(val: number, places: number = 1): number {
  const factor = Math.pow(10, places);
  return Math.round(val * factor) / factor;
}
