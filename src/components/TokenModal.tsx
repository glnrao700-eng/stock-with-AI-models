import React, { useState } from 'react';
import { UpstoxConfig, ApiDiagnostics } from '../types/stock';
import { testUpstoxApiConnection } from '../services/upstoxService';
import { X, KeyRound, Sliders, CheckCircle2, AlertCircle, RefreshCw, Zap, ExternalLink } from 'lucide-react';

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UpstoxConfig;
  onSaveConfig: (newConfig: UpstoxConfig) => void;
  onRefreshData: () => void;
  isLoading: boolean;
}

export const TokenModal: React.FC<TokenModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onRefreshData,
  isLoading,
}) => {
  const [token, setToken] = useState<string>(config.accessToken);
  const [useDemo, setUseDemo] = useState<boolean>(config.useDemoData);
  const [minDiff, setMinDiff] = useState<number>(config.minPriceDiff);
  const [timestralWeight, setTimestralWeight] = useState<number>(config.timestralWeight);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(config.autoRefreshInterval || 10);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<ApiDiagnostics | null>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    localStorage.setItem('upstox_access_token', token.trim());
    localStorage.setItem('upstox_use_demo', String(useDemo));
    localStorage.setItem('upstox_min_diff', String(minDiff));

    onSaveConfig({
      ...config,
      accessToken: token.trim(),
      useDemoData: useDemo,
      minPriceDiff: Math.max(3.0, minDiff),
      timestralWeight,
      chronosWeight: 1 - timestralWeight,
      autoRefreshInterval,
    });
    onClose();
    onRefreshData();
  };

  const handleTestToken = async () => {
    setIsTesting(true);
    setDiagnosticResult(null);
    try {
      const res = await testUpstoxApiConnection(token.trim());
      setDiagnosticResult(res);
    } catch (err: unknown) {
      setDiagnosticResult({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
        lastChecked: new Date().toLocaleTimeString('en-IN'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden text-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Upstox Live API &amp; Model Diagnostics</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Important Notice on Upstox Live Price Mechanism */}
          <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3.5 space-y-1.5">
            <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>How Live Prices from Upstox Work</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1. <strong>Historical 2-Month Candles:</strong> Fetched <strong>directly from Upstox API v2 servers</strong>. No token required!
              <br />
              2. <strong>Real-Time Live Price (LTP):</strong> Upstox requires an <strong>Interactive Access Token</strong> for real-time sub-second market quotes (<code className="text-cyan-300 font-mono">/v2/market-quote/ltp</code>).
              <br />
              3. <strong>Daily Expiry Rule:</strong> Upstox access tokens expire every morning at <strong>3:30 AM IST</strong>. If your token was generated yesterday, Upstox rejects it with <code className="text-rose-400 font-mono">UDAPI100050</code>.
            </p>
          </div>

          {/* Upstox Bearer Token Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-200">
                Upstox API v2 Interactive Access Token
              </label>
              <div className="flex items-center gap-2">
                <a
                  href="https://developer.upstox.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Get Token</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={handleTestToken}
                  disabled={isTesting}
                  className="text-[11px] text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                  <span>Test Connection Now</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Upstox Bearer token here (e.g., eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 font-mono text-xs text-white focus:outline-none focus:border-cyan-500"
            />

            {/* Diagnostic Output */}
            {diagnosticResult && (
              <div
                className={`rounded-lg border p-3 font-mono text-[11px] space-y-1.5 ${
                  diagnosticResult.status === 'connected'
                    ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'
                    : diagnosticResult.status === 'no_token_historical_only'
                    ? 'border-cyan-800/60 bg-cyan-950/30 text-cyan-300'
                    : 'border-rose-800/60 bg-rose-950/30 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5">
                    {diagnosticResult.status === 'connected' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      {diagnosticResult.status === 'connected'
                        ? `Live Upstox Active (HTTP 200 · ${diagnosticResult.latencyMs}ms)`
                        : diagnosticResult.status === 'no_token_historical_only'
                        ? `Historical Candles Active (HTTP 200 · ${diagnosticResult.latencyMs}ms)`
                        : 'Upstox Token Validation Failed'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{diagnosticResult.lastChecked}</span>
                </div>
                <div className="text-slate-300">{diagnosticResult.message}</div>
                {diagnosticResult.status === 'expired_token' && (
                  <div className="text-amber-300 text-[10px] pt-1 border-t border-rose-900/40">
                    Tip: Go to developer.upstox.com &gt; My Apps &gt; Generate Interactive Token and paste the fresh token above.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Mode Switch */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Live Upstox Mode</div>
              <div className="text-[11px] text-slate-400">
                {useDemo
                  ? 'Currently using offline calibrated dataset'
                  : 'Currently fetching real-time candles & quotes from api.upstox.com'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUseDemo(!useDemo)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                !useDemo ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  !useDemo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto Refresh Interval */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Live Price Polling Frequency</div>
                <div className="text-[11px] text-slate-400">
                  Automatically refreshes live prices from Upstox during market hours
                </div>
              </div>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                {[0, 5, 10, 30].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setAutoRefreshInterval(sec)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                      autoRefreshInterval === sec
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec === 0 ? 'Off' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Strict Minimum Price Difference Setting */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Strict Minimum Price Difference (₹)</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Guarantees at least this difference between every pair (Current, Entry, Target, SL)
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold font-mono text-amber-400">₹</span>
                <input
                  type="number"
                  min="3.0"
                  step="0.5"
                  value={minDiff}
                  onChange={(e) => setMinDiff(Math.max(3.0, Number(e.target.value)))}
                  className="w-18 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/80 px-5 py-3.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Save &amp; Fetch Live Prices</span>
          </button>
        </div>
      </div>
    </div>
  );
};
