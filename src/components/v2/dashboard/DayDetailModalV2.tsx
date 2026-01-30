import { useMemo } from 'react';
import { X, Plus, Play } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { useDayRunningPnL } from '../../../hooks/v2/useCalendarData';
import type { Trade } from '../../../types';

interface DayDetailModalV2Props {
    isOpen: boolean;
    onClose: () => void;
    date: string; // yyyy-MM-dd
    trades: Trade[];
    onViewDetails?: (trade: Trade) => void;
}

const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 1000) {
        return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
};

const DayDetailModalV2 = ({ isOpen, onClose, date, trades, onViewDetails }: DayDetailModalV2Props) => {
    const runningPnL = useDayRunningPnL(trades);

    // Calculate day stats
    const stats = useMemo(() => {
        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        const grossPnL = trades.reduce((sum, t) => sum + Math.abs(t.pnl), 0);
        const commissions = trades.reduce((sum, t) => sum + (t.fees || 0), 0);
        const winners = trades.filter(t => t.pnl > 0);
        const losers = trades.filter(t => t.pnl < 0);
        const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
        const volume = trades.reduce((sum, t) => sum + (t.notional || t.quantity * t.entryPrice), 0);

        const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

        return {
            totalPnL,
            grossPnL,
            commissions,
            totalTrades: trades.length,
            winners: winners.length,
            losers: losers.length,
            winRate,
            volume,
            profitFactor,
        };
    }, [trades]);

    // Format date for display
    const displayDate = useMemo(() => {
        try {
            return format(parseISO(date), 'EEE, MMM d, yyyy');
        } catch {
            return date;
        }
    }, [date]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-panel rounded-xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-4">
                        <span className="text-lg font-medium text-[var(--text-primary)]">{displayDate}</span>
                        <span className={`text-lg font-semibold ${stats.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            Net P&L {formatCurrency(stats.totalPnL)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors">
                            <Plus size={14} />
                            Add note
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--border)] transition-colors">
                            <Play size={14} />
                            Replay
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        >
                            <X size={18} className="text-[var(--text-tertiary)]" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Running P&L Chart + Stats */}
                    <div className="flex gap-6">
                        {/* Chart */}
                        <div className="flex-1 h-[120px]">
                            {runningPnL.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={runningPnL}>
                                        <defs>
                                            <linearGradient id="dayPnlGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <YAxis
                                            tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(v) => formatCurrency(v)}
                                            width={60}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--bg-secondary)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                            }}
                                            formatter={(value) => [formatCurrency(value as number), 'P&L']}
                                            labelFormatter={(label) => `Time: ${label}`}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="pnl"
                                            stroke="var(--success)"
                                            strokeWidth={2}
                                            dot={false}
                                            fill="url(#dayPnlGradient)"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                                    No data
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Total trades</div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">{stats.totalTrades}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Winners</div>
                                <div className="text-sm font-medium text-[var(--success)]">{stats.winners}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Gross P&L</div>
                                <div className={`text-sm font-medium ${stats.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    {formatCurrency(stats.totalPnL)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Commissions</div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">{formatCurrency(stats.commissions)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Winrate</div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">{stats.winRate.toFixed(0)}%</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Losers</div>
                                <div className="text-sm font-medium text-[var(--danger)]">{stats.losers}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Volume</div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">--</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-tertiary)] uppercase">Profit factor</div>
                                <div className="text-sm font-medium text-[var(--text-primary)]">
                                    {stats.profitFactor > 99 ? '--' : stats.profitFactor.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Trades Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[10px] text-[var(--text-tertiary)] uppercase border-b border-[var(--border)]">
                                    <th className="text-left py-2 px-3 font-medium">Symbol</th>
                                    <th className="text-left py-2 px-3 font-medium">Side</th>
                                    <th className="text-right py-2 px-3 font-medium">Average entry</th>
                                    <th className="text-right py-2 px-3 font-medium">Average exit</th>
                                    <th className="text-right py-2 px-3 font-medium">P&L</th>
                                    <th className="text-right py-2 px-3 font-medium">P&L %</th>
                                    <th className="text-right py-2 px-3 font-medium">Close time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((trade) => (
                                    <tr
                                        key={trade.id}
                                        onClick={() => onViewDetails?.(trade)}
                                        className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                                    >
                                        <td className="py-3 px-3 text-sm text-[var(--text-primary)]">
                                            {trade.ticker}
                                        </td>
                                        <td className="py-3 px-3 text-sm">
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                trade.direction === 'LONG'
                                                    ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                                    : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                            }`}>
                                                {trade.direction}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-sm text-[var(--text-secondary)] text-right">
                                            ${trade.entryPrice.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-sm text-[var(--text-secondary)] text-right">
                                            ${trade.exitPrice.toFixed(2)}
                                        </td>
                                        <td className={`py-3 px-3 text-sm font-medium text-right ${
                                            trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                        }`}>
                                            {formatCurrency(trade.pnl)}
                                        </td>
                                        <td className={`py-3 px-3 text-sm text-right ${
                                            trade.pnlPercentage >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                        }`}>
                                            {trade.pnlPercentage.toFixed(2)}%
                                        </td>
                                        <td className="py-3 px-3 text-sm text-[var(--text-secondary)] text-right">
                                            {format(parseISO(trade.exitDate), 'HH:mm:ss')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button className="px-4 py-2 text-sm font-medium text-white bg-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DayDetailModalV2;
