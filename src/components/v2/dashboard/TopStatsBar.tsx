import { Info } from 'lucide-react';
import DonutChart from '../shared/DonutChart';
import HorizontalBar from '../shared/HorizontalBar';
import type { V2Stats } from '../../../hooks/v2/useV2Stats';

interface TopStatsBarProps {
    stats: V2Stats;
}

const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
};

const TopStatsBar = ({ stats }: TopStatsBarProps) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Avg Win/Loss Trade Card */}
            <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">Avg win/loss trade</span>
                    <Info size={12} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-semibold text-[var(--text-primary)]">
                        {stats.avgWinLossRatio > 99 ? '--' : stats.avgWinLossRatio.toFixed(2)}
                    </span>
                    <div className="flex-1">
                        <HorizontalBar
                            leftValue={stats.avgWin}
                            leftLabel=""
                            rightValue={stats.avgLoss}
                            rightLabel=""
                            height={6}
                            showLabels={false}
                        />
                        <div className="flex justify-between mt-1">
                            <span className="text-xs text-[var(--success)]">{formatCurrency(stats.avgWin)}</span>
                            <span className="text-xs text-[var(--danger)]">-{formatCurrency(stats.avgLoss)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profit Factor Card */}
            <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">Profit factor</span>
                    <Info size={12} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-2xl font-semibold text-[var(--text-primary)]">
                        {stats.profitFactor > 99 ? '--' : stats.profitFactor.toFixed(2)}
                    </span>
                    <DonutChart
                        value={Math.min(stats.profitFactor, 5)}
                        max={5}
                        color={stats.profitFactor >= 1 ? 'var(--success)' : 'var(--danger)'}
                        size="md"
                        thickness={8}
                    />
                </div>
            </div>

            {/* Trade Win % Card */}
            <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">Trade win %</span>
                    <Info size={12} className="text-[var(--text-tertiary)]" />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-2xl font-semibold text-[var(--text-primary)]">
                            {stats.winRate.toFixed(stats.winRate % 1 === 0 ? 0 : 2)}%
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[var(--success)]">{stats.winningTrades}</span>
                            <span className="text-xs text-[var(--text-tertiary)]">{stats.breakEvenTrades}</span>
                            <span className="text-xs text-[var(--danger)]">{stats.losingTrades}</span>
                        </div>
                    </div>
                    <DonutChart
                        segments={[
                            { value: stats.winningTrades, color: 'var(--success)', label: 'Wins' },
                            { value: stats.breakEvenTrades, color: 'var(--text-tertiary)', label: 'BE' },
                            { value: stats.losingTrades, color: 'var(--danger)', label: 'Losses' },
                        ]}
                        size="md"
                        thickness={8}
                    />
                </div>
            </div>

            {/* Account Balance & P&L Card */}
            <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">Account balance & P&L</span>
                    <Info size={12} className="text-[var(--text-tertiary)]" />
                    <span className="ml-1 text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded">
                        {stats.openTrades}
                    </span>
                </div>
                <div className="space-y-1">
                    <div className="text-2xl font-semibold text-[var(--success)]">
                        {formatCurrency(stats.totalPnL)}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                        P&L:{' '}
                        <span className={stats.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                            {formatCurrency(stats.totalPnL)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopStatsBar;
