# Trade Tracker Pro

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple.svg)](https://vitejs.dev/)
[![Version](https://img.shields.io/badge/Version-1.5.0--stable-green.svg)](CHANGELOG.md)

## 🌐 Live Demo

**Production**: [https://trade-tracker-eight.vercel.app](https://trade-tracker-eight.vercel.app)

## 📰 Latest Release - v1.5.0-stable (2026-01-16)

### Critical Fixes
✅ **Schwab P&L Precision Fixed** - Now matches official Schwab reports exactly (resolved $42.71 discrepancy)
✅ **Orphaned Trades Fixed** - Extended sync window to 180 days, no more missing closing transactions
✅ **Duplicate Prevention** - API and CSV imports now use matching symbol formats for proper deduplication
✅ **Calendar Navigation** - Added "Current Week/Month" buttons to quickly return to today

See [CHANGELOG.md](CHANGELOG.md) for full details.

A comprehensive trading journal and analytics platform with AI-powered insights, supporting multiple exchanges including Schwab, HeroFX/TradeLocker, and more.

## 🚀 Features

### Import & Data Management
- **Quick Paste Import**: Direct paste support for TradeLocker/HeroFX multi-line format
- **CSV Import**: Support for Schwab, MEXC, and other exchanges
- **Schwab API Integration**: OAuth-based direct data import
- **Trade Management**: Edit, delete, and manage trades with inline editing

### Analytics & Visualization
- **Performance Dashboard**: Real-time P&L, win rate, and profit factor
- **Equity Curve**: Visual representation of account growth
- **Calendar View**: Daily performance heatmap with detailed breakdowns
- **Advanced Charts**:
  - Monthly performance analysis
  - Symbol performance comparison
  - Win/Loss distribution
  - Drawdown analysis
  - Hold time scatter plots
  - Streak analysis

### AI-Powered Insights
- **AI Coach**: Personalized recommendations across 4 categories (Psychology, Risk, Strategy, Timing)
- **Pattern Recognition**: Identify trading patterns and behavioral issues
- **Strategy Analysis**: AI-generated insights on trade performance
- **Risk/Reward Analysis**: Track average win vs loss ratios
- **Overtrading Detection**: Alerts when trading frequency impacts performance
- **Mistake Tracking**: Learn from past errors with categorization
- **Playbook**: Document and refine trading strategies

### Trading Tools
- **Trade Journal**: Detailed trade logs with images and notes
- **Strategy Manager**: Organize trades by strategy
- **Risk Analysis**: Track position sizing and risk metrics
- **Bot Dashboard**: Monitor automated trading performance
- **Expired Options Tracking**: Auto-detect and record worthless expirations (Schwab)
- **Time Filters**: Flexible date ranges (Today, This Week, Last Year, All Time, etc.)

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Backend**: Vercel Serverless Functions
- **APIs**: Schwab API, OpenAI GPT-4
- **Storage**: LocalStorage (client-side)

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/trade-tracker.git

# Navigate to project directory
cd trade-tracker

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add your API keys to .env
VITE_OPENAI_API_KEY=your_openai_key
SCHWAB_CLIENT_ID=your_schwab_client_id
SCHWAB_CLIENT_SECRET=your_schwab_client_secret
SCHWAB_CALLBACK_URL=http://localhost:5173/schwab/callback

# Start development server
npm run dev
```

## 🔧 Configuration

### Schwab API Setup
1. Register at [Schwab Developer Portal](https://developer.schwab.com)
2. Create an app and get your Client ID and Secret
3. Add callback URL: `http://localhost:5173/schwab/callback`
4. Update `.env` with your credentials

### OpenAI API
1. Get API key from [OpenAI Platform](https://platform.openai.com)
2. Add to `.env` as `VITE_OPENAI_API_KEY`

## 📖 Usage

### Quick Paste Import (TradeLocker/HeroFX)
1. Go to **Import** page
2. Copy trades from TradeLocker (select rows and Ctrl+C)
3. Paste into the "Quick Paste Import" textarea
4. Click **Import Pasted Data**
5. Trades will be parsed with correct P&L and ROI

### CSV Import
1. Go to **Import** page
2. Select exchange from dropdown
3. Upload CSV file
4. Data will be automatically parsed and imported

### Schwab API Import
1. Go to **Import** page
2. Click **Connect to Schwab**
3. Authorize the app
4. Import trades from your account

## 🎯 Key Features Explained

### TradeLocker/HeroFX Parser
- Handles multi-line paste format (instrument on separate line)
- Automatically merges broken rows with multi-line SL/TP values
- Calculates ROI with 100x leverage and proper contract sizes:
  - XAGUSD: 5,000 oz per lot
  - XAUUSD: 100 oz per lot
- Prevents column misalignment with smart tab handling

### Trade Management
- **Inline Editing**: Click edit icon to modify trades
- **Bulk Operations**: Select multiple trades for deletion
- **Filtering**: Filter by exchange, symbol, date range
- **Sorting**: Sort by any column

### Analytics
- **Real-time Calculations**: All metrics update instantly
- **Time Range Filters**: Daily, Weekly, Monthly, YTD, All Time
- **Exchange Filtering**: Analyze performance per exchange
- **Strategy Breakdown**: Compare different trading strategies

## 🚢 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Build for Production
```bash
npm run build
```

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 🐛 Known Issues

- LocalStorage has size limits (~5-10MB)
- Large trade histories may impact performance
- Schwab API rate limits apply

## 🔮 Roadmap

- [ ] Database integration (MongoDB/PostgreSQL)
- [ ] Multi-user support
- [ ] Mobile app (React Native)
- [ ] Real-time trade alerts
- [ ] Advanced backtesting
- [ ] Social trading features
- [ ] More exchange integrations

## 📞 Support

For issues and questions, please open a GitHub issue or contact support@example.com.

---

**Built with ❤️ for traders by traders**
