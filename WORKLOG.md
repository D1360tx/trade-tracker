# Trade Tracker Pro - Work Log

> Detailed debugging notes, research findings, attempted solutions, and technical deep-dives.
> For high-level status, see **[CONTEXT.md](./CONTEXT.md)**

---

## 🔴 MEXC Futures API - Signature Failure

**Status**: 🔧 Enhanced Debugging - Ready for Testing  
**Error**: `"Confirming signature failed"`  
**Started**: January 2026  
**Last Updated**: January 9, 2026

### Problem Description
MEXC Futures API calls are failing with signature validation errors. The API returns "Confirming signature failed" even when the signature appears to be generated correctly.

### Files Involved
- `/api/mexc-futures.ts` - Serverless proxy for MEXC Futures API
- `/src/utils/apiClient.ts` - Client-side API utilities (✅ ENHANCED)

### Research Findings

#### MEXC Futures Signature Requirements (VERIFIED)
- Uses HMAC-SHA256 signing
- Signature format: `HMAC-SHA256(apiKey + timestamp + queryString, secretKey)`
- For GET requests with NO parameters: queryString = "" (empty string)
- Timestamp must be within 10 seconds of server time (default)
- `Recv-Window` header can extend tolerance up to 60 seconds

#### Verified from Official Documentation
- Endpoint: `GET /api/v1/private/order/list/history_orders`
- Headers Required:
  - `ApiKey`: Your API key (32 chars)
  - `Request-Time`: Timestamp in milliseconds (as string)
  - `Signature`: HMAC-SHA256 hex digest
  - `Recv-Window`: Optional, max 60000ms (60 seconds)
- Query Parameters: None for basic history fetch

### Latest Changes (January 9, 2026)

#### ✅ Enhanced Debug Logging
Added comprehensive logging to `/src/utils/apiClient.ts`:
- Full signature string visibility
- Complete request headers with truncated sensitive data
- Raw response body capture (first 500 chars)
- Server time drift calculation
- API key/secret length validation
- Enhanced error messages with full MEXC response

#### ✅ Server Time Synchronization
- Added `getMEXCServerTime()` helper function
- Fetches MEXC server time from `/api/v1/contract/ping`
- Calculates time drift between local and server
- Auto-adjusts timestamp if drift > 1 second

#### ✅ Improved Error Handling
- Captures full error response from MEXC (not just HTTP status)
- Parses JSON error messages
- Logs complete request/response cycle
- Better error messages with error codes

### Things We've Done

| Task | Status | Notes |
|------|--------|-------|
| Verified API key format | ✅ Done | Added length validation logging |
| Enhanced debug logging | ✅ Done | Full signature & response visibility |
| Server time sync check | ✅ Done | Auto-detects and adjusts for drift |
| Increased `Recv-Window` | ✅ Done | Now 60000ms (60 seconds) |
| Full error response capture | ✅ Done | Logs complete MEXC error details |
| Created deployment checklist | ✅ Done | See `DEPLOYMENT_CHECKLIST.md` |

### Next Steps for User
1. **Deploy Enhanced Version**:
   ```bash
   git add .
   git commit -m "Enhanced MEXC API debugging with comprehensive logging"
   git push origin main  # Auto-deploys to Vercel
   ```

2. **Test in Production**:
   - Go to Settings → Enter MEXC API key/secret
   - Open Browser Console (F12)
   - Go to Import page → Click "Import from MEXC Futures"
   - Review comprehensive debug logs in console

3. **Verify MEXC API Key Settings**:
   - API key permissions include "Read" for trade history
   - IP whitelist includes your IP (or disabled for testing)
   - Keys are exactly 32 characters (no spaces)

4. **Review Console Output**:
   Expected logs will show:
   - `[MEXC] API Key length: 32`
   - `[MEXC Time Check] { drift: "...ms" }`
   - `[MEXC Futures] Request Details: { signatureFull: "..." }`
   - `[MEXC Futures] Raw Response: { status: ..., body: "..." }`

### Debugging Commands
```bash
# Test locally with Vercel dev server
cd /Users/d1360/.gemini/antigravity/scratch/trade_tracker
vercel dev

# Deploy to production
vercel --prod

# View production logs
vercel logs
```

### Debug Commands
```bash
# Test MEXC API locally
vercel dev

# Check server logs
vercel logs
```

---

## 🟡 MEXC Spot API - Signature Invalid (ON HOLD)

**Status**: ⏸️ Paused (waiting on Futures fix)  
**Error**: `"Signature for this request is not valid"`  
**Started**: December 2025

### Problem Description
MEXC Spot API imports fail with signature validation error. Investigation revealed potential URL corruption during request construction.

### Files Involved
- `/api/mexc-spot.ts` - Serverless proxy for MEXC Spot API
- `/src/utils/csvParsers.ts` - Includes MEXC parsing logic

### Research Findings
- Spot API uses different endpoint structure than Futures
- URL encoding issues may be corrupting the signature
- This issue is related to but distinct from the Futures issue

### Things We've Tried

| Attempt | Result | Notes |
|---------|--------|-------|
| Investigated URL corruption | ⚠️ Found issue | URL being modified during request |
| Reviewed signature generation | Pending | Need to compare with working examples |

### On Hold Because
Resolving the Futures API issue first will likely provide insights that apply to Spot API as well. The signature generation logic is similar between both.

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
