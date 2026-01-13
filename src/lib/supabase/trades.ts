import { supabase } from './client';
import type { Database } from './database.types';
import type { Trade } from '../../types';

type TradeRow = Database['public']['Tables']['trades']['Row'];
type TradeInsert = Database['public']['Tables']['trades']['Insert'];
type TradeUpdate = Database['public']['Tables']['trades']['Update'];

/**
 * Fetch all trades for the current user
 */
export const fetchTrades = async (): Promise<Trade[]> => {
    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('exit_date', { ascending: false });

    if (error) {
        console.error('Error fetching trades:', error);
        throw error;
    }

    return mapDbTradesToApp(data || []);
};

/**
 * Insert new trades (with deduplication)
 */
export const insertTrades = async (trades: Trade[]): Promise<Trade[]> => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch existing trades to check for duplicates
    const existing = await fetchTrades();

    // Create fingerprint map for fast lookup
    const existingFingerprints = new Set<string>();
    existing.forEach(t => {
        // Fingerprint: exchange|ticker|exitDate|pnl|quantity
        const pnlRounded = Math.round((t.pnl || 0) * 100) / 100;
        const exitDateStr = t.exitDate ? t.exitDate.split('T')[0] : '';
        const fingerprint = `${t.exchange}|${t.ticker}|${exitDateStr}|${pnlRounded}|${t.quantity}`;
        existingFingerprints.add(fingerprint);

        // Also track by external_oid if available
        if (t.externalOid) {
            existingFingerprints.add(`${t.exchange}|${t.externalOid}`);
        }
    });

    // Filter out duplicates
    const uniqueTrades = trades.filter(trade => {
        const pnlRounded = Math.round((trade.pnl || 0) * 100) / 100;
        const exitDateStr = trade.exitDate ? trade.exitDate.split('T')[0] : '';
        const fingerprint = `${trade.exchange}|${trade.ticker}|${exitDateStr}|${pnlRounded}|${trade.quantity}`;

        if (existingFingerprints.has(fingerprint)) return false;

        if (trade.externalOid && existingFingerprints.has(`${trade.exchange}|${trade.externalOid}`)) {
            return false;
        }

        return true;
    });

    if (uniqueTrades.length === 0) {
        console.log('[insertTrades] All trades are duplicates, skipping insert');
        return [];
    }

    console.log(`[insertTrades] Inserting ${uniqueTrades.length} new trades (${trades.length - uniqueTrades.length} duplicates skipped)`);

    const dbTrades: TradeInsert[] = uniqueTrades.map(trade => ({
        ...mapAppTradeToDb(trade) as TradeInsert,
        user_id: user.id
    }));

    const { data, error } = await supabase
        .from('trades')
        .insert(dbTrades as any)
        .select();

    if (error) {
        console.error('Error inserting trades:', error);
        throw error;
    }

    return mapDbTradesToApp(data || []);
};

/**
 * Update existing trade
 */
export const updateTrade = async (id: string, updates: Partial<Trade>): Promise<Trade> => {
    const dbUpdates: TradeUpdate = mapAppTradeToDb(updates as Trade);

    const { data, error } = await supabase
        .from('trades')
        // @ts-ignore - Supabase type inference issue
        .update(dbUpdates as any)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating trade:', error);
        throw error;
    }

    return mapDbTradeToApp(data);
};

/**
 * Delete trade
 */
export const deleteTrade = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting trade:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time trade changes
 */
