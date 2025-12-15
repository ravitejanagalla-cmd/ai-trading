'use client';

import { useState, useEffect } from 'react';
import { Header } from './components/header';
import { ProviderStatus } from './components/provider-status';
import { StatsOverview } from './components/stats-overview';
import { ModelConfig } from './components/model-config';
import { ActionButtons } from './components/action-buttons';
import { TradingResults } from './components/trading-results';
import { DebugLogs } from './components/debug-logs';

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

interface DebugLog {
  type: string;
  stage: string;
  timestamp: string;
  model?: string;
  data: any;
}

export default function DashboardPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [nifty50, setNifty50] = useState<string[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [discoveredModels, setDiscoveredModels] = useState<any>({
    gemini: [],
    lmstudio: [],
    ollama: []
  });
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);

  // Load health status on mount
  useEffect(() => {
    checkHealth();
    loadConfig();
    discoverModels();
  }, []);

  // Auto-refresh debug logs periodically
  useEffect(() => {
    const interval = setInterval(loadDebugLogs, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const activeModelsCount = models.filter(m => m.enabled).length;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Header onRefreshStatus={checkHealth} activeModelsCount={activeModelsCount} />
      
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Provider Status */}
        {health && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🌐</span> Provider Status
            </h2>
            <ProviderStatus providers={health.providers} />
          </div>
        )}

        {/* Stats Overview */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📈</span> Portfolio Overview
          </h2>
          <StatsOverview 
            initialCapital={100000}
            universe="NIFTY 50"
            activeModels={activeModelsCount}
            stocksTracked={nifty50.length}
          />
        </div>

        {/* Model Configuration */}
        <ModelConfig
          models={models}
          discoveredModels={discoveredModels}
          onToggleModel={toggleModel}
          onRemoveModel={removeModel}
          onAddModel={addModel}
          onSaveConfig={saveConfig}
          onDiscoverModels={discoverModels}
        />

        {/* Action Buttons */}
        <ActionButtons 
          onFetchData={fetchNifty50}
          onRunSimulation={runSimulation}
          isRunning={isRunning}
          hasActiveModels={activeModelsCount > 0}
        />

        {/* Trading Results */}
        <TradingResults results={results} />

        {/* Debug Logs */}
        <DebugLogs logs={debugLogs} onClear={clearDebugLogs} />
      </div>
    </div>
  );
}
