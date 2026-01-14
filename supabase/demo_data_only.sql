-- DEMO DATA ONLY
-- First, sign up normally at your app with:
--   Email: demo@tradetracker.app
--   Password: demo123
-- 
-- Then, run this script to populate demo data
-- Replace 'd4674e2d-2887-49b5-8766-45794d6a3599' with the actual user ID

DO $$
DECLARE
    demo_user_id uuid := 'd4674e2d-2887-49b5-8766-45794d6a3599'::uuid; -- REPLACE THIS
    strategy_momentum_id uuid;
    strategy_breakout_id uuid;
    strategy_scalp_id uuid;
    mistake_fomo_id uuid;
    mistake_sized_id uuid;
BEGIN
    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_user_id) THEN
        RAISE EXCEPTION 'User with ID % not found. Please create the user first through sign-up.', demo_user_id;
    END IF;

    -- Create demo strategies (one at a time to capture IDs)
    INSERT INTO strategies (user_id, name, description, color)
    VALUES (demo_user_id, 'Momentum Trading', 'Following strong price momentum with volume confirmation', '#3b82f6')
    ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
    RETURNING id INTO strategy_momentum_id;

    INSERT INTO strategies (user_id, name, description, color)
    VALUES (demo_user_id, 'Breakout Strategy', 'Trading breakouts above key resistance levels', '#10b981')
    ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
    RETURNING id INTO strategy_breakout_id;

    INSERT INTO strategies (user_id, name, description, color)
    VALUES (demo_user_id, 'Scalping', 'Quick in-and-out trades for small profits', '#f59e0b')
    ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
    RETURNING id INTO strategy_scalp_id;

    -- Create demo mistakes (one at a time to capture IDs)
    INSERT INTO mistakes (user_id, name, description, color)
    VALUES (demo_user_id, 'FOMO Entry', 'Entered trade due to fear of missing out, not following plan', '#ef4444')
    ON CONFLICT (user_id, name) DO UPDATE SET description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO mistake_fomo_id;

    INSERT INTO mistakes (user_id, name, description, color)
    VALUES (demo_user_id, 'Over-sized Position', 'Position size too large relative to account', '#f97316')
    ON CONFLICT (user_id, name) DO UPDATE SET description = EXCLUDED.description, color = EXCLUDED.color
    RETURNING id INTO mistake_sized_id;

    -- Delete existing demo trades (for fresh start)
    DELETE FROM trades WHERE user_id = demo_user_id;

    -- Insert demo trades
    INSERT INTO trades (user_id, ticker, exchange, type, direction, quantity, entry_price, exit_price, entry_date, exit_date, pnl, pnl_percentage, fees, status, strategy_id, notes)
    VALUES
    -- Big winners
    (demo_user_id, 'TSLA 250C 01/17/26', 'Schwab', 'OPTION', 'LONG', 5, 12.50, 18.75, '2026-01-13 09:30:00', '2026-01-13 14:30:00', 3125.00, 50.00, 6.50, 'CLOSED', strategy_momentum_id, 'Strong momentum on earnings run-up. Clean breakout above $240.'),
    (demo_user_id, 'NVDA', 'Schwab', 'STOCK', 'LONG', 100, 142.50, 148.20, '2026-01-12 10:00:00', '2026-01-12 15:45:00', 570.00, 4.00, 2.00, 'CLOSED', strategy_breakout_id, 'Gap up and go pattern. Sold at resistance.'),
    (demo_user_id, 'AAPL 220P 01/24/26', 'Schwab', 'OPTION', 'LONG', 10, 3.20, 5.80, '2026-01-08 11:00:00', '2026-01-10 13:30:00', 2600.00, 81.25, 8.00, 'CLOSED', strategy_momentum_id, 'Bearish divergence on hourly. Took profit at support.'),
    (demo_user_id, 'BTCUSDT', 'MEXC', 'CRYPTO', 'LONG', 0.5, 94500.00, 96800.00, '2026-01-11 08:00:00', '2026-01-11 22:15:00', 1150.00, 2.43, 12.00, 'CLOSED', strategy_scalp_id, 'Clean bounce off 94k support. Quick scalp.'),
    (demo_user_id, 'ETHUSDT', 'MEXC', 'CRYPTO', 'LONG', 5, 3280.00, 3445.00, '2026-01-09 14:30:00', '2026-01-10 09:20:00', 825.00, 5.03, 8.50, 'CLOSED', strategy_momentum_id, 'Following BTC strength. Good R:R setup.'),
    
    -- Losers (for realism)
    (demo_user_id, 'SPY 580P 01/17/26', 'Schwab', 'OPTION', 'LONG', 10, 4.50, 2.10, '2026-01-07 14:00:00', '2026-01-08 10:30:00', -2400.00, -53.33, 8.00, 'CLOSED', NULL, 'FOMO trade on market dip. Reversed quickly. Mistake: entered without confirmation.'),
    (demo_user_id, 'MSFT', 'Schwab', 'STOCK', 'LONG', 50, 428.50, 425.80, '2026-01-06 10:15:00', '2026-01-06 15:00:00', -135.00, -0.63, 1.50, 'CLOSED', strategy_breakout_id, 'False breakout. Cut loss quickly.'),
    (demo_user_id, 'SOLUSDT', 'MEXC', 'CRYPTO', 'SHORT', 100, 142.50, 148.20, '2026-01-05 18:00:00', '2026-01-06 03:30:00', -570.00, -4.00, 15.00, 'CLOSED', NULL, 'Oversized position. Got squeezed on bounce. Mistake: position too large.'),
    
    -- More winners
    (demo_user_id, 'AMD', 'Schwab', 'STOCK', 'LONG', 200, 138.25, 142.80, '2026-01-02 09:45:00', '2026-01-03 14:20:00', 910.00, 3.29, 2.50, 'CLOSED', strategy_breakout_id, 'Sector rotation into semis. Clean trend.'),
    (demo_user_id, 'GOOGL 175C 01/31/26', 'Schwab', 'OPTION', 'LONG', 8, 6.20, 9.50, '2025-12-30 10:30:00', '2026-01-02 15:00:00', 2640.00, 53.23, 7.50, 'CLOSED', strategy_momentum_id, 'Year-end rally continuation. Nice move.'),
    (demo_user_id, 'META', 'Schwab', 'STOCK', 'LONG', 75, 612.50, 628.40, '2025-12-28 11:00:00', '2025-12-31 13:45:00', 1192.50, 2.60, 2.00, 'CLOSED', strategy_breakout_id, 'Santa rally. Held through EOY.'),
    (demo_user_id, 'BTCUSDT', 'MEXC', 'CRYPTO', 'LONG', 0.3, 93200.00, 94500.00, '2025-12-27 16:20:00', '2025-12-27 21:10:00', 390.00, 1.39, 5.00, 'CLOSED', strategy_scalp_id, 'Quick bounce trade on dip.'),
    (demo_user_id, 'DIS', 'Schwab', 'STOCK', 'LONG', 100, 98.50, 95.20, '2025-12-20 10:00:00', '2025-12-23 14:30:00', -330.00, -3.35, 2.00, 'CLOSED', NULL, 'Weak guidance disappointed. Cut at support break.'),
    (demo_user_id, 'XRPUSDT', 'MEXC', 'CRYPTO', 'LONG', 500, 2.12, 2.38, '2025-12-18 12:00:00', '2025-12-21 08:30:00', 130.00, 12.26, 3.50, 'CLOSED', strategy_momentum_id, 'Altcoin season trade. Good momentum.'),
    (demo_user_id, 'NFLX 880P 12/27/25', 'Schwab', 'OPTION', 'LONG', 5, 8.50, 14.20, '2025-12-16 13:30:00', '2025-12-19 11:00:00', 2850.00, 67.06, 6.00, 'CLOSED', strategy_momentum_id, 'Overbought on daily. Nice fade.');

    -- Tag mistakes
    UPDATE trades SET mistakes = ARRAY[mistake_fomo_id] 
    WHERE user_id = demo_user_id AND ticker = 'SPY 580P 01/17/26';
    
    UPDATE trades SET mistakes = ARRAY[mistake_sized_id]
    WHERE user_id = demo_user_id AND ticker = 'SOLUSDT' AND direction = 'SHORT';

    RAISE NOTICE '✅ Demo data created successfully! 15 trades, 3 strategies, 2 mistakes added.';
END $$;
