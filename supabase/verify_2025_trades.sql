-- =====================================================
-- VERIFY 2025 SCHWAB TRADES DATA
-- =====================================================
-- This script compares your database against the CSV export to:
-- 1. Count trades and validate totals
-- 2. Identify duplicates
-- 3. Find missing trades
-- =====================================================

-- Step 1: Summary of current Schwab trades for 2025
SELECT 
    'Database Summary' as source,
    COUNT(*) as total_trades,
    SUM(pnl) as total_pnl,
    COUNT(DISTINCT ticker) as unique_tickers,
    COUNT(DISTINCT exit_date::date) as trading_days
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01';

-- According to CSV: 280 rows (excluding header), need to calculate total P&L


-- Step 2: Find duplicates in database using normalized ticker
WITH normalized AS (
    SELECT 
        id,
        ticker,
        UPPER(
            TRIM(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(ticker, '\d{1,2}/\d{1,2}/\d{4}\s*', '', 'g'),
                        '\.00\s*', '', 'g'
                    ),
                    '\s+', ' ', 'g'
                )
            )
        ) AS normalized_ticker,
        exit_date::date,
        ROUND(pnl::numeric, 2) as pnl,
        quantity,
        created_at
    FROM trades
    WHERE exchange = 'Schwab'
    AND exit_date >= '2025-01-01'
    AND exit_date < '2026-01-01'
),
duplicates AS (
    SELECT 
        normalized_ticker,
        exit_date,
        pnl,
        quantity,
        COUNT(*) as count
    FROM normalized
    GROUP BY normalized_ticker, exit_date, pnl, quantity
    HAVING COUNT(*) > 1
)
SELECT 
    'Found Duplicates' as status,
    COUNT(*) as duplicate_groups,
    SUM(count - 1) as trades_to_delete
FROM duplicates;


-- Step 3: List actual duplicates to delete
WITH normalized AS (
    SELECT 
        id,
        ticker,
        UPPER(
            TRIM(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(ticker, '\d{1,2}/\d{1,2}/\d{4}\s*', '', 'g'),
                        '\.00\s*', '', 'g'
                    ),
                    '\s+', ' ', 'g'
                )
            )
        ) AS normalized_ticker,
        exit_date::date,
        ROUND(pnl::numeric, 2) as pnl,
        quantity,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY 
                UPPER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(ticker, '\d{1,2}/\d{1,2}/\d{4}\s*', '', 'g'), '\.00\s*', '', 'g'), '\s+', ' ', 'g'))),
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
SELECT 
    id,
    ticker,
    normalized_ticker,
    exit_date,
    pnl,
    quantity,
    CASE WHEN row_num > 1 THEN 'DELETE' ELSE 'KEEP' END as action
FROM normalized
WHERE normalized_ticker IN (
    SELECT normalized_ticker FROM normalized GROUP BY normalized_ticker, exit_date, pnl, quantity HAVING COUNT(*) > 1
)
ORDER BY normalized_ticker, exit_date, row_num
LIMIT 100;


-- =====================================================
-- Step 4: DELETE DUPLICATES (after reviewing above)
-- =====================================================
-- UNCOMMENT TO RUN

/*
DELETE FROM trades
WHERE id IN (
    WITH normalized AS (
        SELECT 
            id,
            ticker,
            UPPER(
                TRIM(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(ticker, '\d{1,2}/\d{1,2}/\d{4}\s*', '', 'g'),
                            '\.00\s*', '', 'g'
                        ),
                        '\s+', ' ', 'g'
                    )
                )
            ) AS normalized_ticker,
            exit_date::date,
            ROUND(pnl::numeric, 2) as pnl,
            quantity,
            created_at,
            ROW_NUMBER() OVER (
                PARTITION BY 
                    UPPER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(ticker, '\d{1,2}/\d{1,2}/\d{4}\s*', '', 'g'), '\.00\s*', '', 'g'), '\s+', ' ', 'g'))),
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
    SELECT id FROM normalized WHERE row_num > 1
);
*/


-- Step 5: After cleanup, verify totals
-- Per CSV analysis:
-- Total rows in CSV: 280 (line 3 to 282)
-- Expected P&L should match your Schwab dashboard

SELECT 
    'After Cleanup Summary' as status,
    COUNT(*) as total_trades,
    ROUND(SUM(pnl)::numeric, 2) as total_pnl
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01';
