# 🕵️‍♂️ Schwab Data Validation Guide

Reference this guide when comparing Trade Tracker numbers against your Schwab dashboard.

## 🧮 How We Calculate Your P&L

Since the Schwab API endpoint (`transferItems`) provides raw trade data but **not** the final Realized P&L figure, we calculate it manually using the standard FIFO (First-In, First-Out) method.

### 1. Options Math
We apply the standard 100x multiplier for all option contracts.

**Formula:**
```
(Exit Price - Entry Price) * Quantity * 100 = Gross P&L
```

**Example:**
- Bought 1 `SPXW 5000 Call` @ **$2.00**
- Sold 1 `SPXW 5000 Call` @ **$2.50**
- Math: `($2.50 - $2.00) * 1 * 100` = **$50.00** Profit

### 2. Fees Calculation
We sum up **ALL** fees reported by Schwab for both the Opening and Closing sides of the trade.

**Included Fees:**
- `COMMISSION` (e.g., $0.65 per contract)
- `OPT_REG_FEE` (Option Regulatory Fee)
- `SEC_FEE` (SEC Transaction Fee)
- `TAF_FEE` (Trading Activity Fee)
- `INDEX_OPTION_FEE` (if applicable)

**Check:** If your Net P&L is off by a small amount (e.g., ~$0.66), it's likely a difference in whether fees are being subtracted from the P&L or tracked separately.

### 3. FIFO Matching
We assume **First-In, First-Out**.
- If you bought 5 contracts on Monday and 5 on Tuesday.
- And you sold 5 contracts on Wednesday.
- We match the sale against the **Monday** contracts (the "First In").

---

## 🔍 Common Discrepancies to Look For

| Issue | Symptom | Cause |
|-------|---------|-------|
| **Gross vs Net** | Off by ~$1-$2 | Schwab "Realized G/L" is usually **Net** (Fees deducted). Check if our App shows Gross or Net in the column you are viewing. |
| **Assignment** | Missing Trade | If an option expired ITM and was assigned/exercised, it might show up as a different transaction type. We currently look for `TRADE` type outcomes. |
| **Rounding** | Off by $0.01 | Floating point math. We round to 2 decimals, but slight differences can occur. |
| **Timezone** | Off by 1 Day | We convert everything to Local Time. Schwab website might show ET. |

## 🛠 Features We Enabled
- **Auto-Sync**: Mon-Fri @ 3:30 PM CST
- **Weekend Sweep**: Mon @ 8:31 AM CST
- **History**: Last 90 Days

---

*Verified on: Jan 9, 2026*
