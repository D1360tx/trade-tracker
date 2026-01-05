import { useMemo } from 'react';
import { useTrades } from '../../context/TradeContext';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { Trade } from '../../types';

interface StreakAnalysisProps {
    trades?: Trade[];
}

const StreakAnalysis = ({ trades: tradesProp }: StreakAnalysisProps) => {
    const { trades: allTrades } = useTrades();
    const trades = tradesProp || allTrades;

    const streakData = useMemo(() => {
        const closedTrades = trades
            .filter(t => t.status === 'CLOSED' || t.pnl !== 0)
            .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());

        if (closedTrades.length === 0) {
            return {
                longestWinStreak: 0,
                longestLossStreak: 0,
                currentStreak: 0,
                currentStreakType: 'none' as 'win' | 'loss' | 'none'
            };
        }

        let longestWin = 0;
        let longestLoss = 0;
        let currentWin = 0;
        let currentLoss = 0;

        closedTrades.forEach(t => {
            if (t.pnl > 0) {
                currentWin++;
                currentLoss = 0;
                if (currentWin > longestWin) longestWin = currentWin;
            } else if (t.pnl < 0) {
                currentLoss++;
                currentWin = 0;
                if (currentLoss > longestLoss) longestLoss = currentLoss;
            }
        });

        // Determine current streak
        const lastTrade = closedTrades[closedTrades.length - 1];
        const currentStreakType = lastTrade.pnl > 0 ? 'win' : lastTrade.pnl < 0 ? 'loss' : 'none';
        const currentStreak = currentStreakType === 'win' ? currentWin : currentStreakType === 'loss' ? currentLoss : 0;

        return {
            longestWinStreak: longestWin,
            longestLossStreak: longestLoss,
            currentStreak,
            currentStreakType
        };
    }, [trades]);

    const { longestWinStreak, longestLossStreak, currentStreak, currentStreakType } = streakData;

    if (trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0).length === 0) {
        return (
            <div className="w-full h-full min-h-[250px] flex flex-col items-center justify-center text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                <p>No closed trades found.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[250px]">
            <div className="flex items-center gap-2 mb-6">
                <Zap className="text-[var(--accent-primary)]" size={20} />
                <h3 className="text-lg font-bold">Streak Analysis</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Longest Win Streak */}
                <div className="glass-panel p-6 rounded-xl border-2 border-[var(--success)]/20 hover:border-[var(--success)]/40 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-[var(--success)]" size={18} />
                        <span className="text-sm text-[var(--text-secondary)]">Longest Win Streak</span>
                    </div>
                    <div className="text-4xl font-bold text-[var(--success)]">
                        {longestWinStreak}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        consecutive winning trades
                    </div>
                </div>

                {/* Longest Loss Streak */}
                <div className="glass-panel p-6 rounded-xl border-2 border-[var(--danger)]/20 hover:border-[var(--danger)]/40 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="text-[var(--danger)]" size={18} />
                        <span className="text-sm text-[var(--text-secondary)]">Longest Loss Streak</span>
                    </div>
                    <div className="text-4xl font-bold text-[var(--danger)]">
                        {longestLossStreak}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        consecutive losing trades
                    </div>
                </div>

                {/* Current Streak */}
                <div className={`glass-panel p-6 rounded-xl border-2 transition-colors ${currentStreakType === 'win'
                        ? 'border-[var(--success)]/30 hover:border-[var(--success)]/50'
                        : currentStreakType === 'loss'
                            ? 'border-[var(--danger)]/30 hover:border-[var(--danger)]/50'
                            : 'border-[var(--border)]'
                    }`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className={currentStreakType === 'win' ? 'text-[var(--success)]' : currentStreakType === 'loss' ? 'text-[var(--danger)]' : 'text-[var(--text-tertiary)]'} size={18} />
                        <span className="text-sm text-[var(--text-secondary)]">Current Streak</span>
                    </div>
                    <div className={`text-4xl font-bold ${currentStreakType === 'win'
                            ? 'text-[var(--success)]'
                            : currentStreakType === 'loss'
                                ? 'text-[var(--danger)]'
                                : 'text-[var(--text-primary)]'
                        }`}>
                        {currentStreak}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                        {currentStreakType === 'win' ? 'wins in a row 🔥' : currentStreakType === 'loss' ? 'losses in a row ⚠️' : 'no active streak'}
                    </div>
                </div>
            </div>

            {/* Streak Insights */}
            <div className="mt-6 p-4 bg-[var(--bg-tertiary)]/30 rounded-lg border border-[var(--border)]">
                <div className="text-xs text-[var(--text-secondary)] space-y-2">
                    <p>
                        <span className="font-medium text-[var(--text-primary)]">Streak Ratio:</span>{' '}
                        {longestWinStreak > 0 && longestLossStreak > 0
                            ? `${(longestWinStreak / longestLossStreak).toFixed(2)}:1`
                            : 'N/A'}
                        {longestWinStreak > longestLossStreak && ' (Wins dominate ✅)'}
                        {longestLossStreak > longestWinStreak && ' (Losses dominate ⚠️)'}
                    </p>
                    {currentStreakType === 'loss' && currentStreak >= 3 && (
                        <p className="text-[var(--warning)]">
                            ⚠️ <span className="font-medium">Consider taking a break</span> - You're on a {currentStreak}-trade losing streak
                        </p>
                    )}
                    {currentStreakType === 'win' && currentStreak >= 5 && (
                        <p className="text-[var(--success)]">
                            🔥 <span className="font-medium">Hot streak!</span> - Stay disciplined and don't overtrade
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StreakAnalysis;
