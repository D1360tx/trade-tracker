-- =====================================================
-- NUCLEAR OPTION: DELETE ALL 2025 SCHWAB TRADES
-- =====================================================
-- Since deduplication isn't working, we'll:
-- 1. Delete ALL 2025 Schwab trades
-- 2. You'll reimport from the CSV file
-- =====================================================

-- Step 1: PREVIEW - Count what will be deleted
SELECT 
    'Will Delete' as action,
    COUNT(*) as trade_count,
    ROUND(SUM(pnl)::numeric, 2) as total_pnl,
    MIN(exit_date::date) as earliest,
    MAX(exit_date::date) as latest
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01';


-- =====================================================
-- Step 2: DELETE ALL 2025 SCHWAB TRADES
-- =====================================================
-- UNCOMMENT THE LINE BELOW TO RUN:

-- DELETE FROM trades WHERE exchange = 'Schwab' AND exit_date >= '2025-01-01' AND exit_date < '2026-01-01';


-- Step 3: Verify deletion
SELECT 
    'After Delete' as status,
    COUNT(*) as remaining_2025_schwab
FROM trades
WHERE exchange = 'Schwab'
AND exit_date >= '2025-01-01'
AND exit_date < '2026-01-01';

-- Should show 0 remaining

-- =====================================================
-- NEXT STEPS:
-- =====================================================
-- After running the delete:
-- 1. Go to your app's Journal page
-- 2. Click "Import CSV" 
-- 3. Select the file: all2025_IC_-_Main_GainLoss_Realized_Details_20260115-130158.csv
-- 4. This will import 279 clean trades with -$1,014.14 P&L
-- =====================================================
