import { useState } from 'react';
import { Info } from 'lucide-react';
import { useYearlyData } from '../../../hooks/v2/useCalendarData';
import type { Trade } from '../../../types';

interface YearlyCalendarGridProps {
    trades: Trade[];
}

type ViewMode = 'winrate' | 'pnl' | 'trades';

const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (absValue >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
};

const getMonthBgColor = (value: number, mode: ViewMode): string => {
    if (mode === 'winrate') {
        if (value >= 60) return 'rgba(46, 176, 134, 0.15)';
        if (value >= 40) return 'rgba(245, 158, 11, 0.1)';
        return 'rgba(246, 71, 93, 0.1)';
    }
    if (mode === 'pnl') {
        if (value > 0) return 'rgba(46, 176, 134, 0.15)';
        if (value < 0) return 'rgba(246, 71, 93, 0.1)';
    }
    return 'transparent';
};

const YearlyCalendarGrid = ({ trades }: YearlyCalendarGridProps) => {
    const [viewMode, setViewMode] = useState<ViewMode>('pnl');
    const yearlyData = useYearlyData(trades);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // If no yearly data, show empty state
    if (yearlyData.length === 0) {
        return (
            <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">Yearly calendar</span>
                        <Info size={12} className="text-[var(--text-tertiary)]" />
                    </div>
                </div>
                <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
                    No trading data available
                </div>
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">Yearly calendar</span>
                    <Info size={12} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-0.5">
                    {(['winrate', 'pnl', 'trades'] as ViewMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                viewMode === mode
                                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                            }`}
                        >
                            {mode === 'winrate' ? 'Win rate' : mode === 'pnl' ? 'P&L' : 'Trades'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="text-xs text-[var(--text-tertiary)]">
                            <th className="text-left py-2 px-2 font-medium w-16">Year</th>
                            {months.map(m => (
                                <th key={m} className="text-center py-2 px-1 font-medium">{m}</th>
                            ))}
                            <th className="text-center py-2 px-2 font-medium">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {yearlyData.map((yearData) => (
                            <tr key={yearData.year} className="border-t border-[var(--border)]">
                                <td className="py-3 px-2 text-sm text-[var(--text-primary)] font-medium">
                                    {yearData.year}
                                </td>
                                {yearData.months.map((monthData, index) => {
                                    const value = viewMode === 'winrate'
                                        ? monthData.winRate
                                        : viewMode === 'pnl'
                                            ? monthData.pnl
                                            : monthData.tradeCount;

                                    const displayValue = viewMode === 'winrate'
                                        ? monthData.tradeCount > 0 ? `${monthData.winRate.toFixed(0)}%` : '--'
                                        : viewMode === 'pnl'
                                            ? monthData.tradeCount > 0 ? formatCurrency(monthData.pnl) : '--'
                                            : monthData.tradeCount > 0 ? monthData.tradeCount.toString() : '--';

                                    const textColor = viewMode === 'pnl' && monthData.pnl !== 0
                                        ? monthData.pnl > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                        : 'text-[var(--text-secondary)]';

                                    return (
                                        <td
                                            key={index}
                                            className="py-3 px-1 text-center"
                                        >
                                            <div
                                                className={`rounded-lg py-2 px-1 ${textColor}`}
                                                style={{ backgroundColor: getMonthBgColor(value, viewMode) }}
                                            >
                                                <div className="text-xs font-medium">
                                                    {displayValue}
                                                </div>
                                                {monthData.tradeCount > 0 && (
                                                    <div className="text-[10px] text-[var(--text-tertiary)]">
                                                        {monthData.tradeCount} trade{monthData.tradeCount !== 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                {/* Total column */}
                                <td className="py-3 px-2 text-center">
                                    <div
                                        className={`rounded-lg py-2 px-2 ${
                                            viewMode === 'pnl'
                                                ? yearData.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                                                : 'text-[var(--text-secondary)]'
                                        }`}
                                        style={{ backgroundColor: viewMode === 'pnl' ? getMonthBgColor(yearData.totalPnL, viewMode) : 'transparent' }}
                                    >
                                        <div className="text-xs font-medium">
                                            {viewMode === 'winrate'
                                                ? `${yearData.avgWinRate.toFixed(0)}%`
                                                : viewMode === 'pnl'
                                                    ? formatCurrency(yearData.totalPnL)
                                                    : yearData.totalTrades
                                            }
                                        </div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">
                                            {yearData.totalTrades} trades
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default YearlyCalendarGrid;
