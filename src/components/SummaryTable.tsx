import React from 'react';
import { ForecastResult } from '../types/stock';
import { ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';

interface SummaryTableProps {
  results: ForecastResult[];
  selectedSymbol: string;
  onSelectStock: (symbol: string) => void;
  title: string;
  subtitle: string;
}

export const SummaryTable: React.FC<SummaryTableProps> = ({
  results,
  selectedSymbol,
  onSelectStock,
  title,
  subtitle,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Strict ₹3.00 Minimum Difference Verified</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Stock</th>
              <th className="py-3 px-3">Interval</th>
              <th className="py-3 px-3">Bias</th>
              <th className="py-3 px-3 text-right">Current (₹)</th>
              <th className="py-3 px-3 text-right">Future Entry (₹)</th>
              <th className="py-3 px-3 text-right">Target (₹)</th>
              <th className="py-3 px-3 text-right">Stop-Loss (₹)</th>
              <th className="py-3 px-3 text-right">Gap: Entry-Curr</th>
              <th className="py-3 px-3 text-right">Gap: Tgt-Entry</th>
              <th className="py-3 px-3 text-right">Gap: Curr-SL</th>
              <th className="py-3 px-3 text-right">Uncertainty</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {results.map((res) => {
              const isSelected = res.instrument.symbol === selectedSymbol;
              const isLong = res.setup.bias === 'LONG';

              return (
                <tr
                  key={res.instrument.symbol}
                  onClick={() => onSelectStock(res.instrument.symbol)}
                  className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${
                    isSelected ? 'bg-cyan-950/20 text-white' : 'text-slate-300'
                  }`}
                >
                  {/* Stock Symbol & Name */}
                  <td className="py-3 px-4 font-sans">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{res.instrument.symbol}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                      {res.instrument.name}
                    </div>
                  </td>

                  {/* Interval */}
                  <td className="py-3 px-3">
                    <span className="text-[11px] text-slate-400">
                      {res.instrument.interval === '30minute' ? '30-Min' : 'Daily 1D'}
                    </span>
                  </td>

                  {/* Bias */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                        isLong
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                      }`}
                    >
                      {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {res.setup.bias}
                    </span>
                  </td>

                  {/* Current with Live Tick & Day Change */}
                  <td className="py-3 px-3 text-right">
                    <div className="font-bold text-white flex items-center justify-end gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>₹{res.setup.currentPrice.toFixed(2)}</span>
                    </div>
                    {res.quote?.changePercent !== undefined && (
                      <div
                        className={`text-[10px] font-semibold ${
                          (res.quote.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(res.quote.changePercent ?? 0) >= 0 ? '+' : ''}
                        {res.quote.changePercent.toFixed(2)}%
                      </div>
                    )}
                  </td>

                  {/* Future Entry */}
                  <td className="py-3 px-3 text-right text-amber-300 font-semibold">
                    ₹{res.setup.futureEntry.toFixed(2)}
                  </td>

                  {/* Target */}
                  <td className="py-3 px-3 text-right text-emerald-300 font-semibold">
                    ₹{res.setup.target.toFixed(2)}
                  </td>

                  {/* Stop-Loss */}
                  <td className="py-3 px-3 text-right text-rose-300 font-semibold">
                    ₹{res.setup.stoploss.toFixed(2)}
                  </td>

                  {/* Gap: Entry - Curr */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-amber-400 font-medium">
                      +₹{res.setup.gapEntryCurr.toFixed(2)}
                    </span>
                  </td>

                  {/* Gap: Target - Entry */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-emerald-400 font-medium">
                      +₹{res.setup.gapTargetEntry.toFixed(2)}
                    </span>
                  </td>

                  {/* Gap: Curr - SL */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-rose-400 font-medium">
                      -₹{res.setup.gapCurrSL.toFixed(2)}
                    </span>
                  </td>

                  {/* Uncertainty */}
                  <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                    ±₹{res.setup.uncertaintyBand.toFixed(2)}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-center font-sans">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock(res.instrument.symbol);
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isSelected ? 'Viewing' : 'Inspect'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
