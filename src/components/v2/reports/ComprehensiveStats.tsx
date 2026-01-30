import type { V2Stats } from '../../../hooks/v2/useV2Stats';
import { formatHoldTime } from '../../../hooks/v2/useV2Stats';

interface ComprehensiveStatsProps {
    stats: V2Stats;
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

interface StatRowProps {
    label: string;
    value: string | number;
    valueColor?: string;
}

const StatRow = ({ label, value, valueColor }: StatRowProps) => (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        <span className={`text-sm font-medium ${valueColor || 'text-[var(--text-primary)]'}`}>{value}</span>
    </div>
);

const ComprehensiveStats = ({ stats }: ComprehensiveStatsProps) => {
    // Left column stats
    const leftColumnStats: { label: string; value: string; color?: string }[] = [
        { label: 'Total P&L', value: formatCurrency(stats.totalPnL), color: stats.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
        { label: 'Average daily volume', value: stats.avgDailyVolume.toFixed(2) },
        { label: 'Average winning trade', value: formatCurrency(stats.avgWin), color: 'text-[var(--success)]' },
        { label: 'Average losing trade', value: `-${formatCurrency(stats.avgLoss)}`, color: 'text-[var(--danger)]' },
        { label: 'Total number of trades', value: stats.totalTrades.toString() },
        { label: 'Number of winning trades', value: stats.winningTrades.toString() },
        { label: 'Number of losing trades', value: stats.losingTrades.toString() },
        { label: 'Number of break even trades', value: stats.breakEvenTrades.toString() },
        { label: 'Max consecutive wins', value: stats.maxConsecutiveWins.toString() },
        { label: 'Max consecutive losses', value: stats.maxConsecutiveLosses.toString() },
        { label: 'Total commissions', value: formatCurrency(stats.totalCommissions) },
        { label: 'Total swap', value: formatCurrency(stats.totalSwap) },
        { label: 'Largest profit', value: formatCurrency(stats.largestProfit), color: 'text-[var(--success)]' },
        { label: 'Largest loss', value: formatCurrency(stats.largestLoss), color: 'text-[var(--danger)]' },
        { label: 'Average hold time (All trades)', value: formatHoldTime(stats.avgHoldTimeAll) },
        { label: 'Average hold time (Winning trades)', value: formatHoldTime(stats.avgHoldTimeWinning) },
        { label: 'Average hold time (Losing trades)', value: formatHoldTime(stats.avgHoldTimeLosing) },
        { label: 'Average trade P&L', value: formatCurrency(stats.avgTradeP_L), color: stats.avgTradeP_L >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
    ];

    // Right column stats
    const rightColumnStats: { label: string; value: string; color?: string }[] = [
        { label: 'Profit factor', value: stats.profitFactor > 99 ? '--' : stats.profitFactor.toFixed(2) },
        { label: 'Open trades', value: stats.openTrades.toString() },
        { label: 'Total trading days', value: stats.tradingDays.toString() },
        { label: 'Winning days', value: stats.winningDays.toString() },
        { label: 'Losing days', value: stats.losingDays.toString() },
        { label: 'Breakeven days', value: stats.breakEvenDays.toString() },
        { label: 'Max consecutive winning days', value: stats.maxConsecutiveWinningDays.toString() },
        { label: 'Max consecutive losing days', value: stats.maxConsecutiveLosingDays.toString() },
        { label: 'Average daily P&L', value: formatCurrency(stats.avgDailyPnL), color: stats.avgDailyPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
        { label: 'Average winning day P&L', value: formatCurrency(stats.avgWinningDayPnL), color: 'text-[var(--success)]' },
        { label: 'Average losing day P&L', value: formatCurrency(stats.avgLosingDayPnL), color: 'text-[var(--danger)]' },
        { label: 'Largest profitable day (Profits)', value: formatCurrency(stats.largestProfitableDay), color: 'text-[var(--success)]' },
        { label: 'Largest losing day (Losses)', value: formatCurrency(stats.largestLosingDay), color: 'text-[var(--danger)]' },
        { label: 'Average realized R-Multiple', value: stats.avgRealizedRMultiple !== 0 ? `${stats.avgRealizedRMultiple.toFixed(2)}R` : '--' },
        { label: 'Trade expectancy', value: formatCurrency(stats.expectancy), color: stats.expectancy >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]' },
        { label: 'Max drawdown', value: `-${formatCurrency(stats.maxDrawdown)}`, color: 'text-[var(--danger)]' },
        { label: 'Average drawdown', value: `-${formatCurrency(stats.avgDrawdown)}`, color: 'text-[var(--danger)]' },
    ];

    return (
        <div className="glass-panel rounded-xl p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div>
                    {leftColumnStats.map((stat, index) => (
                        <StatRow
                            key={index}
                            label={stat.label}
                            value={stat.value}
                            valueColor={stat.color}
                        />
                    ))}
                </div>

                {/* Right Column */}
                <div>
                    {rightColumnStats.map((stat, index) => (
                        <StatRow
                            key={index}
                            label={stat.label}
                            value={stat.value}
                            valueColor={stat.color}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ComprehensiveStats;
