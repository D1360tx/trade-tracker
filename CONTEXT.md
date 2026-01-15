# Trade Tracker Pro - Project Context

> This document provides context for AI assistants and developers working on this codebase.

## Project Overview

**Trade Tracker Pro** is a comprehensive trading journal and analytics platform built for active traders. It supports multiple asset classes (stocks, options, crypto, forex, futures) and multiple exchanges/brokers.

**Live Production URL**: https://trade-tracker-eight.vercel.app

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Vercel Serverless Functions (`/api`) |
| AI Integration | OpenAI GPT-4 |
| OAuth | Charles Schwab API |
| Storage | Browser LocalStorage (client-side) |

## Architecture

### Directory Structure

```
trade_tracker/
├── api/                    # Vercel serverless functions
│   ├── schwab/            # Schwab OAuth endpoints
│   ├── mexc-futures.ts    # MEXC Futures API proxy
│   └── mexc-spot.ts       # MEXC Spot API proxy
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── charts/       # Chart components (Recharts)
│   │   ├── Layout.tsx    # Main app layout with navigation
│   │   └── ...           # Modals, filters, stat cards
│   ├── context/          # React Context providers
│   ├── pages/            # Main application pages
│   ├── utils/            # Utilities and services
│   │   ├── csvParsers.ts         # Multi-exchange CSV parsing
│   │   ├── tradeLockerParser.ts  # HeroFX/TradeLocker paste parser
│   │   ├── schwabAuth.ts         # Schwab OAuth flow
│   │   ├── apiClient.ts          # API client utilities
│   │   └── aiService.ts          # OpenAI integration
│   └── types.ts          # TypeScript interfaces
├── .agent/workflows/     # AI agent workflow definitions
└── vercel.json           # Vercel deployment config
```

### Core Data Model

```typescript
// Main Trade interface (src/types.ts)
interface Trade {
    id: string;
    exchange: ExchangeName;  // 'MEXC' | 'ByBit' | 'Schwab' | 'HeroFX' | etc.
    ticker: string;
    type: 'STOCK' | 'OPTION' | 'CRYPTO' | 'FOREX' | 'FUTURES' | 'SPOT';
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    entryDate: string;       // ISO date string
    exitDate: string;
    status: 'OPEN' | 'CLOSED';
    pnl: number;
    pnlPercentage: number;
    fees: number;
    notes?: string;
    strategyId?: string;
    mistakes?: string[];
    leverage?: number;
    isBot?: boolean;
    externalOid?: string;    // Exchange order ID for deduplication
}
```

## Supported Exchanges & Import Methods

| Exchange | Import Method | Parser Location |
|----------|--------------|-----------------|
| **Schwab** | OAuth API or CSV | `schwabAuth.ts`, `csvParsers.ts` |
| **HeroFX/TradeLocker** | Quick Paste (tab-separated) | `tradeLockerParser.ts` |
| **MEXC** | API (via proxy) | `api/mexc-*.ts`, `csvParsers.ts` |
| **Interactive Brokers** | CSV | `csvParsers.ts` |
| **Binance** | CSV | `csvParsers.ts` |
| **ByBit** | CSV | `csvParsers.ts` |
| **BloFin** | CSV | `csvParsers.ts` |

## Key Features by Page

| Page | File | Description |
|------|------|-------------|
| **Dashboard** | `Dashboard.tsx` | KPIs, equity curve, win/loss charts |
| **Journal** | `Journal.tsx` | Trade log with inline editing, images |
| **Analytics** | `Analytics.tsx` | Advanced charts, performance metrics |
| **Calendar** | `Calendar.tsx` | Daily P&L heatmap with drill-down modal |
| **Import** | `ImportPage.tsx` | Multi-source trade import |
| **Reports** | `ReportsPage.tsx` | Detailed reporting |
| **AI Insights** | `AIInsights.tsx` | GPT-4 powered analysis |
| **Playbook** | `PlaybookPage.tsx` | Strategy documentation |
| **Bot Dashboard** | `BotDashboard.tsx` | Automated trade tracking |
| **Settings** | `SettingsPage.tsx` | App configuration |

## Important Design Decisions

### 1. Hybrid Storage (Local + Supabase)
Trade data is stored in **Supabase (PostgreSQL)** for persistence and sync across devices.
A local cache is maintained for performance and offline capability.

- **Supabase**: Primary source of truth.
- **LocalStorage**: Caching and fallback API credentials.

### 2. API Proxies for CORS
MEXC API calls go through Vercel serverless functions (`/api/mexc-*`) to avoid CORS issues and protect API secrets.

### 3. TradeLocker Parser Specifics
The HeroFX/TradeLocker parser (`tradeLockerParser.ts`) handles:
- Multi-line paste format (instrument on separate line)
- 100x leverage calculations
- Contract size multipliers:
  - XAGUSD: 5,000 oz per lot
  - XAUUSD: 100 oz per lot

### 4. Duplicate Detection (Advanced)
A sophisticated multi-layer deduplication system prevents duplicate trades from API syncs and CSV imports:
- **Exact Match**: Hash of all trade fields.
- **External OID**: Matches exchange-provided IDs (e.g. Schwab Activity ID).
- **Fuzzy Match**: Matches Normalized Ticker + Date + Quantity (ignores P&L micro-differences).
- **Manual Fallback**: Robust handling of Map lookup failures.

## Environment Variables

```bash
# Required for AI features
VITE_OPENAI_API_KEY=sk-...

# Required for Schwab integration
SCHWAB_CLIENT_ID=...
SCHWAB_CLIENT_SECRET=...
SCHWAB_CALLBACK_URL=http://localhost:5173/schwab/callback

# Optional for MEXC
MEXC_API_KEY=...
MEXC_SECRET_KEY=...
```

## Development Commands

```bash
# Development server (Vite)
npm run dev

# Development with Vercel APIs (required for Schwab OAuth)
vercel dev

# Production build
npm run build

# Type checking
npm run tsc

# Linting
npm run lint
```

## Active Issues & Work In Progress

> For detailed debugging notes, research findings, and attempted solutions, see **[WORKLOG.md](./WORKLOG.md)**

### ✅ Recently Resolved

| Issue | Resolution Date | Summary |
|-------|-----------------|---------|
| **MEXC Futures & Spot API** | Jan 9, 2026 | Vercel URL rewrite was adding `path` parameter, breaking signatures. Fixed by explicitly removing it. |
| **Schwab OAuth Integration** | Jan 9, 2026 | Full 90-day sync with auto-refresh, scheduled daily syncs. |
| **Schwab Duplicate Fix** | Jan 15, 2026 | Fixed "impossible" fuzzy match failure and prevented API sync from inserting duplicates of CSV trades. |
| **Schwab $0 P&L Fix** | Jan 15, 2026 | Resolved issue where API aggregated trades with $0 P&L were overriding correct CSV data. |

### ✅ Recently Completed

| Feature | Date | Summary |
|---------|------|------------|
| Schwab CSV Import | Jan 2026 | Realized Gain/Loss parsing, Put direction fix |
| P&L Calendar Modal | Jan 2026 | Daily performance summary with trade breakdown |
| Duplicate Detection | Jan 2026 | Content-based deduplication for all CSV imports |

## General Gotchas

1. **Schwab OAuth**: Requires `vercel dev` for local testing (serverless functions)
2. **LocalStorage Limits**: ~5-10MB max; export data before clearing browser
3. **TradeLocker Parsing**: Multi-line format requires special handling

## Contributing

See `CONTRIBUTING.md` for guidelines.

---

*Last updated: January 2026*
