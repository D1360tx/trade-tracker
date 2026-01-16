# Release v1.5.0-stable - Schwab API Fixes & Calendar Navigation

**Release Date**: January 16, 2026
**Tag**: `v1.5.0-stable`
**Deployment**: [https://trade-tracker-eight.vercel.app](https://trade-tracker-eight.vercel.app)

---

## 🎯 Executive Summary

This release resolves **three critical bugs** in the Schwab API integration that were causing:
1. **$42.71 P&L discrepancy** from rounding errors
2. **Missing trades** for positions opened before the sync window
3. **Duplicate entries** from API vs CSV imports

Additionally, we've added convenient **Calendar navigation buttons** to quickly return to the current week/month.

---

## 🔥 Critical Fixes

### 1. P&L Calculation Precision Error

**Issue**: Dashboard showed -$4,365.04 while Schwab's official report showed -$4,322.33 (difference of $42.71)

**Root Cause**:
- Used `tradeItem.price` which is rounded to $0.05 increments
- Used `tradeItem.cost` which is rounded to whole dollars
- Lost precision across multiple trades, causing cumulative error

**Solution**:
- Discovered `tx.netAmount` field contains **exact decimal values**
- Changed pricing calculation to: `price = netAmount / (quantity × multiplier)`
- Result: P&L now matches Schwab's CSV exports exactly

**Code Change**:
```typescript
// Before (WRONG):
const price = tradeItem.price || 0; // Rounded to $0.05

// After (CORRECT):
const netCost = Math.abs(tx.netAmount);
const price = quantity > 0 ? netCost / (quantity * multiplier) : (tradeItem.price || 0);
```

**Verification**:
```
Console logs showed:
rawPrice: 0.5         // Rounded ❌
rawCost: 250          // Rounded ❌
txNetAmount: 856.11   // PRECISE! ✅
txNetAmount: 1487.79  // PRECISE! ✅
```

---

### 2. Orphaned Closing Trades

**Issue**: Schwab sync was generating warnings and skipping trades for:
- BITF, ONDS, LWLG, BFLY, CIFR, HUT, BTBT, LPTH, USAR, UP, SLDP, BKSY

**Root Cause**:
- Frontend used 90-day sync window
- Backend default was 30 days
- Cron job used implicit 30-day default
- Positions opened >90 days ago couldn't match with FIFO logic

**Solution**:
- Extended sync window to **180 days** across ALL components:
  - Frontend manual sync ([src/pages/ImportPage.tsx](../src/pages/ImportPage.tsx))
  - Backend default ([api/schwab/transactions.ts](../api/schwab/transactions.ts))
  - Scheduled cron sync ([api/schwab/syncusers.ts](../api/schwab/syncusers.ts))

**Impact**:
- Captures 6 months of history (covers most swing trades)
- Still well within Schwab's API limits (365-day maximum)
- May take 2-5 seconds instead of 1-2 seconds (acceptable tradeoff)

---

### 3. Symbol Format Mismatch (Duplicates)

**Issue**: API-imported trades and CSV-imported trades appeared as duplicates in the Calendar view

**Root Cause**:
- API generated symbols: `SPXW 6720C`
- CSV had symbols: `SPXW 11/24/2025 6720.00 C`
- Deduplication failed because symbols didn't match

**Solution**:
- Added `extractExpirationDate()` function to parse Schwab's internal format
- Schwab internal format: `"SPXW  251124C00672000"` (YYMMDD embedded)
- Extract date and reconstruct to match CSV: `"SPXW 11/24/2025 6720.00 C"`

**Code Change**:
```typescript
const extractExpirationDate = (fullSymbol: string): string | null => {
    // Parse: "SPXW  251124C00672000"
    //         Symbol YY MM DD C Strike
    const match = fullSymbol.match(/\s+(\d{2})(\d{2})(\d{2})[CP]/);
    if (!match) return null;

    const [, yy, mm, dd] = match;
    const year = 2000 + parseInt(yy, 10);

    return `${mm}/${dd}/${year}`; // "11/24/2025"
};
```

**Result**:
- API symbols now match CSV symbols exactly
- Deduplication works at exact fingerprint level (fastest)
- No more duplicate SPXW trades in Calendar modal

---

## 🧭 New Feature: Calendar Navigation

### Current Week/Month Buttons

Added convenient buttons to quickly return to today's date when browsing historical calendar data.

**Behavior**:
- Only appears when viewing a past/future period
- Automatically hides when already at current period
- Text changes based on view mode (Weekly vs Monthly)

**Placement**:
- **Desktop**: Between View Toggle and Navigation arrows
- **Mobile**: Same placement for monthly view; smaller button below date range for weekly view

**User Experience**:
```
[Exchange Filter] [Weekly View Toggle] [Current Week] [ ← Jan 8-14 → ]
                                         ↑
                                   Only shows when not
                                   viewing current period
```

---

## 📊 Impact Analysis

### Before v1.5.0:
- ❌ P&L off by $42.71 on November trades
- ❌ 12 stocks showing orphaned closing trade warnings
- ❌ Duplicate SPXW trades appearing in Calendar
- ❌ Manual navigation only to return to current period

### After v1.5.0:
- ✅ P&L matches Schwab's official reports exactly
- ✅ All trades sync successfully (no orphaned warnings)
- ✅ Zero duplicate trades from API vs CSV
- ✅ One-click navigation to current week/month

---

## 🔧 Technical Details

### Files Modified

**Schwab Integration**:
```
src/utils/schwabTransactions.ts    (241 lines changed)
  - Added extractExpirationDate() function
  - Use tx.netAmount for precise pricing
  - Enhanced logging for debugging
  - Improved orphaned trade warnings

src/utils/schwabAuth.ts            (8 lines changed)
  - Added sync window logging

src/pages/ImportPage.tsx           (1 line changed)
  - Changed 90 → 180 days

src/context/TradeContext.tsx       (1 line changed)
  - Changed 90 → 180 days

api/schwab/transactions.ts         (1 line changed)
  - Changed 30 → 180 days default

api/schwab/syncusers.ts            (2 lines changed)
  - Added explicit 180-day date calculation
```

**Calendar Enhancements**:
```
src/pages/Calendar.tsx             (84 lines changed)
  - Added Current Week/Month button logic
  - Separate implementations for mobile/desktop
  - Positioned between toggle and navigation
```

### Performance Considerations

**Sync Time**:
- Before: 1-2 seconds (90 days)
- After: 2-5 seconds (180 days)
- Trade-off: Worth it for data completeness

**API Limits**:
- Schwab supports up to 365-day history
- 180 days is 49% of maximum
- Well within rate limits

**Bundle Size**:
- No new dependencies added
- Build size unchanged: ~1.16 MB
- Gzip size unchanged: ~338 KB

---

## 🧪 Testing Results

### Automated Tests
- ✅ TypeScript compilation: No errors
- ✅ Build process: Successful
- ✅ Linting: Clean

### Manual Verification
- ✅ Cleared database and re-synced Schwab trades
- ✅ Verified P&L totals match Schwab reports exactly
- ✅ Confirmed no duplicate entries in Calendar
- ✅ Checked no orphaned closing trade warnings
- ✅ Tested Current Week/Month buttons on mobile and desktop
- ✅ Verified button shows/hides based on current period

### Test Data Validation
```
November 24, 2025 Trades (from CSV):
- -$511.76
- -$611.75
- -$12.20
- -$762.20
- -$2,424.42
TOTAL: -$4,322.33 ✅ (Previously: -$4,365.04 ❌)
```

---

## 🚀 Deployment Instructions

### For Users
1. **Hard refresh your browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear Schwab trades**: Go to Settings → Clear Trades (Schwab only)
3. **Re-sync**: Click global sync button to import with new 180-day window
4. **Verify P&L**: Check that totals match your Schwab statements

### For Developers
```bash
# Pull latest code
git pull origin main

# Checkout the release tag
git checkout v1.5.0-stable

# Install dependencies (if needed)
npm install

# Build
npm run build

# Deploy to Vercel
vercel --prod
```

---

## 📝 Key Learnings

### 1. Trust but Verify User Insights
- User correctly insisted API must have precise values
- Our initial assumption (API only has rounded data) was wrong
- Lesson: Challenge assumptions with data, not speculation

### 2. Always Inspect Full API Response
- `netAmount` was there all along, we just weren't using it
- Console logging revealed the precision difference
- Lesson: Log raw API responses before processing

### 3. Match Source Data Formats
- Schwab's CSV is the "source of truth" format
- API mapper should output symbols matching CSV
- Lesson: Don't normalize away important information

### 4. Sync Windows Matter
- 90 days isn't enough for swing traders
- 180 days covers typical hold periods
- Lesson: Design for user behavior, not arbitrary limits

---

## 🔮 Future Improvements

### Short-term (Next Release)
- [ ] Add sync window configuration in Settings
- [ ] CSV import for positions >180 days old
- [ ] Visual indicator when trades are partial due to window

### Medium-term
- [ ] One-time "full history sync" option (365 days)
- [ ] Intelligent sync window based on oldest open position
- [ ] Export sync logs for debugging

### Long-term
- [ ] Real-time sync via webhooks (if Schwab adds support)
- [ ] Automatic gap detection and backfill
- [ ] Multi-account aggregation

---

## 🙏 Acknowledgments

This release was made possible through:
- Detailed user bug reports with screenshots
- Console log analysis to identify root causes
- Schwab API documentation deep-dive
- CSV format reverse engineering
- Collaborative debugging session

**Special Thanks**:
- User for challenging our assumptions about API precision
- Schwab's well-structured API responses
- TypeScript for catching errors early

---

## 📞 Support

**Issues**: [GitHub Issues](https://github.com/D1360tx/trade-tracker/issues)
**Documentation**: [CHANGELOG.md](../CHANGELOG.md)
**Live App**: [https://trade-tracker-eight.vercel.app](https://trade-tracker-eight.vercel.app)

---

**Released by**: Claude Sonnet 4.5 & Diego Campos
**Date**: January 16, 2026
**Version**: v1.5.0-stable
**Commit**: 93004b9
