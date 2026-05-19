import { useState, useMemo } from 'react';
import { useTrades } from '../context/useTrades';
import { Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../types';

type PendingAction =
    | { type: 'cleanup-duplicates'; title: string; description: string }
    | { type: 'delete-selected'; ids: string[]; title: string; description: string }
    | { type: 'delete-one'; id: string; title: string; description: string };

type ManagementStatus = {
    type: 'success' | 'error';
    message: string;
};

const TradeManagement = () => {
    const { trades, updateTrade, deleteTrades } = useTrades();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<Trade>>({});
    const [filterExchange, setFilterExchange] = useState<string>('ALL');
    const [showManagement, setShowManagement] = useState(false);
    const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [status, setStatus] = useState<ManagementStatus | null>(null);

    const requestCleanupDuplicates = () => {
        setStatus(null);
        setPendingAction({
            type: 'cleanup-duplicates',
            title: 'Clean duplicate trades',
            description: 'This permanently removes duplicate trades from the database while keeping one unique copy.',
        });
    };

    const handleConfirmAction = async () => {
        if (!pendingAction) return;

        if (pendingAction.type === 'cleanup-duplicates') {
            setIsCleaningDuplicates(true);
            setStatus(null);
            try {
                const { cleanupDuplicateTrades } = await import('../lib/supabase/cleanupDuplicates');
                const result = await cleanupDuplicateTrades();
                setStatus({
                    type: 'success',
                    message: `Cleanup complete. Removed ${result.removed} duplicate${result.removed === 1 ? '' : 's'} and kept ${result.kept} unique trade${result.kept === 1 ? '' : 's'}.`,
                });
            } catch (error: unknown) {
                setStatus({
                    type: 'error',
                    message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                });
                console.error(error);
            } finally {
                setIsCleaningDuplicates(false);
                setPendingAction(null);
            }
            return;
        }

        const idsToDelete = pendingAction.type === 'delete-selected' ? pendingAction.ids : [pendingAction.id];
        deleteTrades(idsToDelete);
        setSelectedIds(new Set());
        setStatus({
            type: 'success',
            message: `Deleted ${idsToDelete.length} trade${idsToDelete.length === 1 ? '' : 's'}.`,
        });
        setPendingAction(null);
    };


    // Get unique exchanges
    const exchanges = useMemo(() => {
        const uniqueExchanges = new Set(trades.map(t => t.exchange));
        return ['ALL', ...Array.from(uniqueExchanges).sort()];
    }, [trades]);

    // Filter trades by exchange and sort by date (newest first)
    const filteredTrades = useMemo(() => {
        const filtered = filterExchange === 'ALL'
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
        setStatus(null);
        setPendingAction({
            type: 'delete-selected',
            ids: Array.from(selectedIds),
            title: `Delete ${selectedIds.size} selected trade${selectedIds.size === 1 ? '' : 's'}`,
            description: 'This removes the selected trades from your tracker.',
        });
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

                        <button
                            onClick={requestCleanupDuplicates}
                            disabled={isCleaningDuplicates}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors ml-auto"
                            title="Remove duplicate trades from database"
                        >
                            <Sparkles size={16} className={isCleaningDuplicates ? 'animate-spin' : ''} />
                            {isCleaningDuplicates ? 'Cleaning...' : 'Clean Duplicates'}
                        </button>
                    </div>

                    {status && (
                        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${status.type === 'success'
                            ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]'
                            : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]'
                        }`}>
                            {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            <span>{status.message}</span>
                        </div>
                    )}

                    {pendingAction && (
                        <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-4">
                            <p className="font-semibold text-[var(--danger)]">{pendingAction.title}</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">{pendingAction.description}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={handleConfirmAction}
                                    disabled={isCleaningDuplicates}
                                    className="rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                                >
                                    {isCleaningDuplicates ? 'Working...' : 'Confirm'}
                                </button>
                                <button
                                    onClick={() => setPendingAction(null)}
                                    disabled={isCleaningDuplicates}
                                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

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
                                                                setStatus(null);
                                                                setPendingAction({
                                                                    type: 'delete-one',
                                                                    id: trade.id,
                                                                    title: `Delete ${trade.ticker} trade`,
                                                                    description: 'This removes the trade from your tracker.',
                                                                });
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
