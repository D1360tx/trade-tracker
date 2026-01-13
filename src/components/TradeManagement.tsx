import { useState, useMemo } from 'react';
import { useTrades } from '../context/TradeContext';
import { Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../types';

const TradeManagement = () => {
    const { trades, updateTrade, deleteTrades } = useTrades();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<Trade>>({});
    const [filterExchange, setFilterExchange] = useState<string>('ALL');
    const [showManagement, setShowManagement] = useState(false);
    const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

    // ⚠️ TEMPORARY DEV TOOL - Remove before production!
    const handleCleanupDuplicates = async () => {
        if (!confirm('Clean up duplicate trades in database? This will permanently delete duplicates.')) return;

        setIsCleaningDuplicates(true);
        try {
            const { cleanupDuplicateTrades } = await import('../lib/supabase/cleanupDuplicates');
            const result = await cleanupDuplicateTrades();
            alert(`✅ Cleanup complete!\n\nRemoved: ${result.removed} duplicates\nKept: ${result.kept} unique trades`);
            // Reload page to refresh data
            window.location.reload();
        } catch (error: any) {
            alert(`❌ Cleanup failed: ${error.message}`);
            console.error(error);
        } finally {
            setIsCleaningDuplicates(false);
        }
    };


    // Get unique exchanges
    const exchanges = useMemo(() => {
        const uniqueExchanges = new Set(trades.map(t => t.exchange));
        return ['ALL', ...Array.from(uniqueExchanges).sort()];
    }, [trades]);

    // Filter trades by exchange and sort by date (newest first)
    const filteredTrades = useMemo(() => {
        let filtered = filterExchange === 'ALL'
            ? trades
            : trades.filter(t => t.exchange === filterExchange);

        return filtered.sort((a, b) =>
            new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
        );
    }, [trades, filterExchange]);

    const handleSelectAll = () => {
        if (selectedIds.size === filteredTrades.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredTrades.map(t => t.id)));
        }
    };

    const handleSelectOne = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        if (confirm(`Delete ${selectedIds.size} trade(s)? This cannot be undone.`)) {
            deleteTrades(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const handleStartEdit = (trade: Trade) => {
        setEditingId(trade.id);
        setEditValues({
            ticker: trade.ticker,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            quantity: trade.quantity,
            pnl: trade.pnl,
            fees: trade.fees,
            notes: trade.notes
        });
    };

    const handleSaveEdit = () => {
        if (editingId) {
            // Recalculate P&L percentage if prices changed
            if (editValues.entryPrice && editValues.quantity && editValues.pnl !== undefined) {
                const entryValue = editValues.entryPrice * editValues.quantity;
                const pnlPercentage = entryValue > 0 ? (editValues.pnl / entryValue) * 100 : 0;
                updateTrade(editingId, { ...editValues, pnlPercentage });
            } else {
                updateTrade(editingId, editValues);
            }
            setEditingId(null);
            setEditValues({});
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValues({});
    };

    if (trades.length === 0) {
        return null;
    }

    return (
        <div className="glass-panel p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">Manage Trades</h3>
                    <span className="text-sm text-[var(--text-tertiary)]">
                        ({filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''})
                    </span>
                </div>
                <button
                    onClick={() => setShowManagement(!showManagement)}
                    className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    {showManagement ? (
                        <>
                            <ChevronUp size={16} />
                            Hide
                        </>
                    ) : (
                        <>
                            <ChevronDown size={16} />
                            Show
                        </>
                    )}
                </button>
            </div>

            {showManagement && (
                <>
                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-[var(--bg-tertiary)]/50 rounded-lg">
                        <select
                            value={filterExchange}
                            onChange={(e) => setFilterExchange(e.target.value)}
                            className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--accent-primary)]"
                        >
                            {exchanges.map(ex => (
                                <option key={ex} value={ex}>{ex === 'ALL' ? 'All Exchanges' : ex}</option>
                            ))}
                        </select>

                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleDeleteSelected}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--danger)] hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Trash2 size={16} />
                                Delete {selectedIds.size} Selected
                            </button>
                        )}

                        {/* ⚠️ TEMPORARY DEV TOOL - Remove before production! */}
                        <button
                            onClick={handleCleanupDuplicates}
                            disabled={isCleaningDuplicates}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors ml-auto"
                            title="Remove duplicate trades from database"
                        >
                            <Sparkles size={16} className={isCleaningDuplicates ? 'animate-spin' : ''} />
                            {isCleaningDuplicates ? 'Cleaning...' : 'Clean Duplicates'}
                        </button>
                    </div>

                    {/* Trade List */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                                <tr className="text-left text-xs text-[var(--text-tertiary)]">
                                    <th className="px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredTrades.length && filteredTrades.length > 0}
                                            onChange={handleSelectAll}
                                            className="cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2">Exchange</th>
                                    <th className="px-3 py-2">Symbol</th>
                                    <th className="px-3 py-2 text-right">Entry</th>
                                    <th className="px-3 py-2 text-right">Exit</th>
                                    <th className="px-3 py-2 text-right">Qty</th>
                                    <th className="px-3 py-2 text-right">P&L</th>
                                    <th className="px-3 py-2 text-right">Fees</th>
                                    <th className="px-3 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {filteredTrades.map(trade => (
                                    <tr
                                        key={trade.id}
                                        className={`hover:bg-[var(--bg-tertiary)]/30 ${selectedIds.has(trade.id) ? 'bg-[var(--accent-primary)]/5' : ''}`}
                                    >
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(trade.id)}
                                                onChange={() => handleSelectOne(trade.id)}
                                                className="cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                                            {format(parseISO(trade.exitDate), 'MMM dd, HH:mm')}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] rounded">
                                                {trade.exchange}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {editingId === trade.id ? (
                                                <input
                                                    type="text"
                                                    value={editValues.ticker || ''}
                                                    onChange={(e) => setEditValues(v => ({ ...v, ticker: e.target.value }))}
                                                    className="w-20 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs"
                                                />
                                            ) : (
                                                <span className="font-medium">{trade.ticker}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            {editingId === trade.id ? (
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    value={editValues.entryPrice || ''}
                                                    onChange={(e) => setEditValues(v => ({ ...v, entryPrice: parseFloat(e.target.value) }))}
                                                    className="w-24 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs text-right"
                                                />
                                            ) : (
                                                `$${trade.entryPrice.toFixed(2)}`
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">
                                            {editingId === trade.id ? (
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    value={editValues.exitPrice || ''}
                                                    onChange={(e) => setEditValues(v => ({ ...v, exitPrice: parseFloat(e.target.value) }))}
                                                    className="w-24 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs text-right"
                                                />
                                            ) : (
                                                `$${trade.exitPrice.toFixed(2)}`
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {editingId === trade.id ? (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.quantity || ''}
                                                    onChange={(e) => setEditValues(v => ({ ...v, quantity: parseFloat(e.target.value) }))}
                                                    className="w-20 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs text-right"
                                                />
                                            ) : (
                                                trade.quantity.toFixed(2)
                                            )}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            {editingId === trade.id ? (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValues.pnl ?? ''}
                                                    onChange={(e) => setEditValues(v => ({ ...v, pnl: parseFloat(e.target.value) }))}
                                                    className="w-24 px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs text-right"
                                                />
                                            ) : (
                                                `$${trade.pnl.toFixed(2)}`
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-[var(--text-tertiary)]">
                                            ${trade.fees?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-1">
                                                {editingId === trade.id ? (
                                                    <>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            className="p-1 text-[var(--success)] hover:bg-[var(--success)]/10 rounded"
                                                            title="Save"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="p-1 text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded"
                                                            title="Cancel"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleStartEdit(trade)}
                                                            className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Delete ${trade.ticker} trade?`)) {
                                                                    deleteTrades([trade.id]);
                                                                }
                                                            }}
                                                            className="p-1 text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredTrades.length === 0 && (
                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                            No trades found for {filterExchange}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TradeManagement;
