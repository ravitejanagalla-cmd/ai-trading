interface ProviderInfo {
  status?: string;
  url?: string;
  models?: string[];
}

interface ProviderStatusProps {
  providers: {
    gemini?: ProviderInfo;
    lmstudio?: ProviderInfo;
    ollama?: ProviderInfo;
  };
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'online': return 'bg-green-500';
    case 'configured': return 'bg-blue-500';
    case 'offline': return 'bg-gray-500';
    case 'error': return 'bg-red-500';
    default: return 'bg-gray-400';
  }
};

const getStatusText = (status?: string) => {
  switch (status) {
    case 'online': return 'Online';
    case 'configured': return 'Configured';
    case 'offline': return 'Offline';
    case 'error': return 'Error';
    case 'not_configured': return 'Not Configured';
    default: return 'Unknown';
  }
};

function ProviderCard({ title, icon, info }: { title: string; icon: string; info?: ProviderInfo }) {
  const getStatusBg = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'configured': return 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
  };

  const getDotColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-500';
      case 'configured': return 'bg-sky-500';
      case 'offline': return 'bg-slate-400';
      case 'error': return 'bg-red-500';
      default: return 'bg-slate-300';
    }
  };

  return (
    <div className="card-base shadow-elevated-lg hover:shadow-elevated-xl gradient-overlay">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <div className={`w-3 h-3 rounded-full ${getDotColor(info?.status)} animate-pulse shadow-md`} />
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</div>
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full w-fit shadow-sm border border-current border-opacity-30 ${getStatusBg(info?.status)}`}>
              {getStatusText(info?.status)}
            </div>
          </div>
          {info?.models && (
            <div className="pt-3 border-t-1.5 border-slate-200 dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Models</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{info.models.length}</div>
            </div>
          )}
          {info?.url && (
            <div className="text-xs text-slate-500 dark:text-slate-400 break-all font-mono bg-slate-50 dark:bg-slate-900/30 rounded px-2 py-1.5 border border-slate-200 dark:border-slate-700 shadow-sm">{info.url}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProviderStatus({ providers }: ProviderStatusProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ProviderCard title="Google Gemini" icon="🤖" info={providers.gemini} />
      <ProviderCard title="LM Studio" icon="🎯" info={providers.lmstudio} />
      <ProviderCard title="Ollama" icon="🦙" info={providers.ollama} />
    </div>
  );
}
