-- Find trades with $0 P&L that might need fixing
-- Run this in Supabase SQL Editor

-- Step 1: View all trades with $0 P&L
SELECT id, ticker, pnl, quantity, exchange, exit_date, created_at
FROM trades
WHERE pnl = 0 
  AND exit_date >= '2026-01-01'
ORDER BY ticker, exit_date;

-- Step 2: Delete all $0 P&L trades from 2026 (so you can re-import with correct data)
-- UNCOMMENT THE LINES BELOW TO EXECUTE
-- DELETE FROM trades
-- WHERE pnl = 0 
--   AND exit_date >= '2026-01-01';

-- After running the delete, re-import your Schwab CSV
