# Changelog

All notable changes to Trade Tracker Pro will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-01-09

### 🎉 Major Fixes - Schwab Data Accuracy

#### Schwab P&L Calculation Fixed
- **FIXED**: P&L discrepancies between CSV imports and API imports
- **Issue**: Trades showed incorrect P&L (e.g., $940 instead of $937.35)
- **Root Cause**: Fees were not being subtracted from gross P&L
- **Solution**: 
  - CSV imports: Set fees to $0 (Schwab already includes fees in reported P&L)
  - API imports: Calculate Net P&L = Gross P&L - Total Fees
- **Impact**: Both import methods now show identical, accurate P&L matching Schwab's reports

#### Schwab CSV Import Enhancement
- **ADDED**: Support for "Realized Gain/Loss - Lot Details" CSV format
- **FEATURE**: Now reads both "Opened Date" and "Closed Date" columns
- **BENEFIT**: Accurate entry and exit dates for each trade (previously used same date for both)
- **Auto-Detection**: Parser automatically detects if using Summary or Details format

#### Schwab API Data Window Extended
- **CHANGED**: Extended API fetch window from 90 → 180 days
- **BENEFIT**: Reduces "orphaned" trades from FIFO matching
- **IMPACT**: Better captures longer-held positions without missing opening transactions

### 🚀 New Features

#### Aggressive Auto-Sync for Day Traders
- **ADDED**: Hourly automatic syncing during market hours
- **Schedule**:
  - Market Hours: Every hour 9 AM - 3 PM CST (Mon-Fri)
  - After Close: 3:30 PM daily
  - Weekend Catchup: Monday 8:31 AM
- **Total**: ~9-10 syncs/day (well within API limits)
- **Benefit**: Near real-time P&L tracking for active traders

### 🎨 UI Improvements

#### Calendar Date Picker Icon Fix
- **FIXED**: Calendar icon not visible in dark mode (was black on dark background)
- **Solution**: Added `colorScheme: 'dark'` to date inputs
- **Impact**: Calendar icon now white and clearly visible

### 📁 Files Changed (v1.2.0)
- `src/utils/csvParsers.ts` - "Opened Date" support, fixed fees
- `src/utils/schwabTransactions.ts` - Net P&L calculation fix
- `src/context/TradeContext.tsx` - 180-day window, hourly sync
- `src/components/TimeRangeFilter.tsx` - Calendar icon visibility

---

## [1.1.0] - 2026-01-09

### 🎉 Fixed - MEXC API Integration

#### Critical Production Bug Fix
- **FIXED**: MEXC Futures and Spot API signature validation errors in production
- **Root Cause**: Vercel's URL rewrite system was adding an extra `path` query parameter in production (but not in `vercel dev`), which invalidated our API signatures  
- **Solution**: Explicitly remove the `path` parameter from query strings before forwarding to MEXC
- **Impact**: MEXC API now works reliably in production for both Futures and Spot markets

#### Files Changed
- `api/mexc-futures.ts` - Added query parameter cleanup
- `api/mexc-spot.ts` - Added query parameter cleanup

#### Technical Details
```typescript
// Before: Query string corruption
// Client: /api/mexc-spot/api/v3/account?timestamp=123&signature=abc
// Vercel: /api/mexc-spot?timestamp=123&signature=abc&path=api%2Fv3%2Faccount
//         ^^^ Extra parameter broke signature!

// After: Clean query string
reqUrl.searchParams.delete('path'); // Remove Vercel's added parameter
```

---

## [1.0.0] - 2025-12-25

### Added - Initial Release

#### Core Features
- 📊 **Multi-Exchange Support**: Schwab, MEXC, ByBit, Interactive Brokers, Binance, BloFin, HeroFX/TradeLocker
- 📈 **Analytics Dashboard**: Equity curve, win rate, profit factor, Sharpe ratio
- 📅 **P&L Calendar**: Daily performance heatmap with detailed modal
- 🤖 **AI Insights**: GPT-4 powered trade analysis
- 📖 **Trading Playbook**: Strategy documentation
- 📁 **CSV Import**: Universal CSV parser with duplicate detection
- ⚡ **Quick Paste**: HeroFX/TradeLocker tab-separated data import

#### Import Methods
- **API Integration**: MEXC Futures, MEXC Spot, Schwab (OAuth)
- **CSV Upload**: All major exchanges
- **Quick Paste**: TradeLocker format

#### Technical Stack
- React 18 + TypeScript
- Vite 6 build system
- Tailwind CSS styling
- Vercel serverless functions
- LocalStorage for data persistence

---

## [Unreleased]

### Planned
- [ ] Additional exchange integrations
- [ ] Export functionality (PDF reports)
- [ ] Strategy backtesting
- [ ] Mobile app (React Native)

---

**Legend:**
- 🎉 Fixed - Bug fixes
- ✅ Completed - New features
- 🚀 Added - Additions
- 🔧 Changed - Changes
- 🗑️ Removed - Removals
- ⚠️ Deprecated - Soon-to-be removed features
