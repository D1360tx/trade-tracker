import { X, TrendingUp, TrendingDown, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../types';

export type KPIModalType = 'best_trade' | 'worst_trade' | 'avg_win' | 'avg_loss' | 'max_drawdown' | 'expectancy';

interface KPIDetailModalProps {
    type: KPIModalType;
    trades: Trade[]; // The specific trades contributing to this metric (e.g., all winners for Avg Win)
    metrics?: {
        winRate?: number;
        avgWin?: number;
        lossRate?: number;
        avgLoss?: number;
        expectancy?: number;
        maxDrawdown?: number;
    };
    onClose: () => void;
}

const KPIDetailModal: React.FC<KPIDetailModalProps> = ({ type, trades, metrics, onClose }) => {

    // Config based on type
    const getConfig = () => {
        switch (type) {
            case 'best_trade':
                return {
                    title: 'Best Trades (Top Winners)',
                    description: 'Your most profitable trades',
                    accentClass: 'text-[var(--success)]',
                    bgClass: 'bg-[var(--success)]/10'
                };
            case 'worst_trade':
                return {
                    title: 'Worst Trades (Top Losers)',
                    description: 'Your biggest losses',
                    accentClass: 'text-[var(--danger)]',
                    bgClass: 'bg-[var(--danger)]/10'
                };
            case 'avg_win':
                return {
                    title: 'Average Win Composition',
                    description: `Based on ${trades.length} winning trades`,
                    accentClass: 'text-[var(--success)]',
                    bgClass: 'bg-[var(--success)]/10'
                };
            case 'avg_loss':
                return {
                    title: 'Average Loss Composition',
                    description: `Based on ${trades.length} losing trades`,
                    accentClass: 'text-[var(--danger)]',
                    bgClass: 'bg-[var(--danger)]/10'
                };
            case 'expectancy':
                return {
                    title: 'Expectancy Breakdown',
                    description: 'Expected value per trade based on historical performance',
                    accentClass: 'text-[var(--accent-primary)]',
                    bgClass: 'bg-[var(--accent-primary)]/10'
                };
            case 'max_drawdown':
                return {
                    title: 'Maximum Drawdown',
                    description: 'Largest peak-to-valley decline in account equity',
                    accentClass: 'text-[var(--danger)]',
                    bgClass: 'bg-[var(--danger)]/10'
                };
            default:
                return { title: 'Metric Details', description: '', accentClass: '', bgClass: '' };
        }
    };

    const config = getConfig();

    // Custom view for Expectancy
    if (type === 'expectancy' && metrics) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                <div className="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Target className={config.accentClass} size={24} />
                                {config.title}
                            </h3>
                            <p className="text-sm text-[var(--text-tertiary)]">{config.description}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Formula Visualization */}
                        <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center">
                            {/* Win Component */}
                            <div className="p-6 bg-[var(--success)]/5 border border-[var(--success)]/20 rounded-xl flex-1 w-full relative">
                                <div className="text-sm text-[var(--text-tertiary)] mb-2">Win Component</div>
                                <div className="text-2xl font-bold text-[var(--success)] mb-1">
                                    ${((metrics.winRate || 0) / 100 * (metrics.avgWin || 0)).toFixed(2)}
                                </div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    {(metrics.winRate || 0).toFixed(1)}% Win Rate × ${(metrics.avgWin || 0).toFixed(2)} Avg Win
                                </div>
                                <ArrowUpRight className="absolute top-4 right-4 text-[var(--success)]/20" size={40} />
                            </div>

                            <div className="text-2xl font-bold text-[var(--text-tertiary)]">-</div>

                            {/* Loss Component */}
                            <div className="p-6 bg-[var(--danger)]/5 border border-[var(--danger)]/20 rounded-xl flex-1 w-full relative">
                                <div className="text-sm text-[var(--text-tertiary)] mb-2">Loss Component</div>
                                <div className="text-2xl font-bold text-[var(--danger)] mb-1">
                                    ${((metrics.lossRate || 0) / 100 * (metrics.avgLoss || 0)).toFixed(2)}
                                </div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    {(metrics.lossRate || 0).toFixed(1)}% Loss Rate × ${(metrics.avgLoss || 0).toFixed(2)} Avg Loss
                                </div>
                                <ArrowDownRight className="absolute top-4 right-4 text-[var(--danger)]/20" size={40} />
                            </div>

                            <div className="text-2xl font-bold text-[var(--text-tertiary)]">=</div>

                            {/* Result */}
                            <div className="p-6 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl flex-1 w-full relative overflow-hidden">
                                <div className={`absolute inset-0 opacity-10 ${metrics.expectancy && metrics.expectancy > 0 ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`}></div>
                                <div className="text-sm text-[var(--text-tertiary)] mb-2">Expectancy</div>
                                <div className={`text-3xl font-bold mb-1 ${metrics.expectancy && metrics.expectancy > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    ${(metrics.expectancy || 0).toFixed(2)}
                                </div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                    per trade
                                </div>
                            </div>
                        </div>

                        <div className="text-center text-sm text-[var(--text-secondary)] max-w-lg mx-auto bg-[var(--bg-tertiary)]/50 p-4 rounded-lg">
                            <p>
                                For every trade you take, you can statistically expect to
                                <span className={metrics.expectancy && metrics.expectancy > 0 ? 'text-[var(--success)] font-bold' : 'text-[var(--danger)] font-bold'}>
                                    {metrics.expectancy && metrics.expectancy > 0 ? ' make ' : ' lose '}
                                    ${Math.abs(metrics.expectancy || 0).toFixed(2)}
                                </span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default List View
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                    <div>
                        <h3 className={`text-xl font-bold flex items-center gap-2 ${config.accentClass}`}>
                            {type === 'avg_win' || type === 'best_trade' ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                            {config.title}
                        </h3>
                        <p className="text-sm text-[var(--text-tertiary)]">{config.description}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Trade List */}
                <div className="overflow-y-auto flex-1 p-0">
                    <table className="w-full">
                        <thead className="bg-[var(--bg-tertiary)] sticky top-0 z-10">
                            <tr className="text-left text-xs text-[var(--text-tertiary)]">
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Symbol</th>
                                <th className="px-6 py-3">Type/Side</th>
                                <th className="px-6 py-3 text-right">Price</th>
                                <th className="px-6 py-3 text-right">Qty</th>
                                <th className="px-6 py-3 text-right">P&L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {trades.map(trade => (
                                <tr key={trade.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                                        <div className="font-medium">{format(parseISO(trade.exitDate), 'MMM dd')}</div>
                                        <div className="text-xs text-[var(--text-tertiary)]">{format(parseISO(trade.exitDate), 'HH:mm')}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-[var(--text-primary)]">{trade.ticker}</div>
                                        <div className="text-xs text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded inline-block mt-1">
                                            {trade.exchange}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm">{trade.type}</div>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${trade.direction === 'LONG'
                                                ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                                : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                            }`}>
                                            {trade.direction}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm">
                                        <div className="text-[var(--text-tertiary)]">In: {trade.entryPrice.toFixed(2)}</div>
                                        <div>Out: {trade.exitPrice.toFixed(2)}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-sm">
                                        {trade.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`text-base font-bold ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            ${trade.pnl.toFixed(2)}
                                        </div>
                                        {trade.pnlPercentage && (
                                            <div className={`text-xs ${trade.pnlPercentage >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                                {trade.pnlPercentage.toFixed(2)}%
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {trades.length === 0 && (
                        <div className="p-8 text-center text-[var(--text-tertiary)]">
                            No trades found for this metric.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KPIDetailModal;
