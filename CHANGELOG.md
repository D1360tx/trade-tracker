# Changelog

All notable changes to Trade Tracker will be documented in this file.

## [v1.2.0-stable] - 2026-01-12

### 🎉 Major Features

#### Dynamic Table with Drag-and-Drop Columns
- **Draggable columns**: Reorder any column in the Journal table by dragging the header
- **Persistent layout**: Column order is saved to localStorage and restored on reload
- **Reset to default**: One-click button to restore the optimized default column layout
- **Dynamic rendering**: Table cells intelligently render based on column type and data

#### Enhanced MEXC Integration
- **Improved symbol scanning**: Now scans historical trading pairs even if current balance is zero
- **Missing sells fixed**: Resolves issue where sold positions weren't being closed (showing $0 P&L)
- **Correct type labels**: Open positions now show accurate type (FUTURES vs CRYPTO vs SPOT)
- **Margin calculations**: Properly calculates and displays margin and notional values for open positions

#### Hardened Data Rendering
- **Safety checks**: All numeric columns (P&L, prices, quantity) now have fallback values
- **Crash prevention**: Undefined or null values no longer cause blank cells or rendering errors
- **Better formatting**: Quantity displays with appropriate decimals based on asset type (stocks, crypto, forex)

### 🔧 Improvements

#### Reports Page
- **Auto-switching date filters**: Manually entering dates now automatically switches to "Custom" range
- **Responsive filtering**: Date range changes immediately reflect in charts and KPIs

#### Trade Context
- **Smart merging**: Update logic now detects changes in type, margin, and other critical fields
- **Variable shadowing fix**: Resolved closure issues that prevented proper state access

### 🐛 Bug Fixes

- Fixed table rendering crashes from missing trade data
- Fixed MEXC type labels incorrectly showing "CRYPTO" for Futures trades
- Fixed margin/notional values being undefined for open positions
- Fixed merge logic not updating trades when only type or margin changed
- Fixed Reports page date inputs being ignored when timeRange wasn't set to 'custom'
- Fixed quantity display showing 0 decimals for fractional shares

### 📦 Technical Changes

**New Components:**
- `src/components/TableRenderers.tsx` - Centralized table header and cell rendering logic

**Updated Files:**
- `src/pages/Journal.tsx` - Refactored to use dynamic column system
- `src/hooks/useColumnOrder.ts` - Enhanced with new default column order
- `src/utils/apiClient.ts` - Added `knownSymbols` parameter to spot history fetcher
- `src/context/TradeContext.tsx` - Improved aggregation and merge logic
- `src/pages/ReportsPage.tsx` - Fixed date filter state management

### ⚡ Performance

- Build size: ~1.16 MB (gzip: 338 KB)
- No new dependencies added
- All existing functionality maintained

### 🧪 Testing

- ✅ Build: Successful (`npm run build`)
- ✅ TypeScript: No errors
- ✅ Linting: Clean
- ✅ Manual testing: All features verified

---

## Previous Versions

### [v1.1.x] - Earlier
- Trade Detail Modal with keyboard navigation
- Enhanced filtering and search
- Multiple exchange integrations (MEXC, ByBit, Schwab)

### [v1.0.x] - Initial Release
- Core trade tracking functionality
- Basic analytics and reporting
- CSV import/export