export const subscribeTrades = (
    onInsert: (trade: Trade) => void,
    onUpdate: (trade: Trade) => void,
    onDelete: (id: string) => void
) => {
    const channel = supabase
        .channel('trades_changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'trades'
            },
            (payload) => {
                onInsert(mapDbTradeToApp(payload.new as TradeRow));
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'trades'
            },
            (payload) => {
                onUpdate(mapDbTradeToApp(payload.new as TradeRow));
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'trades'
            },
            (payload) => {
                onDelete((payload.old as TradeRow).id);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// =====================================================
// MAPPING FUNCTIONS (DB <-> App)
// =====================================================

/**
 * Map database trade to app Trade type
 */
function mapDbTradeToApp(dbTrade: TradeRow): Trade {
    return {
        id: dbTrade.id,
        exchange: dbTrade.exchange as any,
        ticker: dbTrade.ticker,
        type: dbTrade.type as any,
        direction: dbTrade.direction as 'LONG' | 'SHORT',
        entryPrice: Number(dbTrade.entry_price),
        exitPrice: Number(dbTrade.exit_price),
        quantity: Number(dbTrade.quantity),
        entryDate: dbTrade.entry_date,
        exitDate: dbTrade.exit_date,
        status: dbTrade.status as 'OPEN' | 'CLOSED',
        pnl: Number(dbTrade.pnl),
        pnlPercentage: Number(dbTrade.pnl_percentage),
        fees: Number(dbTrade.fees),
        notes: dbTrade.notes || undefined,
        strategyId: dbTrade.strategy_id || undefined,
        mistakes: dbTrade.mistakes || undefined,
        initialRisk: dbTrade.initial_risk ? Number(dbTrade.initial_risk) : undefined,
        leverage: dbTrade.leverage ? Number(dbTrade.leverage) : undefined,
        notional: dbTrade.notional ? Number(dbTrade.notional) : undefined,
        margin: dbTrade.margin ? Number(dbTrade.margin) : undefined,
        isBot: dbTrade.is_bot || undefined,
        externalOid: dbTrade.external_oid || undefined,
    };
}

/**
 * Map multiple database trades
 */
function mapDbTradesToApp(dbTrades: TradeRow[]): Trade[] {
    return dbTrades.map(mapDbTradeToApp);
}

/**
 * Map app Trade to database format
 */
function mapAppTradeToDb(trade: Partial<Trade>): TradeInsert | TradeUpdate {
    const dbTrade: any = {};

    // Map all fields
    // ID handling: Only pass ID if it's a valid UUID. Otherwise treat it as external_oid.
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trade.id || '');

    if (trade.id && isUUID) {
        dbTrade.id = trade.id;
    } else if (trade.id) {
        // If not a UUID (e.g. exchange numeric ID), map to external_oid if not already set
        if (!trade.externalOid) {
            dbTrade.external_oid = trade.id;
        }
    }

    if (trade.exchange) dbTrade.exchange = trade.exchange;
    if (trade.ticker) dbTrade.ticker = trade.ticker;
    if (trade.type) dbTrade.type = trade.type;
    if (trade.direction) dbTrade.direction = trade.direction;
    if (trade.entryPrice !== undefined) dbTrade.entry_price = trade.entryPrice;
    if (trade.exitPrice !== undefined) dbTrade.exit_price = trade.exitPrice;
    if (trade.quantity !== undefined) dbTrade.quantity = trade.quantity;
    if (trade.entryDate) dbTrade.entry_date = trade.entryDate;
    if (trade.exitDate) dbTrade.exit_date = trade.exitDate;
    if (trade.status) dbTrade.status = trade.status;
    if (trade.pnl !== undefined) dbTrade.pnl = trade.pnl;
    if (trade.pnlPercentage !== undefined) dbTrade.pnl_percentage = trade.pnlPercentage;
    if (trade.fees !== undefined) dbTrade.fees = trade.fees;
    if (trade.notes !== undefined) dbTrade.notes = trade.notes;
    if (trade.strategyId !== undefined) dbTrade.strategy_id = trade.strategyId;
    if (trade.mistakes !== undefined) dbTrade.mistakes = trade.mistakes;
    if (trade.initialRisk !== undefined) dbTrade.initial_risk = trade.initialRisk;
    if (trade.leverage !== undefined) dbTrade.leverage = trade.leverage;
    if (trade.notional !== undefined) dbTrade.notional = trade.notional;
    if (trade.margin !== undefined) dbTrade.margin = trade.margin;
    if (trade.isBot !== undefined) dbTrade.is_bot = trade.isBot;

    // Explicit externalOid takes precedence over mapped ID
    if (trade.externalOid !== undefined) dbTrade.external_oid = trade.externalOid;

    // user_id will be automatically set by RLS/triggers if needed
    // For inserts, we need to get it from auth
    return dbTrade;
}
