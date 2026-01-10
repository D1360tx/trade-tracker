# Changelog

All notable changes to Trade Tracker Pro will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### ✅ Completed - Schwab Integration

#### Schwab API OAuth & Auto-Sync
- **Added**: Automated Schwab trade sync (90-day history)
- **Added**: Scheduled auto-sync: Daily at 3:30 PM CST + Monday at 8:31 AM CST
- **Added**: OAuth 2.0 authentication flow for Schwab API
- **Added**: Proper token refresh handling

#### Files Changed
- `src/utils/schwabAuth.ts` - OAuth implementation
- `src/components/AutoSync.tsx` - Scheduling logic
- `api/schwab/` - OAuth callback endpoints

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
