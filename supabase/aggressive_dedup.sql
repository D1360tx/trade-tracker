-- =====================================================
-- AGGRESSIVE DUPLICATE CLEANUP FOR 2025 SCHWAB TRADES
-- =====================================================
-- Problem: Still have 352 trades instead of 279 (73 extras)
-- This script uses a more aggressive normalization
-- =====================================================

-- Step 1: View ALL potential duplicates with better normalization
WITH normalized AS (
    SELECT 
        id,
        user_id,
        ticker,
        -- More aggressive normalization: extract just symbol + strike + P/C
        UPPER(
            TRIM(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(ticker, '\d{1,2}/\d{1,2}/\d{4}\s*', '', 'g'),  -- Remove dates
                            '\.\d{2}\s+', ' ', 'g'  -- Replace .00 with space
                        ),
                        '\s+', ' ', 'g'  -- Normalize multiple spaces
                    ),
                    '\s+([PC])\s*$', '$1', 'g'  -- Attach P/C directly to strike
                )
            )
        ) AS normalized_ticker,
        exit_date::date as exit_date,
        ROUND(pnl::numeric, 2) as pnl,
        quantity,
        created_at,
        external_oid
    FROM trades
    WHERE exchange = 'Schwab'
    AND exit_date >= '2025-01-01'
    AND exit_date < '2026-01-01'
),
with_row_num AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, exit_date, pnl, quantity
            ORDER BY created_at ASC
        ) as row_num
    FROM normalized
)
SELECT 
    id,
    ticker,
    normalized_ticker,
    exit_date,
    pnl,
    quantity,
    row_num,
    CASE WHEN row_num > 1 THEN '🗑️ DELETE' ELSE '✅ KEEP' END as action
FROM with_row_num
WHERE (user_id, exit_date, pnl, quantity) IN (
    SELECT user_id, exit_date, pnl, quantity
    FROM with_row_num
    GROUP BY user_id, exit_date, pnl, quantity
    HAVING COUNT(*) > 1
)
ORDER BY exit_date DESC, pnl, row_num
LIMIT 200;


-- Step 2: Count duplicates by P&L + Date + Quantity (most reliable)
SELECT 
    'Duplicates by PnL+Date+Qty' as method,
    COUNT(*) - COUNT(DISTINCT (exit_date::date, ROUND(pnl::numeric, 2), quantity)) as duplicate_count
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01';


-- =====================================================
-- Step 3: DELETE using P&L + Date + Quantity match
-- =====================================================
-- This is the most reliable way to deduplicate:
-- Same date + same P&L + same quantity = same trade
-- =====================================================
-- UNCOMMENT TO RUN:

/*
DELETE FROM trades
WHERE id IN (
    WITH numbered AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY 
                    user_id,
                    exit_date::date,
                    ROUND(pnl::numeric, 2),
                    quantity
                ORDER BY created_at ASC
            ) as row_num
        FROM trades
        WHERE exchange = 'Schwab'
        AND exit_date >= '2025-01-01'
        AND exit_date < '2026-01-01'
    )
    SELECT id FROM numbered WHERE row_num > 1
);
*/


-- Step 4: Verify after deletion
SELECT 
    'Final Summary' as status,
    COUNT(*) as total_trades,
    ROUND(SUM(pnl)::numeric, 2) as total_pnl
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01';

-- Expected: 279 trades, -$1,014.14 P&L
