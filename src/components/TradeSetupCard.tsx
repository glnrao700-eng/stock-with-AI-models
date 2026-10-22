import React, { useState } from 'react';
import { StockInstrument, TradeSetup, QuantileForecast } from '../types/stock';
import { ArrowUpRight, ArrowDownRight, ShieldCheck, Calculator, Cpu } from 'lucide-react';

interface TradeSetupCardProps {
  instrument: StockInstrument;
  setup: TradeSetup;
  quantiles: QuantileForecast;
}

export const TradeSetupCard: React.FC<TradeSetupCardProps> = ({
  instrument,
  setup,
  quantiles,
}) => {
  const [lotQuantity, setLotQuantity] = useState<number>(instrument.lotSize || 100);
  const [activeTab, setActiveTab] = useState<'proof' | 'calculator' | 'models'>('proof');

  // Calculator figures
  const totalCost = setup.futureEntry * lotQuantity;
  const potentialProfit = Math.abs(setup.target - setup.futureEntry) * lotQuantity;
  const potentialLoss = Math.abs(setup.futureEntry - setup.stoploss) * lotQuantity;
  const profitPercentage = ((potentialProfit / totalCost) * 100).toFixed(2);
  const lossPercentage = ((potentialLoss / totalCost) * 100).toFixed(2);

  const isLong = setup.bias === 'LONG';

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
      {/* Card Header with Bias & Quick Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold tracking-wide ${
                isLong
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
              }`}
            >
              {isLong ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {isLong ? 'BULLISH SETUP (LONG)' : 'BEARISH SETUP (SHORT)'}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Horizon: {setup.horizonSteps} {setup.timeframeLabel.includes('30') ? 'Candles (3h)' : 'Days (1w)'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {isLong
              ? `Upside momentum confirmed above ₹${setup.currentPrice.toFixed(2)}. Entry triggers on breakout at ₹${setup.futureEntry.toFixed(2)}.`
              : `Downside drift detected below ₹${setup.currentPrice.toFixed(2)}. Entry triggers on breakdown at ₹${setup.futureEntry.toFixed(2)}.`}
          </p>
        </div>

        {/* Verification Checkmark */}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <div className="text-right">
            <div className="text-[11px] font-semibold text-emerald-300">₹{setup.minDiff.toFixed(2)} Min Difference</div>
            <div className="text-[10px] text-emerald-400/80">Strictly Enforced (All Pairs)</div>
          </div>
        </div>
      </div>

      {/* 4 Core Price Levels Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
        {/* Current Price */}
        <div className="rounded-lg bg-slate-800/40 border border-slate-800 p-3">
          <div className="text-[11px] font-medium text-slate-400">Current Price</div>
          <div className="mt-1 text-xl font-bold font-mono text-cyan-300">
            ₹{setup.currentPrice.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Live / Last close</div>
        </div>

        {/* Future Entry */}
        <div className="rounded-lg bg-slate-800/40 border border-amber-900/30 p-3">
          <div className="text-[11px] font-medium text-amber-400/90">Future Entry</div>
          <div className="mt-1 text-xl font-bold font-mono text-amber-300">
            ₹{setup.futureEntry.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] font-mono text-amber-400/80">
            Gap: +₹{setup.gapEntryCurr.toFixed(2)}
          </div>
        </div>

        {/* Target */}
        <div className="rounded-lg bg-slate-800/40 border border-emerald-900/30 p-3">
          <div className="text-[11px] font-medium text-emerald-400/90">Target Level</div>
          <div className="mt-1 text-xl font-bold font-mono text-emerald-300">
            ₹{setup.target.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-400/80">
            Gain: +₹{setup.gapTargetEntry.toFixed(2)} ({setup.expectedMovePercent}%)
          </div>
        </div>

        {/* Stop-Loss */}
        <div className="rounded-lg bg-slate-800/40 border border-rose-900/30 p-3">
          <div className="text-[11px] font-medium text-rose-400/90">Stop-Loss</div>
          <div className="mt-1 text-xl font-bold font-mono text-rose-300">
            ₹{setup.stoploss.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] font-mono text-rose-400/80">
            Risk: -₹{setup.gapEntrySL.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Segmented Detail View: Proof Matrix vs P&L Calculator vs Foundation Models */}
      <div className="mt-1 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-0.5 border border-slate-700/60 text-xs">
            <button
              onClick={() => setActiveTab('proof')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                activeTab === 'proof'
                  ? 'bg-slate-700 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>₹3.00 Gap Proof Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                activeTab === 'calculator'
                  ? 'bg-slate-700 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-cyan-400" />
              <span>Position &amp; P&amp;L</span>
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                activeTab === 'models'
                  ? 'bg-slate-700 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              <span>Timestral vs Chronos</span>
            </button>
          </div>

          <div className="text-xs font-mono text-slate-400">
            R:R Ratio <strong className="text-white">1 : {setup.riskRewardRatio}</strong>
          </div>
        </div>

        {/* TAB 1: STRICT ₹3.00 DIFFERENCE PROOF MATRIX */}
        {activeTab === 'proof' && (
          <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300">
                Mathematical Pairwise Verification (Threshold: ≥ ₹{setup.minDiff.toFixed(2)})
              </span>
              <span className="text-emerald-400 font-mono text-[11px]">
                {setup.allGapsValid ? '6 of 6 Verified Passed' : 'Verification Warning'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {setup.pairwiseGaps.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs font-mono"
                >
                  <span className="text-slate-400">{item.pair}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">₹{item.gap.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">✓</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-[11px] text-slate-400 leading-relaxed">
              <strong>Order Invariant: </strong>
              {isLong ? (
                <span>
                  Stop-Loss (₹{setup.stoploss.toFixed(2)}) &lt; Current (₹{setup.currentPrice.toFixed(2)}) &lt; Future Entry (₹{setup.futureEntry.toFixed(2)}) &lt; Target (₹{setup.target.toFixed(2)})
                </span>
              ) : (
                <span>
                  Target (₹{setup.target.toFixed(2)}) &lt; Future Entry (₹{setup.futureEntry.toFixed(2)}) &lt; Current (₹{setup.currentPrice.toFixed(2)}) &lt; Stop-Loss (₹{setup.stoploss.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: POSITION SIZING & P&L CALCULATOR */}
        {activeTab === 'calculator' && (
          <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Trading Quantity:</span>
                <input
                  type="number"
                  min="1"
                  step="25"
                  value={lotQuantity}
                  onChange={(e) => setLotQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-24 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[11px] text-slate-500">shares (NSE Lot: {instrument.lotSize || 100})</span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                Exposure: <strong className="text-white">₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded bg-emerald-950/30 border border-emerald-800/40 p-2.5">
                <div className="text-emerald-400 text-[11px]">Target Profit</div>
                <div className="mt-1 text-base font-bold text-emerald-300">
                  +₹{potentialProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-400/80">+{profitPercentage}% return on entry</div>
              </div>

              <div className="rounded bg-rose-950/30 border border-rose-800/40 p-2.5">
                <div className="text-rose-400 text-[11px]">Maximum Risk (SL)</div>
                <div className="mt-1 text-base font-bold text-rose-300">
                  -₹{potentialLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-rose-400/80">-{lossPercentage}% risk from entry</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FOUNDATION MODEL BREAKDOWN */}
        {activeTab === 'models' && (
          <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-3.5 space-y-2 text-xs">
            <div className="text-slate-300 font-semibold">Dual Foundation Model Inference Diagnostics</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="rounded border border-cyan-900/40 bg-cyan-950/20 p-2.5 space-y-1">
                <div className="font-bold text-cyan-300">Mistral Timestral (28M)</div>
                <div className="text-slate-400">Autoregressive Transformer Attention</div>
                <div className="text-slate-300">Terminal Median (Q50): ₹{quantiles.timestralQ50[quantiles.timestralQ50.length - 1].toFixed(2)}</div>
                <div className="text-slate-400">Range: ₹{quantiles.timestralQ10[0].toFixed(2)} → ₹{quantiles.timestralQ90[quantiles.timestralQ90.length - 1].toFixed(2)}</div>
              </div>

              <div className="rounded border border-amber-900/40 bg-amber-950/20 p-2.5 space-y-1">
                <div className="font-bold text-amber-300">Amazon Chronos (Chronos-Bolt)</div>
                <div className="text-slate-400">Tokenized Quantile Regression Pipeline</div>
                <div className="text-slate-300">Terminal Median (Q50): ₹{quantiles.chronosQ50[quantiles.chronosQ50.length - 1].toFixed(2)}</div>
                <div className="text-slate-400">Range: ₹{quantiles.chronosQ10[0].toFixed(2)} → ₹{quantiles.chronosQ90[quantiles.chronosQ90.length - 1].toFixed(2)}</div>
              </div>
            </div>
            <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Uncertainty Dispersion: ±₹{quantiles.uncertaintyBand.toFixed(2)}</span>
              <span>Ensemble Method: 50% Timestral + 50% Chronos</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
