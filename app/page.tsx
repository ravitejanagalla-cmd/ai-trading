'use client';

import { useState, useEffect } from 'react';

interface HealthStatus {
  timestamp: string;
  providers: {
    ollama?: { status: string; url?: string; models?: string[] };
    lmstudio?: { status: string; url?: string; models?: string[] };
    gemini?: { status: string; models?: string[] };
  };
}

interface ModelConfig {
  name: string;
  basemodel: string;
  provider: string;
  signature: string;
  enabled: boolean;
}

export default function DashboardPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [nifty50, setNifty50] = useState<string[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [showDiscovered, setShowDiscovered] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<any>({
    gemini: [],
    lmstudio: [],
    ollama: []
  });
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // Load health status on mount
  useEffect(() => {
    checkHealth();
    loadConfig();
    discoverModels();
  }, []);

  // Auto-refresh debug logs when shown
  useEffect(() => {
    if (showDebugLogs) {
      loadDebugLogs();
      const interval = setInterval(loadDebugLogs, 2000); // Refresh every 2s
      return () => clearInterval(interval);
    }
  }, [showDebugLogs]);

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/llm/health');
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config/models');
      const data = await response.json();
      if (data.success) {
        setModels(data.config.models || []);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const discoverModels = async () => {
    try {
      const response = await fetch('/api/llm/discover');
      const data = await response.json();
      setDiscoveredModels(data);
    } catch (error) {
      console.error('Failed to discover models:', error);
    }
  };

  const addModel = async (provider: string, modelId: string, name: string, description: string) => {
    try {
      const response = await fetch('/api/config/models/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, modelId, name, description })
      });

      const result = await response.json();
      if (result.success) {
        await loadConfig();
        alert(`Added ${name}!`);
      } else {
        alert(result.error || 'Failed to add model');
      }
    } catch (error) {
      console.error('Failed to add model:', error);
      alert('Failed to add model');
    }
  };

  const removeModel = async (signature: string) => {
    if (!confirm('Remove this model?')) return;

    try {
      const response = await fetch('/api/config/models/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature })
      });

      const result = await response.json();
      if (result.success) {
        await loadConfig();
        alert('Model removed');
      }
    } catch (error) {
      console.error('Failed to remove model:', error);
      alert('Failed to remove model');
    }
  };

  const loadDebugLogs = async () => {
    try {
      const response = await fetch('/api/debug/logs');
      const data = await response.json();
      if (data.success) {
        setDebugLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load debug logs:', error);
    }
  };

  const clearDebugLogs = async () => {
    try {
      await fetch('/api/debug/logs', { method: 'DELETE' });
      setDebugLogs([]);
      alert('Debug logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const toggleModel = (index: number) => {
    const updated = [...models];
    updated[index].enabled = !updated[index].enabled;
    setModels(updated);
  };

  const updateModelSelection = (provider: string, modelName: string) => {
    setSelectedModels(prev => ({ ...prev, [provider]: modelName }));
  };

  const saveConfig = async () => {
    try {
      const configResponse = await fetch('/api/config/models');
      const configData = await configResponse.json();

      if (configData.success) {
        configData.config.models = models;

        const response = await fetch('/api/config/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData.config)
        });

        const result = await response.json();
        if (result.success) {
          alert('Configuration saved!');
        }
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    }
  };

  const fetchNifty50 = async () => {
    try {
      const response = await fetch('/api/data/nifty50');
      const data = await response.json();

      if (data.success) {
        setNifty50(data.constituents);
        alert(`Fetched ${data.constituents.length} NIFTY 50 stocks`);
      }
    } catch (error) {
      console.error('Error fetching NIFTY 50:', error);
      alert('Failed to fetch NIFTY 50 data');
    }
  };

  const runSimulation = async () => {
    setIsRunning(true);

    try {
      const configResponse = await fetch('/api/config/models');
      const configData = await configResponse.json();

      const response = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData.config)
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
      } else {
        alert('Simulation failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error running simulation:', error);
      alert('Failed to run simulation');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'configured': return 'bg-blue-500';
      case 'offline': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                Autonomous Trading Platform
              </h1>
              <p className="text-gray-400 mt-2">AI-Powered Market Analysis & Trading Simulation</p>
            </div>

            <a
              href="/analyze"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center gap-2"
            >
              🔍 Stock Analysis
            </a>
          </div>
          <button
            onClick={checkHealth}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            🔄 Refresh Status
          </button>
        </div>

        {/* Health Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Gemini Status */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Google Gemini</h3>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(health?.providers.gemini?.status)}`} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Status: <span className="text-white">{getStatusText(health?.providers.gemini?.status)}</span></div>
              <div className="text-sm text-gray-400">Models: <span className="text-white">{health?.providers.gemini?.models?.length || 0}</span></div>
            </div>
          </div>

          {/* LM Studio Status */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">LM Studio</h3>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(health?.providers.lmstudio?.status)}`} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Status: <span className="text-white">{getStatusText(health?.providers.lmstudio?.status)}</span></div>
              <div className="text-sm text-gray-400">Models: <span className="text-white">{health?.providers.lmstudio?.models?.length || 0}</span></div>
              {health?.providers.lmstudio?.url && (
                <div className="text-xs text-gray-500">{health.providers.lmstudio.url}</div>
              )}
            </div>
          </div>

          {/* Ollama Status */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Ollama</h3>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(health?.providers.ollama?.status)}`} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Status: <span className="text-white">{getStatusText(health?.providers.ollama?.status)}</span></div>
              <div className="text-sm text-gray-400">Models: <span className="text-white">{health?.providers.ollama?.models?.length || 0}</span></div>
              {health?.providers.ollama?.url && (
                <div className="text-xs text-gray-500">{health.providers.ollama.url}</div>
              )}
            </div>
          </div>
        </div>

        {/* Model Configurator */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Model Configuration</h2>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              {showConfig ? 'Hide' : 'Configure Models'}
            </button>
          </div>

          {showConfig && (
            <div className="space-y-4">
              {/* Current Models */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Your Models</h3>
                {models.map((model, index) => (
                  <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10 mb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={model.enabled}
                          onChange={() => toggleModel(index)}
                          className="w-5 h-5 rounded"
                        />
                        <div>
                          <div className="text-white font-semibold">{model.name}</div>
                          <div className="text-sm text-gray-400">
                            {model.provider} • {model.basemodel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm ${model.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {model.enabled ? 'Enabled' : 'Disabled'}
                        </div>
                        <button
                          onClick={() => removeModel(model.signature)}
                          className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discovered Models */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-white">Add Models</h3>
                  <button
                    onClick={() => { discoverModels(); setShowDiscovered(!showDiscovered); }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                  >
                    {showDiscovered ? 'Hide' : '🔍 Discover'}
                  </button>
                </div>

                {showDiscovered && (
                  <div className="space-y-3">
                    {/* Gemini Models */}
                    {discoveredModels.gemini.length > 0 && (
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-sm font-semibold text-blue-400 mb-2">Google Gemini</div>
                        {discoveredModels.gemini.map((model: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 rounded p-2 mb-2">
                            <div>
                              <div className="text-white text-sm">{model.name}</div>
                              <div className="text-xs text-gray-400">{model.description}</div>
                            </div>
                            <button
                              onClick={() => addModel(model.provider, model.id, model.name, model.description)}
                              className="px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 text-sm"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* LM Studio Models */}
                    {discoveredModels.lmstudio.length > 0 && (
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-sm font-semibold text-purple-400 mb-2">LM Studio</div>
                        {discoveredModels.lmstudio.map((model: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 rounded p-2 mb-2">
                            <div>
                              <div className="text-white text-sm">{model.name}</div>
                              <div className="text-xs text-gray-400">{model.description}</div>
                            </div>
                            <button
                              onClick={() => addModel(model.provider, model.id, model.name, model.description)}
                              className="px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 text-sm"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ollama Models */}
                    {discoveredModels.ollama.length > 0 && (
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-sm font-semibold text-green-400 mb-2">Ollama</div>
                        {discoveredModels.ollama.map((model: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 rounded p-2 mb-2">
                            <div>
                              <div className="text-white text-sm">{model.name}</div>
                              <div className="text-xs text-gray-400">{model.description}</div>
                            </div>
                            <button
                              onClick={() => addModel(model.provider, model.id, model.name, model.description)}
                              className="px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 text-sm"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {discoveredModels.gemini.length === 0 && discoveredModels.lmstudio.length === 0 && discoveredModels.ollama.length === 0 && (
                      <div className="text-center text-gray-400 py-4">
                        No new models discovered. Make sure LM Studio and Ollama are running.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={saveConfig}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105"
              >
                💾 Save Configuration
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Initial Capital</div>
            <div className="text-3xl font-bold text-white">₹1,00,000</div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Universe</div>
            <div className="text-3xl font-bold text-blue-400">NIFTY 50</div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Models Active</div>
            <div className="text-3xl font-bold text-purple-400">
              {models.filter(m => m.enabled).length}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-gray-400 text-sm mb-1">Stocks Tracked</div>
            <div className="text-3xl font-bold text-green-400">
              {nifty50.length || 0}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={fetchNifty50}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
          >
            📊 Fetch NIFTY 50 Data
          </button>

          <button
            onClick={runSimulation}
            disabled={isRunning || models.filter(m => m.enabled).length === 0}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? '⏳ Running...' : '🚀 Run Simulation'}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Trading Results</h2>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-white">{result.model}</h3>
                      <p className="text-gray-400 text-sm">{result.signature}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${result.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                      {result.status}
                    </span>
                  </div>

                  {result.decision && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-300">
                        <strong>Summary:</strong> {result.decision.summary}
                      </div>
                      <div className="text-sm text-gray-300">
                        <strong>Orders Placed:</strong> {result.ordersPlaced || 0}
                      </div>
                      {result.decision.orders && result.decision.orders.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-sm font-semibold text-white">Orders:</div>
                          {result.decision.orders.map((order: any, idx: number) => (
                            <div key={idx} className="bg-white/5 rounded p-2 text-sm text-gray-300">
                              {order.action.toUpperCase()} {order.quantity} {order.symbol} @ ₹{order.price.toFixed(2)}
                              <div className="text-xs text-gray-500 mt-1">{order.rationale}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {result.portfolio && (
                        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-gray-500">Cash</div>
                            <div className="text-white font-semibold">₹{result.portfolio.cash.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Total Value</div>
                            <div className="text-white font-semibold">₹{result.portfolio.totalValue.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Return</div>
                            <div className={`font-semibold ${parseFloat(result.portfolio.totalReturn) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {result.portfolio.totalReturn}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {result.error && (
                    <div className="text-sm text-red-400">Error: {result.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug Logs Viewer */}
        <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Debug Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDebugLogs(!showDebugLogs)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {showDebugLogs ? 'Hide Logs' : '🔍 Show Logs'}
              </button>
              {showDebugLogs && (
                <button
                  onClick={clearDebugLogs}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>

          {showDebugLogs && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {debugLogs.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  No debug logs yet. Run a simulation to see data flow.
                </div>
              )}

              {debugLogs.slice().reverse().map((log, idx) => (
                <div key={idx} className={`bg-white/5 rounded-lg p-3 border-l-4 ${log.type === 'data_fetch' ? 'border-blue-500' :
                  log.type === 'market_data' ? 'border-green-500' :
                    log.type === 'llm_input' ? 'border-yellow-500' :
                      log.type === 'llm_output' ? 'border-purple-500' :
                        'border-gray-500'
                  }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${log.type === 'data_fetch' ? 'bg-blue-500/20 text-blue-400' :
                        log.type === 'market_data' ? 'bg-green-500/20 text-green-400' :
                          log.type === 'llm_input' ? 'bg-yellow-500/20 text-yellow-400' :
                            log.type === 'llm_output' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-gray-500/20 text-gray-400'
                        }`}>
                        {log.type}
                      </span>
                      <span className="text-sm text-gray-400">{log.stage}</span>
                      {log.model && <span className="text-xs text-gray-500">• {log.model}</span>}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-sm text-gray-300 font-mono bg-black/30 rounded p-2 overflow-x-auto">
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
