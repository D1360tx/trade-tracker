-- Quick check: Sample trades and total P&L calculation

-- 1. Show a few sample trades to verify P&L values are correct
SELECT 
    ticker,
    exit_date::date,
    quantity,
    pnl,
    entry_price,
    exit_price
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01'
ORDER BY exit_date DESC
LIMIT 10;

-- 2. Sum up the P&L to verify total
SELECT 
    COUNT(*) as trades,
    ROUND(SUM(pnl)::numeric, 2) as total_pnl,
    ROUND(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END)::numeric, 2) as gross_profit,
    ROUND(SUM(CASE WHEN pnl < 0 THEN pnl ELSE 0 END)::numeric, 2) as gross_loss
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01';

-- 3. Check if there are January-June 2025 trades (should be if CSV covers full year)
SELECT 
    DATE_TRUNC('month', exit_date::date) as month,
    COUNT(*) as trade_count,
    ROUND(SUM(pnl)::numeric, 2) as monthly_pnl
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01'
GROUP BY 1
ORDER BY 1;
