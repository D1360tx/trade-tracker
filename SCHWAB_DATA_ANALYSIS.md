# Schwab Data Analysis - Dashboard vs CSVs

## Summary of Findings

### Data Sources

1. **Schwab API (via OAuth)**
   - **Date Range**: 90 days (configured in `TradeContext.tsx` line 464)
   - **Data Type**: Raw transaction data from Schwab API
   - **Processing**: Uses FIFO matching to pair opening/closing transactions
   - **Endpoint**: `/trader/v1/accounts/{accountId}/transactions`

2. **CSV Files** (Realized Gain/Loss Report)
   - **Summary CSV**: Aggregated P&L by symbol
   - **Details CSV**: Individual lot-level buy/sell pairs with realized G/L
   - **Date Range**: 10/09/2025 to 01/09/2026 (~3 months)

---

## Key Differences

### 1. **Data Structure**

**Schwab API Returns:**
- Individual transactions (buys, sells, fees, etc.)
- Raw position effects (OPENING/CLOSING)
- Requires FIFO matching logic to create complete trades

**CSV Reports Show:**
- Already-matched completed trades
- Realized P&L calculated by Schwab
- Lot-level details with exact entry/exit dates

### 2. **"Open Positions" Issue**

Looking at your dashboard screenshot, I see trades marked as **OPEN**. This happens when:

**Root Cause:** The FIFO matcher (`schwabTransactions.ts`) creates an OPEN trade if:
1. It encounters an OPENING transaction
2. But doesn't find a matching CLOSING transaction within the 90-day window

**Why This Happens:**
```typescript
// In schwabTransactions.ts (lines 86-155)
if (isOpening) {
    // Creates an OPEN position immediately
    // Waits for CLOSING transaction to complete it
} else {
    // Tries to match with existing OPEN position
    // If no match found, creates orphaned CLOSED trade
}
```

**The Problem:**
- If you bought an option **before the 90-day window** (e.g., 100 days ago)
- But sold it **within the 90-day window**
- The API only sees the CLOSING transaction
- Result: Shows as OPEN or orphaned

---

## Comparison with CSV Data

### CSV Shows (Example from Details):
```
Symbol: COIN 01/09/2026 235.00 P
Opened: 01/08/2026
Closed: 01/09/2026
Quantity: 1
P&L: $27.68
```

### API Likely Has:
```
Transaction 1 (01/08/2026): BUY 1 COIN P235 @ $0.68 - OPENING
Transaction 2 (01/09/2026): SELL 1 COIN P235 @ $0.95 - CLOSING
```

**If both transactions are within 90 days → ✅ Correctly matched**

**If buy transaction is outside 90 days → ❌ Only sees CLOSING, creates orphaned trade**

---

## Recommendations

### Option 1: Extend API Fetch Window
**File**: `src/context/TradeContext.tsx` line 464

```typescript
// Current: 90 days
const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Recommended: 180 days (6 months) to capture longer-held positions
const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
```

**Pros:**
- Reduces orphaned trades
- Better FIFO matching

**Cons:**
- Slower API response
- More data to process

---

### Option 2: Improve FIFO Matcher Logic
**File**: `src/utils/schwabTransactions.ts`

Add fallback logic for orphaned CLOSING transactions:

```typescript
// If CLOSING transaction has no matching OPEN position:
if (!isOpening && openPositions.length === 0) {
    // Option A: Create synthetic OPEN position with cost from netAmount
    // Option B: Mark as CLOSED with warning flag
    // Option C: Skip and log for manual review
}
```

---

### Option 3: Compare & Reconcile
1. **Keep API for real-time sync**
2. **Also support CSV import** for historical accuracy
3. **Show "unmatched" trades** in a special section

---

## What Data Is Currently Being Pulled?

From your dashboard screenshot, the Schwab data shows:
- **Multiple "OPEN" positions** - Likely orphaned CLOSING transactions
- **Options trades** - Various strikes and expirations
- **Recent dates** - All within the last few weeks

This suggests:
1. ✅ API is successfully fetching transactions
2. ✅ FIFO matching is working for same-day trades
3. ❌ Multi-day holds are creating orphaned positions
4. ❌ Need longer lookback window OR CSV reconciliation

---

## Next Steps

**Immediate:**
1. Check if the "OPEN" trades in dashboard match the CSVs
2. Identify specific symbols showing as OPEN but are CLOSED in CSV

**Short Term:**
1. Extend API window from 90 → 180 days
2. Add logging to see unmatched transactions

**Long Term:**
1. Hybrid approach: API for recent + CSV for historical
2. Add "Reconcile with Schwab CSV" feature

Would you like me to implement any of these solutions?
