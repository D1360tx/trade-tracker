import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import type { Trade } from '../types';
import { useTrades } from '../context/TradeContext';
import { useStrategies } from '../context/StrategyContext';
import { useMistakes } from '../context/MistakeContext';

interface TradeDetailModalProps {
    trade: Trade;
    allTrades: Trade[];
    onClose: () => void;
    onNavigate?: (direction: 'prev' | 'next') => void;
}

const TradeDetailModal: React.FC<TradeDetailModalProps> = ({ trade, allTrades, onClose, onNavigate }) => {
    const { updateTrade } = useTrades();
    const { strategies } = useStrategies();
    const { mistakes } = useMistakes();

    // Local state for editing
    const [editedTrade, setEditedTrade] = useState<Trade>(trade);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Update when trade prop changes (navigation)
    useEffect(() => {
        setEditedTrade(trade);
        setHasChanges(false);
    }, [trade]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && onNavigate) {
                e.preventDefault();
                onNavigate('prev');
            } else if (e.key === 'ArrowRight' && onNavigate) {
                e.preventDefault();
                onNavigate('next');
            } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNavigate]);

    const handleFieldChange = (field: keyof Trade, value: any) => {
        setEditedTrade(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!hasChanges) return;

        setIsSaving(true);
        try {
            await updateTrade(editedTrade.id, editedTrade);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to save trade:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const isProfitable = editedTrade.pnl >= 0;
    const currentIndex = allTrades.findIndex(t => t.id === trade.id);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[var(--bg-secondary)] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-[var(--border)]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${isProfitable ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                            {isProfitable ?
                                <TrendingUp size={24} className="text-green-500" /> :
                                <TrendingDown size={24} className="text-red-500" />
                            }
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{editedTrade.ticker}</h2>
                            <p className="text-sm text-[var(--text-secondary)]">
                                {editedTrade.type} • {editedTrade.direction}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {hasChanges && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-colors disabled:opacity-50"
                            >
                                <Save size={16} />
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Entry Price */}
                        <div>
                            <label className="text-sm text-[var(--text-secondary)] mb-1 block">Entry Price</label>
                            <input
                                type="number"
                                step="0.01"
                                value={editedTrade.entryPrice}
                                onChange={(e) => handleFieldChange('entryPrice', parseFloat(e.target.value))}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>

                        {/* Exit Price */}
                        <div>
                            <label className="text-sm text-[var(--text-secondary)] mb-1 block">Exit Price</label>
                            <input
                                type="number"
                                step="0.01"
                                value={editedTrade.exitPrice}
                                onChange={(e) => handleFieldChange('exitPrice', parseFloat(e.target.value))}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="text-sm text-[var(--text-secondary)] mb-1 block">Quantity</label>
                            <input
                                type="number"
                                value={editedTrade.quantity}
                                onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value))}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>

                        {/* P&L */}
                        <div>
                            <label className="text-sm text-[var(--text-secondary)] mb-1 block">P&L</label>
                            <div className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 font-bold ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                                {isProfitable ? '+' : ''}${editedTrade.pnl.toFixed(2)}
                            </div>
                        </div>

                        {/* Entry Date */}
                        <div>
                            <label className="text-sm text-[var(--text-secondary)] mb-1 block">Entry Date</label>
                            <input
                                type="date"
                                value={editedTrade.entryDate}
                                onChange={(e) => handleFieldChange('entryDate', e.target.value)}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)] [color-scheme:dark]"
                            />
                        </div>

                        {/* Exit Date */}
                        <div>
                            <label className="text-sm text-[var(--text-secondary)] mb-1 block">Exit Date</label>
                            <input
                                type="date"
                                value={editedTrade.exitDate}
                                onChange={(e) => handleFieldChange('exitDate', e.target.value)}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)] [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {/* Strategy */}
                    <div className="mt-4">
                        <label className="text-sm text-[var(--text-secondary)] mb-1 block">Strategy</label>
                        <select
                            value={editedTrade.strategyId || ''}
                            onChange={(e) => handleFieldChange('strategyId', e.target.value || undefined)}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)]"
                        >
                            <option value="">No Strategy</option>
                            {strategies.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mistakes */}
                    <div className="mt-4">
                        <label className="text-sm text-[var(--text-secondary)] mb-1 block">Mistakes</label>
                        <div className="flex flex-wrap gap-2">
                            {mistakes.map(m => {
                                const isSelected = editedTrade.mistakes?.includes(m.id);
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            const current = editedTrade.mistakes || [];
                                            const updated = isSelected
                                                ? current.filter(id => id !== m.id)
                                                : [...current, m.id];
                                            handleFieldChange('mistakes', updated);
                                        }}
                                        className={`px-3 py-1 rounded-full text-sm transition-colors ${isSelected
                                                ? 'bg-red-500/20 text-red-500 border border-red-500'
                                                : 'bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]'
                                            }`}
                                    >
                                        {m.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-4">
                        <label className="text-sm text-[var(--text-secondary)] mb-1 block">Notes</label>
                        <textarea
                            value={editedTrade.notes || ''}
                            onChange={(e) => handleFieldChange('notes', e.target.value)}
                            rows={4}
                            className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)] resize-none"
                            placeholder="Add your trade notes here..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-[var(--border)] bg-[var(--bg-tertiary)]">
                    <div className="text-sm text-[var(--text-secondary)]">
                        {editedTrade.screenshotIds && editedTrade.screenshotIds.length > 0 && (
                            <span>{editedTrade.screenshotIds.length} screenshot(s)</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onNavigate?.('prev')}
                            disabled={currentIndex === 0}
                            className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm text-[var(--text-secondary)]">
                            {currentIndex + 1} / {allTrades.length}
                        </span>
                        <button
                            onClick={() => onNavigate?.('next')}
                            disabled={currentIndex === allTrades.length - 1}
                            className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TradeDetailModal;
