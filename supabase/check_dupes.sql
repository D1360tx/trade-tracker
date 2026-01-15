-- Check for duplicates in 2026 trades
SELECT 
    ticker,
    exit_date::date,
    direction,
    quantity,
    pnl,
    COUNT(*) as count
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2026-01-01'
GROUP BY 1, 2, 3, 4, 5
HAVING COUNT(*) > 1
ORDER BY exit_date DESC, ticker;

-- Show all trades for today to see duplicates
SELECT 
    ticker,
    exit_date,
    direction,
    quantity,
    pnl,
    external_oid
FROM trades
WHERE exchange = 'Schwab'
AND exit_date::date = '2026-01-15'
ORDER BY ticker, pnl;
