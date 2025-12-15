'use client';

import { useState } from 'react';

interface DebugLog {
  type: string;
  stage: string;
  timestamp: string;
  model?: string;
  data: any;
}

interface DebugLogsProps {
  logs: DebugLog[];
  onClear: () => void;
}

const getLogBgColor = (type: string) => {
  switch (type) {
    case 'data_fetch': return 'border-blue-500 bg-blue-500/10';
    case 'market_data': return 'border-green-500 bg-green-500/10';
    case 'llm_input': return 'border-yellow-500 bg-yellow-500/10';
    case 'llm_output': return 'border-purple-500 bg-purple-500/10';
    default: return 'border-gray-500 bg-gray-500/10';
  }
};

const getLogBadgeColor = (type: string) => {
  switch (type) {
    case 'data_fetch': return 'bg-blue-500/20 text-blue-300';
    case 'market_data': return 'bg-green-500/20 text-green-300';
    case 'llm_input': return 'bg-yellow-500/20 text-yellow-300';
    case 'llm_output': return 'bg-purple-500/20 text-purple-300';
    default: return 'bg-gray-500/20 text-gray-300';
  }
};

export function DebugLogs({ logs, onClear }: DebugLogsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Debug Logs</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{logs.length} log(s) recorded</p>
          </div>
        </div>
        <span className={`text-2xl transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="p-6">
          {logs.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-12 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
              <div className="text-4xl mb-2">📭</div>
              <p>No logs yet. Run a simulation to see data flow.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={onClear}
                  className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded text-xs font-medium transition-colors"
                >
                  🗑️ Clear Logs
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.slice().reverse().map((log, idx) => (
                  <div key={idx} className={`rounded-lg p-3 border-l-4 ${getLogBgColor(log.type)} border border-slate-200 dark:border-slate-600`}>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getLogBadgeColor(log.type)}`}>
                          {log.type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{log.stage}</span>
                        {log.model && <span className="text-xs text-slate-600 dark:text-slate-500">• {log.model}</span>}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-900 dark:bg-black/60 rounded p-2 overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-words">{JSON.stringify(log.data, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
