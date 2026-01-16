# Changelog

All notable changes to Trade Tracker will be documented in this file.

## [v1.5.0-stable] - 2026-01-16

### 🎯 Critical Schwab API Fixes

This release resolves three major issues with the Schwab API integration that were causing data inconsistencies and missing trades.

#### 1. Orphaned Closing Trades Fixed
**Problem**: Schwab sync was skipping trades and generating "ORPHANED CLOSING TRADE" warnings for positions opened before the sync window (BITF, ONDS, LWLG, BFLY, CIFR, HUT, BTBT, LPTH, USAR, UP, SLDP, BKSY).

**Root Cause**:
- Frontend sync used 90-day window ([src/pages/ImportPage.tsx](src/pages/ImportPage.tsx), [src/context/TradeContext.tsx](src/context/TradeContext.tsx))
- Backend default was 30 days ([api/schwab/transactions.ts](api/schwab/transactions.ts))
- Cron job used implicit backend default (30 days)
- Positions opened >90 days ago would fail FIFO matching when closed

**Solution**: Extended sync window to **180 days** across all components:
- Frontend manual sync: 180 days
- Backend default: 180 days
- Cron job: Explicit 180-day window
- Added console logging to show exact date ranges being synced

**Files Modified**:
- [src/pages/ImportPage.tsx:64](src/pages/ImportPage.tsx#L64)
- [src/context/TradeContext.tsx:712](src/context/TradeContext.tsx#L712)
- [api/schwab/transactions.ts:93](api/schwab/transactions.ts#L93)
- [api/schwab/syncusers.ts:82-83](api/schwab/syncusers.ts#L82-L83)
- [src/utils/schwabAuth.ts:262-265](src/utils/schwabAuth.ts#L262-L265)

#### 2. Symbol Format Mismatch (Deduplication Failure)
**Problem**: API-imported trades and CSV-imported trades were creating duplicates on the calendar. API symbols like `SPXW 6720C` didn't match CSV symbols like `SPXW 11/24/2025 6720.00 C`, causing deduplication to fail.

**Root Cause**: The API mapper was constructing simplified option symbols without expiration dates, while Schwab's official CSV exports include full option details.

**Solution**: Modified API mapper to extract expiration date from Schwab's internal option symbol format and construct display symbols matching CSV format:
```typescript
// Added extractExpirationDate() function
// Schwab internal: "SPXW  251124C00672000"
// Extracted: "11/24/2025"
// Result: "SPXW 11/24/2025 6720.00 C" (matches CSV)
```

**Files Modified**:
- [src/utils/schwabTransactions.ts:52-65](src/utils/schwabTransactions.ts#L52-L65) - Added `extractExpirationDate()`
- [src/utils/schwabTransactions.ts:192-210](src/utils/schwabTransactions.ts#L192-L210) - Updated symbol construction

**Impact**:
- ✅ Exact fingerprint matching now works
- ✅ No more duplicate SPXW trades in calendar modal
- ✅ `externalOid` provides backup deduplication layer

#### 3. P&L Calculation Precision Error ($42.71 discrepancy)
**Problem**: Dashboard showed -$4,365.04 vs Schwab's official report showing -$4,322.33 (difference of $42.71).

**Root Cause Investigation**:
- Initially thought fees were being double-counted ❌
- Discovered `tradeItem.price` was rounded to $0.05 increments ❌
- Discovered `tradeItem.cost` was rounded to whole dollars ❌
- **Breakthrough**: Found `tx.netAmount` field contains EXACT decimal values! ✅

**Solution**: Changed price calculation to use `tx.netAmount` instead of `tradeItem.price`:
```typescript
// Before (WRONG):
const price = tradeItem.price || 0; // Rounded to $0.05

// After (CORRECT):
const netCost = Math.abs(tx.netAmount);
const price = quantity > 0 ? netCost / (quantity * multiplier) : (tradeItem.price || 0);
```

**Evidence**: Console logs showed:
```
rawPrice: 0.5        // Rounded
rawCost: 250         // Rounded
txNetAmount: 856.11  // PRECISE! ✅
txNetAmount: 1487.79 // PRECISE! ✅
```

**Files Modified**:
- [src/utils/schwabTransactions.ts:99-109](src/utils/schwabTransactions.ts#L99-L109) - Use `netAmount` for pricing
- [src/utils/schwabTransactions.ts:114-125](src/utils/schwabTransactions.ts#L114-L125) - Added debug logging
- [src/utils/schwabTransactions.ts:136](src/utils/schwabTransactions.ts#L136) - Set fees to 0 (already in price)
- [src/utils/schwabTransactions.ts:182](src/utils/schwabTransactions.ts#L182) - Removed fee subtraction from P&L
- [src/utils/schwabTransactions.ts:223](src/utils/schwabTransactions.ts#L223) - Set fees to 0 in trade object

**Impact**:
- ✅ P&L now matches Schwab's official reports exactly
- ✅ Calendar totals are accurate
- ✅ Individual trade P&L values have proper decimal precision

### 🧭 Calendar Navigation Enhancements

#### Current Week/Month Button
**Feature**: Added "Current Week" and "Current Month" buttons to quickly return to today's date when navigating historical data.

**Behavior**:
- Only appears when viewing a past/future period
- Automatically hides when already viewing current period
- Changes text based on view mode (Weekly vs Monthly)
- Positioned between View Toggle and Navigation arrows

**Implementation**:
- Desktop weekly view: Shows "Current Week"
- Desktop monthly view: Shows "Current Month"
- Mobile weekly view: Shows "Current Week" (smaller button below date range)
- Mobile monthly view: Shows "Current Month" in top controls

**Files Modified**:
- [src/pages/Calendar.tsx:271-298](src/pages/Calendar.tsx#L271-L298) - Added button logic
- [src/pages/Calendar.tsx:352-365](src/pages/Calendar.tsx#L352-L365) - Mobile weekly view button

### 🔧 Technical Improvements

#### Enhanced Logging
- Added sync window logging: `[Schwab Sync] Fetching transactions from 2025-07-19 to 2026-01-16 (180 days)`
- Added price calculation debugging for all transactions
- Added orphaned trade summary with unique symbols
- Success message when all trades match: `✅ All closing trades successfully matched with opening positions`

#### Improved Error Messages
Enhanced orphaned trade warnings with actionable context:
```
⚠️  [Schwab Mapper] ORPHANED CLOSING TRADE: Could not find opening position for SPXW  251124C00672000
Closed: 2025-11-24
This position was likely opened before 2025-07-19
Trade will be skipped. Consider extending sync window beyond 180 days.
```

### 📦 Files Changed Summary

**Schwab Integration**:
- `src/utils/schwabTransactions.ts` - Symbol format, precise pricing, logging
- `src/utils/schwabAuth.ts` - Sync window logging
- `src/pages/ImportPage.tsx` - 180-day sync window
- `src/context/TradeContext.tsx` - 180-day sync window
- `api/schwab/transactions.ts` - 180-day default
- `api/schwab/syncusers.ts` - Explicit 180-day cron sync

**Calendar Enhancements**:
- `src/pages/Calendar.tsx` - Current Week/Month button

### ⚡ Performance Notes

- 180-day sync may take 2-5 seconds vs previous 1-2 seconds
- Still well within Schwab API rate limits
- Deduplication prevents duplicate data despite larger payloads
- No additional API calls required

### 🧪 Testing

- ✅ Build: Successful
- ✅ TypeScript: No errors
- ✅ P&L matches Schwab official reports exactly
- ✅ No duplicate trades from API vs CSV imports
- ✅ No orphaned closing trade warnings for 180-day window
- ✅ Calendar navigation works on mobile and desktop

### 📝 Key Learnings

1. **Always check the full API response structure** - `netAmount` had the precision we needed all along
2. **Sync window must cover typical hold periods** - 180 days captures most swing trades
3. **Symbol formats must match exactly for deduplication** - Can't normalize away important data
4. **Trust but verify user insights** - User was correct that API must have precise values, our initial assumption was wrong

### 🚀 Upgrade Path

This is a **stable release** with critical bug fixes. All users should upgrade immediately:

1. Pull latest code from `main` branch
2. No database migrations required
3. Hard refresh browser (Cmd+Shift+R) after deployment
4. Clear and re-sync Schwab trades to get accurate P&L

### ⚠️ Breaking Changes

**None** - All changes are backward compatible.

### 🙏 Credits

This release was a collaborative debugging session that required:
- Deep investigation of Schwab's API response structure
- Analysis of CSV export formats
- Console logging to identify precision issues
- User feedback challenging incorrect assumptions

---

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
