import React from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  onOpenTokenModal: () => void;
  hasCustomToken: boolean;
  useDemoData: boolean;
  activeView: 'intraday' | 'daily' | 'all';
  onSelectView: (view: 'intraday' | 'daily' | 'all') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenTokenModal,
  hasCustomToken,
  useDemoData,
  activeView,
  onSelectView,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Brand wordmark (single text element) */}
        <a
          href="/"
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 rotate-45" />
          <span>Upstox AI Forecaster</span>
        </a>

        {/* Zone 2: Clean single-line nav links / view switcher */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            onClick={() => onSelectView('intraday')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeView === 'intraday' ? 'text-cyan-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Intraday (3 Stocks)
          </button>
          <button
            onClick={() => onSelectView('daily')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeView === 'daily' ? 'text-cyan-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            Daily (6 Stocks)
          </button>
          <button
            onClick={() => onSelectView('all')}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeView === 'all' ? 'text-cyan-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            All 9 Stocks Overview
          </button>
          <a
            href="#architecture"
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-200"
          >
            Timestral &amp; Chronos Engine
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenTokenModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              hasCustomToken && !useDemoData
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/60'
                : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {hasCustomToken && !useDemoData ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>
              {hasCustomToken && !useDemoData ? 'Upstox Connected' : 'Upstox Token'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
