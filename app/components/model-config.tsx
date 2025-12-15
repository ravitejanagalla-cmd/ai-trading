'use client';

import { useState } from 'react';

interface ModelConfig {
  name: string;
  basemodel: string;
  provider: string;
  signature: string;
  enabled: boolean;
}

interface DiscoveredModel {
  id: string;
  name: string;
  description: string;
  provider: string;
}

interface ModelConfigProps {
  models: ModelConfig[];
  discoveredModels: {
    gemini: DiscoveredModel[];
    lmstudio: DiscoveredModel[];
    ollama: DiscoveredModel[];
  };
  onToggleModel: (index: number) => void;
  onRemoveModel: (signature: string) => void;
  onAddModel: (provider: string, modelId: string, name: string, description: string) => void;
  onSaveConfig: () => void;
  onDiscoverModels: () => void;
}

export function ModelConfig({
  models,
  discoveredModels,
  onToggleModel,
  onRemoveModel,
  onAddModel,
  onSaveConfig,
  onDiscoverModels
}: ModelConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDiscovered, setShowDiscovered] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Model Configuration</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{models.length} model(s) configured</p>
          </div>
        </div>
        <span className={`text-2xl transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Current Models */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📦</span> Your Models
            </h3>
            {models.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-4">No models configured. Discover and add models below.</p>
            ) : (
              <div className="space-y-3">
                {models.map((model, index) => (
                  <div key={index} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-all">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <input
                           type="checkbox"
                           checked={model.enabled}
                           onChange={() => onToggleModel(index)}
                           className="w-5 h-5 rounded cursor-pointer"
                         />
                         <div className="flex-1">
                           <div className="text-slate-900 dark:text-white font-semibold text-sm">{model.name}</div>
                           <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                             {model.provider} • {model.basemodel}
                           </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          model.enabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                        }`}>
                          {model.enabled ? '✓ Active' : '○ Inactive'}
                        </span>
                        <button
                          onClick={() => onRemoveModel(model.signature)}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded text-xs font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Models Section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🔍</span> Discover & Add Models
              </h3>
              <button
                onClick={() => {
                  onDiscoverModels();
                  setShowDiscovered(!showDiscovered);
                }}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                {showDiscovered ? 'Hide' : 'Discover'}
              </button>
            </div>

            {showDiscovered && (
              <div className="space-y-4">
                {/* Gemini Models */}
                {discoveredModels.gemini.length > 0 && (
                  <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-4 border border-sky-200 dark:border-sky-700">
                    <div className="text-sm font-bold text-sky-700 dark:text-sky-300 mb-3">🤖 Google Gemini</div>
                    <div className="space-y-2">
                      {discoveredModels.gemini.map((model, idx) => (
                        <div key={idx} className="flex justify-between items-start bg-slate-100 dark:bg-slate-700/30 rounded p-3 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-900 dark:text-white font-medium">{model.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{model.description}</div>
                          </div>
                          <button
                            onClick={() => onAddModel(model.provider, model.id, model.name, model.description)}
                            className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded text-xs font-medium whitespace-nowrap transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* LM Studio Models */}
                {discoveredModels.lmstudio.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-700">
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-3">🎯 LM Studio</div>
                    <div className="space-y-2">
                      {discoveredModels.lmstudio.map((model, idx) => (
                        <div key={idx} className="flex justify-between items-start bg-slate-100 dark:bg-slate-700/30 rounded p-3 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-900 dark:text-white font-medium">{model.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{model.description}</div>
                          </div>
                          <button
                            onClick={() => onAddModel(model.provider, model.id, model.name, model.description)}
                            className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded text-xs font-medium whitespace-nowrap transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ollama Models */}
                {discoveredModels.ollama.length > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-3">🦙 Ollama</div>
                    <div className="space-y-2">
                      {discoveredModels.ollama.map((model, idx) => (
                        <div key={idx} className="flex justify-between items-start bg-slate-100 dark:bg-slate-700/30 rounded p-3 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-900 dark:text-white font-medium">{model.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{model.description}</div>
                          </div>
                          <button
                            onClick={() => onAddModel(model.provider, model.id, model.name, model.description)}
                            className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded text-xs font-medium whitespace-nowrap transition-colors"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {discoveredModels.gemini.length === 0 && discoveredModels.lmstudio.length === 0 && discoveredModels.ollama.length === 0 && (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-6">
                    No new models discovered. Ensure LM Studio and Ollama are running.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={onSaveConfig}
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>💾</span>
            <span>Save Configuration</span>
          </button>
        </div>
      )}
    </div>
  );
}
