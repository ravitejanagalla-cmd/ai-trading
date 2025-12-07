# Environment Configuration

Copy this file to `.env.local` and fill in your values:

```bash
# Google Gemini API
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
```

## Setup Instructions

1. Copy this template: `cp ENV_SETUP.md .env.local`
2. Edit `.env.local` and add your Gemini API key
3. Adjust other settings as needed
