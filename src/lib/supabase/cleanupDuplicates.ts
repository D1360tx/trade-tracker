import { fetchTrades } from './trades';
import { supabase } from './client';

/**
 * ⚠️ TEMPORARY DEV TOOL - Remove before production!
 * See PRE_PRODUCTION_CHECKLIST.md
 * 
 * Clean up duplicate trades from database
 * Keeps the first occurrence, deletes duplicates based on fingerprint
 */
export const cleanupDuplicateTrades = async (): Promise<{ removed: number; kept: number }> => {
    console.log('[Cleanup] Fetching all trades to identify duplicates...');
    const allTrades = await fetchTrades();

    const seen = new Map<string, string>(); // fingerprint -> id to keep
    const toDelete: string[] = [];

    allTrades.forEach(trade => {
        const pnlRounded = Math.round((trade.pnl || 0) * 100) / 100;
        const exitDateStr = trade.exitDate ? trade.exitDate.split('T')[0] : '';
        const fingerprint = `${trade.exchange}|${trade.ticker}|${exitDateStr}|${pnlRounded}|${trade.quantity}`;

        if (seen.has(fingerprint)) {
            // Duplicate found - mark for deletion
            toDelete.push(trade.id);
            console.log('[Cleanup] Duplicate found:', trade.ticker, exitDateStr, trade.pnl);
        } else {
            // First occurrence - keep it
            seen.set(fingerprint, trade.id);
        }
    });

    if (toDelete.length === 0) {
        console.log('[Cleanup] No duplicates found!');
        return { removed: 0, kept: allTrades.length };
    }

    console.log(`[Cleanup] Deleting ${toDelete.length} duplicate trades...`);

    // Delete in batches of 50 to avoid timeout
    const batchSize = 50;
    for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const { error } = await supabase
            .from('trades')
            .delete()
            .in('id', batch);

        if (error) {
            console.error('[Cleanup] Error deleting batch:', error);
            throw error;
        }
        console.log(`[Cleanup] Deleted batch ${i / batchSize + 1} (${batch.length} trades)`);
    }

    console.log(`[Cleanup] ✅ Removed ${toDelete.length} duplicates, kept ${allTrades.length - toDelete.length} unique trades`);
    return { removed: toDelete.length, kept: allTrades.length - toDelete.length };
};
