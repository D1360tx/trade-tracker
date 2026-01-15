SELECT id, ticker, pnl, quantity, exchange, notes, created_at 
FROM trades 
WHERE exit_date >= '2026-01-01'
ORDER BY ticker, created_at;
