interface StatsOverviewProps {
  initialCapital: number;
  universe: string;
  activeModels: number;
  stocksTracked: number;
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className={`interactive-element rounded-lg p-6 border-1.5 shadow-elevated-lg hover:shadow-elevated-xl transition-all ${color}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">{label}</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
        </div>
        <div className="text-4xl opacity-80 ml-2">{icon}</div>
      </div>
    </div>
  );
}

export function StatsOverview({ initialCapital, universe, activeModels, stocksTracked }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard 
        label="Initial Capital" 
        value={`₹${initialCapital.toLocaleString()}`}
        icon="💰"
        color="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
      />
      <StatCard 
        label="Universe" 
        value={universe}
        icon="📈"
        color="bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800"
      />
      <StatCard 
        label="Active Models" 
        value={activeModels}
        icon="🤖"
        color="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
      />
      <StatCard 
        label="Stocks Tracked" 
        value={stocksTracked}
        icon="📊"
        color="bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800"
      />
    </div>
  );
}
