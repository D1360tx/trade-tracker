import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../types';

interface DayDetailModalProps {
    date: string;
    trades: Trade[];
    onClose: () => void;
}

const DayDetailModal: React.FC<DayDetailModalProps> = ({ date, trades, onClose }) => {
    const dayTrades = trades
        .filter(t => format(parseISO(t.exitDate), 'yyyy-MM-dd') === date)
        .sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());

    const dayPnL = dayTrades.reduce((acc, t) => acc + t.pnl, 0);
    const dayWins = dayTrades.filter(t => t.pnl > 0).length;
    const dayLosses = dayTrades.filter(t => t.pnl < 0).length;
    const dayWinRate = dayTrades.length > 0 ? (dayWins / dayTrades.length * 100) : 0;
    const dayFees = dayTrades.reduce((acc, t) => acc + (t.fees || 0), 0);
    const formattedDate = format(parseISO(date), 'EEEE, MMMM d, yyyy');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <div>
                        <h3 className="text-xl font-bold">{formattedDate}</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            {dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''} • {dayWinRate.toFixed(0)}% win rate
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Stats Summary */}
                <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-tertiary)]/30">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">P&L</p>
                            <p className={`text-xl font-bold ${dayPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                ${dayPnL.toFixed(2)}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Wins</p>
                            <p className="text-xl font-bold text-[var(--success)]">{dayWins}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Losses</p>
                            <p className="text-xl font-bold text-[var(--danger)]">{dayLosses}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-[var(--text-tertiary)] mb-1">Fees</p>
                            <p className="text-xl font-bold text-[var(--text-secondary)]">${dayFees.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                {/* Trade List */}
                <div className="overflow-y-auto max-h-[400px]">
                    <table className="w-full">
                        <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                            <tr className="text-left text-xs text-[var(--text-tertiary)]">
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">Symbol</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Direction</th>
                                <th className="px-6 py-3 text-right">P&L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {dayTrades.map(trade => (
                                <tr key={trade.id} className="hover:bg-[var(--bg-tertiary)]/50">
                                    <td className="px-6 py-3 text-sm text-[var(--text-secondary)]">
                                        {format(parseISO(trade.exitDate), 'HH:mm')}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="font-medium">{trade.ticker}</span>
                                        <span className="ml-2 text-xs text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded">
                                            {trade.exchange}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-[var(--text-secondary)]">
                                        {trade.type}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${trade.direction === 'LONG'
                                                ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                                : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                            }`}>
                                            {trade.direction}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-3 text-right font-medium ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                        }`}>
                                        ${trade.pnl.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DayDetailModal;
