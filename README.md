# Autonomous Indian Stock Trading Agent

A Next.js-based autonomous paper-trading system for Indian equities (NSE/BSE) powered by AI models including Google Gemini, Ollama, and LM Studio.

## 🎯 Features

- **AI-Driven Trading**: Multiple AI models compete autonomously (Gemini, Ollama local models, LM Studio)
- **Web Scraping**: Puppeteer stealth scraping for NSE/BSE data (100% free)
- **Google Search Grounding**: Gemini's built-in search for market news and information
- **Historical Replay**: Anti-look-ahead controls for backtesting
- **Indian Market Rules**: T+2 settlement, circuit breakers, trading hours (09:15-15:30 IST)
- **Modern Dashboard**: Real-time portfolio tracking with glassmorphism UI
- **Zero Paid APIs**: Uses only free data sources

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Gemini API key ([Get it free](https://makersuite.google.com/app/apikey))
- (Optional) Ollama installed locally
- (Optional) LM Studio installed locally

### Installation

1. **Clone and install dependencies**:
```bash
cd autonomous-trading
npm install
```

2. **Set up environment**:
```bash
# Copy the environment template
cat > .env.local << 'EOF'
GEMINI_API_KEY=your_gemini_api_key_here

# Optional - for local models
OLLAMA_BASE_URL=http://localhost:11434
LMSTUDIO_BASE_URL=http://localhost:1234/v1

# Scraper settings
SCRAPER_HEADLESS=true
SCRAPER_TIMEOUT=30000
SCRAPER_MAX_RETRIES=3

# Indian Market Settings
INITIAL_CAPITAL=100000
DEFAULT_UNIVERSE=NIFTY50
MARKET_TIMEZONE=Asia/Kolkata

# Data storage
DATA_PATH=./data
LOGS_PATH=./data/logs
EOF
```

3. **Add your Gemini API key** to `.env.local`

4. **Run the development server**:
```bash
npm run dev
```

5. **Open** [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
autonomous-trading/
├── app/
│   ├── api/
│   │   ├── data/
│   │   │   ├── nifty50/route.ts      # NIFTY 50 data API
│   │   │   └── quote/route.ts        # Stock quote API
│   │   ├── simulation/
│   │   │   └── run/route.ts          # Simulation runner
│   │   └── tools/
│   │       └── search/route.ts       # Gemini grounding search
│   └── page.tsx                       # Dashboard UI
├── lib/
│   ├── agents/
│   │   ├── trading-agent.ts          # Main trading agent
│   │   ├── portfolio-manager.ts      # Portfolio & P&L tracking
│   │   └── prompt.ts                 # System prompts
│   ├── llm/
│   │   ├── gemini-provider.ts        # Gemini integration
│   │   ├── ollama-provider.ts        # Ollama integration
│   │   ├── lmstudio-provider.ts      # LM Studio integration
│   │   └── index.ts                  # Multi-model manager
│   ├── scrapers/
│   │   ├── nse-scraper.ts            # NSE web scraper
│   │   └── utils.ts                  # Puppeteer utilities
│   └── types/
│       └── index.ts                  # TypeScript definitions
└── ENV_SETUP.md                       # Environment setup guide
```

## 🎮 Usage

### 1. Fetch NIFTY 50 Data

Click "Fetch NIFTY 50 Data" on the dashboard to scrape the latest NIFTY 50 constituents from NSE.

### 2. Run Simulation

Click "Run Simulation" to start an autonomous trading session. The system will:
- Initialize AI models (Gemini + optional local models)
- Fetch market data for NIFTY 50 stocks
- Generate trading decisions using AI
- Execute simulated trades with proper risk controls
- Log all trades to `./data/logs/`

### 3. Monitor Results

View simulation results, portfolio changes, and trading decisions in real-time on the dashboard.

## 🤖 Supported AI Models

### Google Gemini (Default)
- Uses Gemini 2.0 Flash with Google Search grounding
- Best for market research and news analysis
- Free tier available

### Ollama (Local)
- Run models like Llama 3.1, Qwen 2.5, Deepseek locally
- Install: [ollama.ai](https://ollama.ai)
- Pull model: `ollama pull llama3.1:70b`

### LM Studio (Local)  
- OpenAI-compatible API for local models
- Download: [lmstudio.ai](https://lmstudio.ai)

## 🛠️ Configuration

Edit config in the simulation runner or create a config file:

```typescript
{
  models: [
    {
      name: 'gemini-2.0-flash',
      provider: 'gemini',
      enabled: true
    },
    {
      name: 'llama3.1:70b',
      provider: 'ollama',
      enabled: true  // Set to true if Ollama is running
    }
  ],
  agentConfig: {
    initialCash: 100000,           // ₹1,00,000
    maxPositionPct: 0.05,          // Max 5% per stock
    maxTotalExposurePct: 0.50,     // Max 50% invested
    minCashReservePct: 0.05,       // Keep 5% cash
    maxDailyTrades: 20
  }
}
```

## 📊 Indian Market Rules

The system implements complete Indian market compliance:

- **Trading Hours**: 09:15 - 15:30 IST (Monday-Friday)
- **Settlement**: T+2 cycle
- **Lot Size**: 1 share for most equities
- **Circuit Breakers**: ±10% or ±20% limits
- **Tick Size**: ₹0.05 for most stocks
- **Currency**: INR (₹)

## 🔌 API Endpoints

### Data APIs

```bash
# Get NIFTY 50 constituents
GET /api/data/nifty50

# Get stock quote
GET /api/data/quote?symbol=TCS

# Batch fetch quotes
POST /api/data/nifty50
Body: { "symbols": ["TCS", "RELIANCE", "INFY"] }
```

### Tools APIs

```bash
# Search market info (Gemini grounding)
POST /api/tools/search
Body: { "query": "TCS news", "maxResults": 5 }
```

### Simulation API

```bash
# Run simulation
POST /api/simulation/run
Body: <TradingConfig>
```

## 🧪 Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check
```

## ⚠️ Important Notes

1. **Web Scraping**: NSE/BSE scrapers may break if website structure changes
2. **Rate Limiting**: Implement delays between requests to avoid blocking
3. **Paper Trading Only**: This system does NOT execute real trades
4. **Local Models**: Require significant RAM (16GB+ for 70B models)

## 📝 License

MIT

## 🙏 Acknowledgments

- Inspired by RockAlpha and AI-Trader projects
- Built with Next.js, Puppeteer, and Google Gemini
- Indian market data from NSE/BSE websites
