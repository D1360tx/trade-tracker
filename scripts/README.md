# Demo Account Setup

This directory contains scripts and migrations to set up a demo account for Trade Tracker MVP demonstrations.

## Quick Setup

### Option 1: Automated Script (Recommended)

```bash
./scripts/setup-demo.sh
```

The script will guide you through:
1. Creating the demo user in Supabase Auth
2. Getting the user ID
3. Applying the migration with demo data

### Option 2: Manual Setup

#### Step 1: Create Demo User

1. Go to your Supabase Dashboard → Authentication → Users
2. Click "Add user"
3. Fill in:
   - **Email:** `demo@demo.com`
   - **Password:** `demo123`
   - **Auto Confirm User:** ✅ YES
4. Click "Create user"

#### Step 2: Get User ID

Run this query in Supabase SQL Editor:

```sql
SELECT id, email FROM auth.users WHERE email = 'demo@demo.com';
```

Copy the `id` (UUID).

#### Step 3: Update Migration

Open `supabase/migrations/003_demo_account.sql` and replace:

```sql
demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
```

With your actual demo user ID:

```sql
demo_user_id uuid := 'YOUR-ACTUAL-UUID-HERE';
```

#### Step 4: Apply Migration

```bash
npx supabase db push
```

## Demo Account Details

### Login Credentials
- **Email:** `demo@demo.com`
- **Password:** `demo123`

### Demo Data Includes

**Trades:** 15 realistic trades
- ✅ Mix of winners and losers
- ✅ Different exchanges: Schwab, MEXC
- ✅ Trade types: Stocks, Options, Crypto
- ✅ Date range: Last 3 weeks (recent data)
- ✅ P&L range: -$570 to +$3,125

**Strategies:** 3 trading strategies
- Momentum Trading
- Breakout Strategy
- Scalping

**Mistakes:** 2 common mistakes
- FOMO Entry
- Over-sized Position

### Trade Breakdown

| Symbol | Type | Exchange | P&L | Date | Strategy |
|--------|------|----------|-----|------|----------|
| TSLA 250C | Option | Schwab | +$3,125 | Today | Momentum |
| NVDA | Stock | Schwab | +$570 | Yesterday | Breakout |
| AAPL 220P | Option | Schwab | +$2,600 | Jan 10 | Momentum |
| BTCUSDT | Crypto | MEXC | +$1,150 | Jan 11 | Scalp |
| ETHUSDT | Crypto | MEXC | +$825 | Jan 10 | Momentum |
| SPY 580P | Option | Schwab | -$2,400 | Jan 8 | FOMO ❌ |
| MSFT | Stock | Schwab | -$135 | Jan 6 | Breakout |
| SOLUSDT | Crypto | MEXC | -$570 | Jan 6 | Oversized ❌ |
| ...and 7 more trades |

**Total P&L:** ~+$9,387  
**Win Rate:** ~67%  
**Profit Factor:** ~2.8

## Features Demonstrated

The demo account showcases:

✅ **Multi-Exchange Trading** - Schwab & MEXC
✅ **Trade Variety** - Stocks, Options, Futures, Crypto  
✅ **Strategy Tracking** - Multiple strategies with notes
✅ **Mistake Logging** - Tagged common trading errors
✅ **P&L Analytics** - Charts show realistic performance
✅ **Recent Activity** - Fresh data for live-looking demos
✅ **Mobile Experience** - Fully responsive on all devices

## Resetting Demo Data

To reset the demo account:

```sql
-- Delete existing demo trades
DELETE FROM trades WHERE user_id = 'YOUR-DEMO-USER-ID';

-- Delete strategies and mistakes
DELETE FROM strategies WHERE user_id = 'YOUR-DEMO-USER-ID';
DELETE FROM mistakes WHERE user_id = 'YOUR-DEMO-USER-ID';

-- Re-run the migration
```

Then re-apply the migration to restore demo data.

## Production Deployment

**⚠️ Important:** For production demos:

1. Create the demo user in your **production** Supabase instance
2. Use the production user ID in the migration
3. Apply the migration to production
4. Consider making the demo account read-only (optional)

### Making Demo Account Read-Only (Optional)

```sql
-- Create a policy to prevent demo account from deleting/modifying data
CREATE POLICY "demo_readonly_trades" ON trades
    FOR DELETE
    USING (user_id != 'YOUR-DEMO-USER-ID');

CREATE POLICY "demo_readonly_update" ON trades
    FOR UPDATE
    USING (user_id != 'YOUR-DEMO-USER-ID');
```

## Troubleshooting

**Issue:** Migration fails with "user not found"
- **Solution:** Make sure you created the demo user in Supabase Auth first

**Issue:** No data appears after login
- **Solution:** Verify the user ID in the migration matches the actual demo user ID

**Issue:** Some trades missing
- **Solution:** Check the migration ran successfully: `SELECT COUNT(*) FROM trades WHERE user_id = 'YOUR-DEMO-USER-ID';`

## Support

For issues or questions, check the main README or create an issue on GitHub.
