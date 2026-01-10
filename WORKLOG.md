# Trade Tracker Pro - Work Log

> Detailed debugging notes, research findings, attempted solutions, and technical deep-dives.
> For high-level status, see **[CONTEXT.md](./CONTEXT.md)**

---

## ✅ MEXC Futures API - RESOLVED!

**Status**: ✅ **RESOLVED** - Working in Production  
**Error**: `"Confirming signature failed"` (FIXED)  
**Started**: January 2026  
**Resolved**: January 9, 2026

### Problem Description
MEXC Futures API calls were failing with signature validation errors in production, but working perfectly in local development (`vercel dev`). The API returned "Confirming signature failed" despite signatures being generated correctly.

### Root Cause - CRITICAL DISCOVERY

**Vercel's URL Rewrite System** was adding an extra `path` query parameter in production that wasn't present in local development:

```
Client sends: /api/mexc-spot/api/v3/account?timestamp=123&signature=abc
Vercel rewrites to: /api/mexc-spot?timestamp=123&signature=abc&path=api%2Fv3%2Faccount
```

This extra `&path=...` parameter:
1. Changed the query string MEXC received
2. Invalidated our signature (which was calculated without the `path` parameter)
3. Only happened in production due to Vercel's `:path*` route rewrite behavior

### The Solution

**File**: `/api/mexc-futures.ts` and `/api/mexc-spot.ts`

```typescript
// CRITICAL: Remove the 'path' parameter that Vercel adds during URL rewrite
reqUrl.searchParams.delete('path');
const cleanSearch = reqUrl.searchParams.toString();
const queryString = cleanSearch ? `?${cleanSearch}` : '';

// Construct target URL with cleaned query parameters
const targetUrl = `${MEXC_BASE}${mexcPath}${queryString}`;
```

### Why It Worked Locally But Not in Production

- **`vercel dev`** (local): Doesn't add the `path` parameter to query strings
- **Vercel Production**: Uses the `:path*` route pattern differently, adding it as a query param

This is a **known Vercel quirk** when using catch-all routes with rewrites.

### Files Involved
- `/api/mexc-futures.ts` - Serverless proxy for MEXC Futures API (FIXED)
- `/api/mexc-spot.ts` - Serverless proxy for MEXC Spot API (FIXED)
- `/src/utils/apiClient.ts` - Client-side API utilities

### Verification
Successfully importing trades from MEXC in production:
- SOL_USDT trades with correct P&L
- AVAX_USDT trades
- ZEC_USDT trades
- All with accurate entry/exit prices and dates

---


## ✅ MEXC Spot API - RESOLVED!

**Status**: ✅ **RESOLVED** - Working in Production  
**Error**: `\"Signature for this request is not valid\"` (FIXED)  
**Started**: December 2025  
**Resolved**: January 9, 2026

### Problem Description
MEXC Spot API imports were failing with the same signature validation error as Futures.

### Solution
Fixed by the same solution as Futures API - removing the `path` query parameter that Vercel adds during URL rewrites. See MEXC Futures section above for full details.

### Files Involved
- `/api/mexc-spot.ts` - Serverless proxy for MEXC Spot API (FIXED)
- `/src/utils/csvParsers.ts` - Includes MEXC parsing logic


---

## ✅ Schwab CSV Import - Realized Gain/Loss (COMPLETED)

**Status**: ✅ Completed  
**Completed**: January 2026

### What Was Done
- Updated Schwab CSV parser to use "Realized Gain/Loss" CSV format
- Properly parse options contracts (calls and puts)
- Fixed Put option direction to default to `SHORT`
- Added P&L extraction from CSV

### Files Modified
- `/src/utils/csvParsers.ts`

---

## ✅ P&L Calendar Daily Modal (COMPLETED)

**Status**: ✅ Completed  
**Completed**: January 2026

### What Was Done
- Added detailed daily performance summary modal to Calendar view
- Shows key stats: total P&L, win rate, trade count
- Includes individual trade breakdown for selected day

### Files Modified
- `/src/pages/Calendar.tsx`
- `/src/components/DayDetailModal.tsx`

---

## ✅ CSV Duplicate Detection (COMPLETED)

**Status**: ✅ Completed  
**Completed**: January 2026

### What Was Done
- Implemented content-based duplicate detection for all CSV imports
- Compares: ticker, direction, entry/exit dates, P&L
- Prevents re-importing the same trades

### Files Modified
- `/src/utils/csvParsers.ts`
- `/src/pages/ImportPage.tsx`

---

## Notes & Learnings

### MEXC API General Notes
- Futures and Spot APIs have different base URLs and slightly different auth
- API documentation: https://mexcdevelop.github.io/apidocs/
- Signature is case-sensitive
- Timestamps are in milliseconds

### Schwab API Notes
- OAuth flow requires serverless functions (can't do client-side)
- Use `vercel dev` for local testing
- Token refresh is handled automatically
- Callback URL must match exactly what's registered in Schwab portal

---

*Last updated: January 6, 2026*
