import { supabase } from '../lib/supabase/client';
import { insertTrades } from '../lib/supabase/trades';
import { insertStrategy } from '../lib/supabase/strategies';
import { insertMistake } from '../lib/supabase/mistakes';
import type { Trade, Strategy, Mistake } from '../types';

/**
 * Migrate data from localStorage to Supabase
 */
export const migrateFromLocalStorage = async () => {
    console.log('[Migration] Starting localStorage -> Supabase migration');

    try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('User must be logged in to migrate data');
        }

        const results = {
            trades: 0,
            strategies: 0,
            mistakes: 0,
            errors: [] as string[]
        };

        // 1. Migrate Trades
        try {
            const tradesJSON = localStorage.getItem('trade_tracker_trades');
            if (tradesJSON) {
                const trades: Trade[] = JSON.parse(tradesJSON);
                console.log(`[Migration] Found ${trades.length} trades in localStorage`);

                if (trades.length > 0) {
                    await insertTrades(trades);
                    results.trades = trades.length;
                    console.log(`[Migration] ✅ Migrated ${trades.length} trades`);
                }
            }
        } catch (error: any) {
            console.error('[Migration] Error migrating trades:', error);
            results.errors.push(`Trades: ${error.message}`);
        }

        // 2. Migrate Strategies
        try {
            const strategiesJSON = localStorage.getItem('trade_tracker_strategies');
            if (strategiesJSON) {
                const strategies: Strategy[] = JSON.parse(strategiesJSON);
                console.log(`[Migration] Found ${strategies.length} strategies in localStorage`);

                for (const strategy of strategies) {
                    await insertStrategy(strategy);
                    results.strategies++;
                }
                console.log(`[Migration] ✅ Migrated ${strategies.length} strategies`);
            }
        } catch (error: any) {
            console.error('[Migration] Error migrating strategies:', error);
            results.errors.push(`Strategies: ${error.message}`);
        }

        // 3. Migrate Mistakes
        try {
            const mistakesJSON = localStorage.getItem('trade_tracker_mistakes');
            if (mistakesJSON) {
                const mistakes: Mistake[] = JSON.parse(mistakesJSON);
                console.log(`[Migration] Found ${mistakes.length} mistakes in localStorage`);

                for (const mistake of mistakes) {
                    await insertMistake(mistake);
                    results.mistakes++;
                }
                console.log(`[Migration] ✅ Migrated ${mistakes.length} mistakes`);
            }
        } catch (error: any) {
            console.error('[Migration] Error migrating mistakes:', error);
            results.errors.push(`Mistakes: ${error.message}`);
        }

        console.log('[Migration] Migration complete:', results);
        return results;

    } catch (error) {
        console.error('[Migration] Fatal error:', error);
        throw error;
    }
};

/**
 * Clear localStorage data after successful migration
 */
export const clearLocalStorageData = () => {
    const keys = ['trade_tracker_trades', 'trade_tracker_strategies', 'trade_tracker_mistakes'];
    keys.forEach(key => localStorage.removeItem(key));
    console.log('[Migration] Cleared localStorage data');
};
