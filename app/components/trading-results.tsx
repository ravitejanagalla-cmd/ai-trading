interface Order {
  action: string;
  quantity: number;
  symbol: string;
  price: number;
  rationale: string;
}

interface Portfolio {
  cash: number;
  totalValue: number;
  totalReturn: string;
}

interface Result {
  model: string;
  signature: string;
  status: string;
  decision?: {
    summary: string;
    orders: Order[];
  };
  portfolio?: Portfolio;
  ordersPlaced?: number;
  error?: string;
}

interface TradingResultsProps {
  results: Result[];
}

export function TradingResults({ results }: TradingResultsProps) {
  if (results.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-elevated">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
        <span className="text-3xl">📊</span> Trading Results
      </h2>
      <div className="space-y-4">
        {results.map((result, index) => (
          <div key={index} className={`bg-slate-50 dark:bg-slate-700/50 rounded-lg p-5 border-l-4 ${
            result.status === 'success' ? 'border-emerald-500 dark:border-emerald-400' : 'border-red-500 dark:border-red-400'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{result.model}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{result.signature}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                result.status === 'success' 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}>
                {result.status.toUpperCase()}
              </span>
            </div>

            {result.decision && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/30 rounded p-3 border border-slate-200 dark:border-slate-600">
                    <strong className="text-slate-900 dark:text-white">Strategy:</strong> {result.decision.summary}
                  </p>
                </div>

                {result.decision.orders && result.decision.orders.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Orders ({result.ordersPlaced || 0})</div>
                    <div className="space-y-2">
                      {result.decision.orders.map((order, idx) => (
                        <div key={idx} className="bg-slate-100 dark:bg-slate-700/30 rounded p-3 border border-slate-200 dark:border-slate-600">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold px-2 py-1 rounded ${
                              order.action === 'buy' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                              order.action === 'sell' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                              'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                            }`}>
                              {order.action.toUpperCase()} {order.quantity} {order.symbol}
                            </span>
                            <span className="text-sm text-slate-600 dark:text-slate-400">₹{order.price.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 italic">{order.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.portfolio && (
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Cash Available</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">₹{result.portfolio.cash.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Portfolio Value</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">₹{result.portfolio.totalValue.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Return</div>
                      <div className={`text-lg font-bold ${
                        parseFloat(result.portfolio.totalReturn) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {result.portfolio.totalReturn}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.error && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300">
                <strong>Error:</strong> {result.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
