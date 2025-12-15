import { ThemeToggle } from './theme-toggle';

interface HeaderProps {
  onRefreshStatus: () => void;
  activeModelsCount: number;
}

export function Header({ onRefreshStatus, activeModelsCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 shadow-elevated-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-elevated-lg flex items-center justify-center text-white text-lg font-bold">
              📈
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Trading Platform</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI-Powered Analysis & Simulation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right px-3 py-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg border-1.5 border-sky-100 dark:border-sky-800 shadow-sm">
              <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">Active Models</div>
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-300 mt-1">{activeModelsCount}</div>
            </div>
            
            <ThemeToggle />
            
            <button
              onClick={onRefreshStatus}
              className="interactive-element px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium border-1.5 border-slate-300 dark:border-slate-700 shadow-elevated hover:shadow-elevated-lg flex items-center gap-2"
            >
              <span>🔄</span>
              <span className="hidden sm:inline text-sm">Refresh</span>
            </button>
            
            <a
              href="/analyze"
              className="interactive-element px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-lg font-medium shadow-elevated-lg hover:shadow-elevated-xl border border-sky-500/50 dark:border-sky-600/50 flex items-center gap-2"
            >
              <span>🔍</span>
              <span className="hidden sm:inline text-sm">Analyze</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
