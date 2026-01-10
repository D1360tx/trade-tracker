# 🔧 Schwab API Date Format Fix - Round 2

**Issue**: Schwab still rejecting dates after 60-day fix  
**Deployed**: January 9, 2026 @ 3:07 PM CST  
**Commits**: `8eeaaca` + `db9e4b7`

---

## 🐛 Problem Analysis

### Error Evolution:
1. **Initial Error** (90 days): `'2025-10-11' is not a valid value for startDate"`
2. **After 60-day fix**: `'2025-11-10' is not a valid value for startDate"` 
3. **Conclusion**: The fix was deployed (date changed) but Schwab still rejecting it

### Root Causes Found:
1. **Too Long Window**: 60 days might be too long for some Schwab accounts
2. **Wrong Date Format**: We were sending `YYYY-MM-DD` but Schwab may require full ISO 8601 with timezone

---

## ✅ Solutions Applied

### Fix #1: Reduced Date Window (30 Days)
**File**: `src/pages/ImportPage.tsx`

```typescript
// Changed from:
const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Changed to:
const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
```

**Rationale**: Even though docs say 60 days, some accounts may have stricter limits. 30 days is very conservative.

---

### Fix #2: ISO 8601 Timestamp Format
**File**: `api/schwab/transactions.ts`

```typescript
// Changed from:
transactionsUrl.searchParams.set('startDate', start.toISOString().split('T')[0]);
transactionsUrl.searchParams.set('endDate', end.toISOString().split('T')[0]);

// Changed to:
transactionsUrl.searchParams.set('startDate', new Date(start.setHours(0, 0, 0, 0)).toISOString());
transactionsUrl.searchParams.set('endDate', new Date(end.setHours(23, 59, 59, 999)).toISOString());
```

**Old Format**: `2025-12-10` (date only)  
**New Format**: `2025-12-10T00:00:00.000Z` (full ISO 8601 with UTC timezone)

**Rationale**: Research shows Schwab API may require timezone-aware ISO 8601 format per R/Python wrapper documentation.

---

## 🚀 Deployment Status

### Commits:
1. `8eeaaca` - "fix: Reduce Schwab date window to 30 days"
2. `db9e4b7` - "fix: Use ISO 8601 format for Schwab transaction dates"

### Expected Date Range (current deployment):
- **Start Date**: `2025-12-10T00:00:00.000Z` (30 days ago)
- **End Date**: `2026-01-09T23:59:59.999Z` (today)

---

## 🧪 How to Test

### Wait for Deployment:
```bash
# Check if ready
vercel ls | head -n 5

# Or check specific deployment
vercel inspect [deployment-url]
```

### Test Steps:
1. **Hard Refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) on import page
2. **Reconnect Schwab** (if needed): OAuth token may have expired
3. **Click "Sync Trades from Schwab"**
4. **Check for success**:
   - ✅ Should now import trades without date errors
   - ✅ Will show last 30 days of trades
   - ✅ UI will say "Fetches last 30 days of trade history"

### Expected Behavior:
- **Success**: Trades import from ~Dec 10, 2025 to Jan 9, 2026
- **Failure** (if still errors): Check browser console and share error details

---

## 📊 What Changed

| Aspect | Before (v1) | After Fix #1 (v2) | After Fix #2 (v3) |
|--------|-------------|-------------------|-------------------|
| **Date Window** | 90 days | 60 days | **30 days** |
| **Start Date** | 2025-10-11 | 2025-11-10 | 2025-12-10 |
| **Date Format** | YYYY-MM-DD | YYYY-MM-DD | **ISO 8601 with TZ** |
| **Example Start** | `2025-10-11` | `2025-11-10` | `2025-12-10T00:00:00.000Z` |
| **Example End** | `2026-01-09` | `2026-01-09` | `2026-01-09T23:59:59.999Z` |

---

## 🔍 Research Sources

Based on Schwab API documentation and community code:
1. **Date Format**: R wrapper uses `%Y-%m-%dT%H:%M:%OS3Z` (ISO 8601 with UTC)
2. **Transaction Window**: "start_date must be within 60 days" (but appears to be stricter)
3. **Full Timestamp**: Python libraries accept `datetime` objects, suggesting full timestamps expected

---

## 💡 If Still Failing

### Additional Debugging Steps:
1. **Check Console Logs**: Look for exact error from Schwab API
2. **Verify Account Type**: Some Schwab account types may have different limits
3. **Check API Permissions**: Ensure Schwab app has transaction read access
4. **Try 7 Days**: If 30 days still fails, we can reduce further

### Alternative Solutions:
1. **Use CSV Import**: Download from Schwab website, guaranteed to work
2. **Ask Schwab Support**: Get exact API requirements for your account
3. **Check Schwab Developer Portal**: Verify app settings and permissions

---

## ✨ What's Next

Once this fix deploys (~2 minutes):
1. **Test Schwab sync** with new date format
2. **Verify trades import** successfully
3. **Move on to MEXC API testing** (other priority task)

---

**Deployment in progress... should be ready in ~2 minutes** ⏱️

*Last updated: January 9, 2026 @ 3:09 PM CST*
