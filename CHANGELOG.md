# Changelog

All notable changes to Trade Tracker will be documented in this file.

## [v1.4.0-stable] - 2026-01-15

### 🚀 Scheduled Auto-Sync

#### Vercel Cron Jobs
- **Daily automatic sync**: Trades sync at 3:30 PM EST (market close) every weekday
- **Server-side execution**: Runs for ALL users with configured credentials
- **Protected endpoint**: Secured with `CRON_SECRET` environment variable
- **Comprehensive logging**: Full sync summary with per-user results

#### Sync Endpoint (`/api/schwab/syncusers`)
- Fetches all users from Supabase
- Syncs Schwab trades (OAuth tokens)
- Syncs MEXC trades (Futures + Spot)
- Upserts to database with deduplication
- Detailed error handling per exchange

### 🔄 Global Sync Button

- **Moved to header**: Sync button now appears in the top navigation bar
- **Accessible from any page**: No longer limited to Journal page
- **Loading state**: Spinning icon while sync is in progress
- **Smart credential detection**: Checks Supabase first, localStorage fallback
- **Support for all exchanges**: Schwab, MEXC, ByBit

### 📊 Data Quality Improvements

#### Schwab Trade Deduplication
- Enhanced `mergeTrades` with `externalOid` matching
- Prevents duplicate entries from same closing transaction
- Fixes P&L double-counting issues on Calendar and reports

#### Calendar P&L Formatting
- **Desktop**: 2 decimal places for precision
- **Mobile**: 0 decimal places (rounded) for space efficiency

### 🔧 Technical Improvements

#### Vercel Configuration
- Fixed cron schedule for Hobby plan (once per day limit)
- Removed conflicting `builds` section for cleaner URL routing
- Proper TypeScript function deployment

#### Loading States
- Added skeleton loading to Overview page
- Prevents "No trades found" flash during initial load

### 📝 Documentation
- Created `docs/SCHEDULED_SYNC_SETUP.md` with full setup instructions
- Updated environment variable requirements

### ⚠️ Known Limitations
- Vercel Hobby plan limits cron jobs to once per day
- For hourly syncs, upgrade to Pro ($20/month) or use external cron service

---

## [v1.3.0-stable] - 2026-01-13

### 🎉 Major Mobile UX Improvements

#### Mobile Menu & Click-Outside-to-Close
- **Backdrop overlay**: Dark overlay appears when mobile menu is open
- **Click-outside dismiss**: Tap anywhere outside any modal/menu to close it
- **Touch-optimized**: All pop-ups and menus now mobile-friendly

#### Calendar Page Enhancements
- **Mobile weekly view**: New toggle to switch between monthly grid and weekly list
- **Responsive sizing**: Single-letter day headers on mobile (S M T W T F S)
- **Smart abbreviations**: Large P&L values shown as "1.5k" instead of "$1,500"
- **Weekly navigation**: Swipe-friendly week-by-week view with larger cards
- **Trade count badges**: See number of trades per day at a glance
- **View persistence**: Your calendar view preference is saved

#### Journal Page Card View
- **Mobile card layout**: New card view optimized for mobile scrolling
- **View toggle**: Switch between table and card views with one tap
- **Smart defaults**: Auto-selects card view on mobile, table on desktop
- **Rich cards**: Shows ticker, direction, type, entry/exit, quantity, fees, and P&L
- **Color-coded badges**: Easy visual identification of trade types and directions
- **View persistence**: Your journal view preference is saved

#### Reports Page Polish
- **Collapsible filters**: Advanced filters now collapse by default
- **Active filter badge**: See count of active filters at a glance
- **Cleaner layout**: Time range filter moved to header right side
- **Responsive controls**: All controls stack properly on mobile

### 🔧 Improvements

#### Mobile Optimizations
- Calendar grid: Compact gaps and text sizing for small screens
- Journal: Reduced horizontal scrolling with card-based layout
- Filters: Full-width responsive layout prevents overflow
- Navigation: All buttons properly sized for touch targets

#### Layout & Controls
- Exchange filter and view toggles properly aligned
- Month/week navigation centered and accessible
- Consistent button sizing across all pages
- Better use of screen real estate on mobile

### 🐛 Bug Fixes

- Fixed calendar view toggle being pushed off-screen on narrow displays
- Fixed filters panel cramped layout on Reports page
- Fixed mobile menu not closing when clicking outside
- Fixed calendar day cells being too small to read P&L values
- Fixed responsive layout issues on screens < 768px

### 📦 Technical Changes

**Updated Files:**
- `src/components/Layout.tsx` - Added click-outside-to-close with backdrop
- `src/pages/Calendar.tsx` - Added weekly view mode and responsive grid
- `src/pages/Journal.tsx` - Added card view mode with toggle
- `src/pages/ReportsPage.tsx` - Made filters collapsible, improved header layout

**New Features:**
- localStorage persistence for view preferences
- Conditional rendering for mobile/desktop layouts
- Smooth transitions and animations
- Touch-optimized interaction patterns

### ⚡ Performance

- No new dependencies added
- Bundle size unchanged
- All localStorage operations are non-blocking
- Smooth 60fps animations

### 🧪 Testing

- ✅ Build: Successful
- ✅ TypeScript: No errors
- ✅ Mobile testing: iPhone & Android verified
- ✅ Tablet testing: iPad portrait/landscape verified
- ✅ Desktop: All screen sizes verified

---

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
