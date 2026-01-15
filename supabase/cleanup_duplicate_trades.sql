-- =====================================================
-- CLEANUP DUPLICATE SCHWAB TRADES
-- =====================================================
-- This script identifies and removes duplicate trades that were imported
-- with different ticker formats (e.g., "SPXW 6550P" vs "SPXW 11/24/2025 6550.00 P")
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- =====================================================

-- Step 1: View duplicates BEFORE deleting (dry run)
-- This shows which trades would be deleted
WITH normalized_trades AS (
    SELECT 
        id,
        user_id,
        exchange,
        ticker,
        -- Normalize ticker: remove date patterns and .00 suffixes
        UPPER(
            TRIM(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(ticker, '\d{1,2}/\d{1,2}/\d{4}\s*', '', 'g'),  -- Remove dates
                        '\.00\s*', '', 'g'  -- Remove .00
                    ),
                    '\s+', ' ', 'g'  -- Normalize spaces
                )
            )
        ) AS normalized_ticker,
        exit_date::date AS exit_date,
        ROUND(pnl::numeric, 2) AS pnl_rounded,
        quantity,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY 
                user_id,
                exchange,
                -- Normalized ticker for grouping
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
                ),
                exit_date::date,
                ROUND(pnl::numeric, 2),
                quantity
            ORDER BY created_at ASC  -- Keep the oldest (first imported)
        ) AS row_num
    FROM trades
    WHERE exchange = 'Schwab'
)
SELECT 
    id,
    ticker,
    normalized_ticker,
    exit_date,
    pnl_rounded,
    quantity,
    row_num,
    CASE WHEN row_num > 1 THEN '🗑️ WILL DELETE' ELSE '✅ KEEP' END AS action
FROM normalized_trades
WHERE normalized_ticker IN (
    SELECT normalized_ticker 
    FROM normalized_trades 
    GROUP BY user_id, normalized_ticker, exit_date, pnl_rounded, quantity
    HAVING COUNT(*) > 1
)
ORDER BY normalized_ticker, exit_date, row_num;

-- =====================================================
-- Step 2: ACTUALLY DELETE the duplicates
-- =====================================================
-- UNCOMMENT THE SECTION BELOW AFTER REVIEWING THE DRY RUN ABOVE
-- =====================================================

/*
-- Delete duplicate Schwab trades, keeping the oldest (first imported) version
DELETE FROM trades
WHERE id IN (
    WITH normalized_trades AS (
        SELECT 
            id,
            user_id,
            exchange,
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
            exit_date::date AS exit_date,
            ROUND(pnl::numeric, 2) AS pnl_rounded,
            quantity,
            created_at,
            ROW_NUMBER() OVER (
                PARTITION BY 
                    user_id,
                    exchange,
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
                    ),
                    exit_date::date,
                    ROUND(pnl::numeric, 2),
                    quantity
                ORDER BY created_at ASC
            ) AS row_num
        FROM trades
        WHERE exchange = 'Schwab'
    )
    SELECT id FROM normalized_trades WHERE row_num > 1
);
*/

-- =====================================================
-- Step 3: Verify the cleanup (run after deletion)
-- =====================================================
-- After running the delete, run this to verify no duplicates remain:
/*
SELECT 
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
    ROUND(pnl::numeric, 2) AS pnl,
    quantity,
    COUNT(*) as count
FROM trades
WHERE exchange = 'Schwab'
GROUP BY 1, 2, 3, 4
HAVING COUNT(*) > 1
ORDER BY count DESC;
*/
-- If this returns 0 rows, all duplicates have been removed!
