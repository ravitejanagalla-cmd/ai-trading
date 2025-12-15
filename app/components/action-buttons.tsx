interface ActionButtonsProps {
  onFetchData: () => void;
  onRunSimulation: () => void;
  isRunning: boolean;
  hasActiveModels: boolean;
}

export function ActionButtons({ onFetchData, onRunSimulation, isRunning, hasActiveModels }: ActionButtonsProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={onFetchData}
          className="interactive-element flex-1 px-6 py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-lg font-bold shadow-elevated hover:shadow-elevated-lg border border-sky-500/50 dark:border-sky-600/50 flex items-center justify-center gap-2"
        >
          <span className="text-xl">📊</span>
          <span>Fetch NIFTY 50 Data</span>
        </button>

        <button
          onClick={onRunSimulation}
          disabled={isRunning || !hasActiveModels}
          className={`interactive-element flex-1 px-6 py-3 rounded-lg font-bold border flex items-center justify-center gap-2 ${
            isRunning || !hasActiveModels
              ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50 border-slate-300 dark:border-slate-600'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-elevated hover:shadow-elevated-lg border border-emerald-500/50 dark:border-emerald-600/50'
          }`}
        >
          <span className="text-xl">{isRunning ? '⏳' : '🚀'}</span>
          <span>{isRunning ? 'Running Simulation...' : 'Run Simulation'}</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <a
          href="/analyze"
          className="interactive-element flex-1 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg font-bold shadow-elevated hover:shadow-elevated-lg border border-violet-500/50 dark:border-violet-600/50 flex items-center justify-center gap-2"
        >
          <span className="text-xl">🧠</span>
          <span>AI Analysis</span>
        </a>

        <a
          href="/market/live"
          className="interactive-element flex-1 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg font-bold shadow-elevated hover:shadow-elevated-lg border border-amber-500/50 dark:border-amber-600/50 flex items-center justify-center gap-2"
        >
          <span className="text-xl">📈</span>
          <span>Live Market</span>
        </a>
      </div>
    </>
  );
}
