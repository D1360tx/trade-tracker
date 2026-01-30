import { useMonthlyStatsSummary } from '../../../hooks/v2/useCalendarData';
import type { Trade } from '../../../types';

interface YourStatsHeaderProps {
    trades: Trade[];
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

const YourStatsHeader = ({ trades }: YourStatsHeaderProps) => {
    const monthlyStats = useMonthlyStatsSummary(trades);

    return (
        <div className="glass-panel rounded-xl p-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">YOUR STATS</h3>
                <span className="px-2 py-0.5 text-[10px] bg-[var(--accent-primary)] text-white rounded-full">
                    ALL DATES
                </span>
            </div>

            {/* Month Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Best Month */}
                <div>
                    <div className="text-xs text-[var(--text-tertiary)] mb-1">Best month</div>
                    <div className="text-2xl font-bold text-[var(--success)]">
                        {formatCurrency(monthlyStats.bestMonth.pnl)}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                        in {monthlyStats.bestMonth.monthName}
                    </div>
                </div>

                {/* Lowest Month */}
                <div>
                    <div className="text-xs text-[var(--text-tertiary)] mb-1">Lowest month</div>
                    <div className={`text-2xl font-bold ${monthlyStats.worstMonth.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {formatCurrency(monthlyStats.worstMonth.pnl)}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                        in {monthlyStats.worstMonth.monthName}
                    </div>
                </div>

                {/* Average */}
                <div>
                    <div className="text-xs text-[var(--text-tertiary)] mb-1">Average</div>
                    <div className={`text-2xl font-bold ${monthlyStats.averageMonth >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {formatCurrency(monthlyStats.averageMonth)}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">per month</div>
                </div>
            </div>
        </div>
    );
};

export default YourStatsHeader;
