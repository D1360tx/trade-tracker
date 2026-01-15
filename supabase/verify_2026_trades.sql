-- =====================================================
-- VERIFY 2026 SCHWAB TRADES (YEAR TO DATE)
-- =====================================================

-- Step 1: Summary of 2026 Schwab trades
SELECT 
    'Database 2026 YTD' as source,
    COUNT(*) as total_trades,
    ROUND(SUM(pnl)::numeric, 2) as total_pnl,
    ROUND(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END)::numeric, 2) as gross_wins,
    ROUND(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)::numeric, 2) as gross_losses,
    ROUND(SUM(fees)::numeric, 2) as total_fees,
    MIN(exit_date::date) as earliest,
    MAX(exit_date::date) as latest
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2026-01-01'
AND exit_date < '2027-01-01';


-- Step 2: Daily breakdown for 2026
SELECT 
    exit_date::date as trade_date,
    COUNT(*) as trades,
    ROUND(SUM(pnl)::numeric, 2) as daily_pnl
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2026-01-01'
AND exit_date < '2027-01-01'
GROUP BY 1
ORDER BY 1;


-- Step 3: Check for potential duplicates in 2026
SELECT 
    ticker,
    exit_date::date,
    pnl,
    quantity,
    COUNT(*) as count
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2026-01-01'
AND exit_date < '2027-01-01'
GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1
ORDER BY count DESC;


-- Step 4: List all 2026 trades with details
SELECT 
    ticker,
    exit_date::date as date,
    direction,
    quantity,
    entry_price,
    exit_price,
    pnl,
    fees,
    external_oid
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2026-01-01'
AND exit_date < '2027-01-01'
ORDER BY exit_date DESC;
