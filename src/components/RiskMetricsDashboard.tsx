import React, { useMemo } from 'react';
import { Shield, TrendingUp, TrendingDown, Target, AlertTriangle, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Trade } from '../types';
import {
    calculateSharpeRatio,
    calculateSortinoRatio,
    calculateCalmarRatio,
    calculateWinRateByPositionSize,
    calculateRMultipleDistribution,
    calculateExpectancy,
    calculateRiskOfRuin
} from '../utils/riskMetrics';

interface RiskMetricsDashboardProps {
    trades: Trade[];
}

// Helper component for metric cards
const MetricCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    description: string;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
}> = ({ icon, label, value, description, rating }) => {
    const ratingColors = {
        excellent: 'text-green-500',
        good: 'text-blue-500',
        fair: 'text-yellow-500',
        poor: 'text-red-500'
    };

    const ratingBorders = {
        excellent: 'border-green-500/30',
        good: 'border-blue-500/30',
        fair: 'border-yellow-500/30',
        poor: 'border-red-500/30'
    };

    return (
        <div className={`bg-[var(--bg-tertiary)] rounded-lg p-4 border-2 ${ratingBorders[rating]}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={ratingColors[rating]}>{icon}</div>
                <span className="text-sm text-[var(--text-secondary)] font-medium">{label}</span>
            </div>
            <div className={`text-3xl font-bold mb-1 ${ratingColors[rating]}`}>
                {value}
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">{description}</p>
        </div>
    );
};

const RiskMetricsDashboard: React.FC<RiskMetricsDashboardProps> = ({ trades }) => {
    const sharpeRatio = useMemo(() => calculateSharpeRatio(trades), [trades]);
    const sortinoRatio = useMemo(() => calculateSortinoRatio(trades), [trades]);
    const calmarRatio = useMemo(() => calculateCalmarRatio(trades), [trades]);
    const positionSizeMetrics = useMemo(() => calculateWinRateByPositionSize(trades), [trades]);
    const rMultiples = useMemo(() => calculateRMultipleDistribution(trades), [trades]);
    const expectancy = useMemo(() => calculateExpectancy(trades), [trades]);
    const riskOfRuin = useMemo(() => calculateRiskOfRuin(trades, 0.02), [trades]);

    // Rating functions
    const getSharpeRating = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
        if (value >= 2) return 'excellent';
        if (value >= 1) return 'good';
        if (value >= 0) return 'fair';
        return 'poor';
    };

    const getSortinoRating = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
        if (value >= 3) return 'excellent';
        if (value >= 2) return 'good';
        if (value >= 1) return 'fair';
        return 'poor';
    };

    const getCalmarRating = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
        if (value >= 3) return 'excellent';
        if (value >= 1) return 'good';
        if (value >= 0.5) return 'fair';
        return 'poor';
    };

    const getExpectancyRating = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
        if (value >= 50) return 'excellent';
        if (value >= 20) return 'good';
        if (value >= 0) return 'fair';
        return 'poor';
    };

    const getRiskOfRuinRating = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
        if (value < 1) return 'excellent';
        if (value < 5) return 'good';
        if (value < 20) return 'fair';
        return 'poor';
    };

    if (trades.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Shield size={48} className="text-[var(--text-tertiary)] mb-4" />
                <h3 className="text-xl font-bold text-[var(--text-secondary)] mb-2">No Risk Data</h3>
                <p className="text-[var(--text-tertiary)] text-center">
                    Import trades to see risk-adjusted metrics
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Shield size={24} className="text-[var(--accent-primary)]" />
                <div>
                    <h3 className="text-2xl font-bold">Risk-Adjusted Metrics</h3>
                    <p className="text-sm text-[var(--text-secondary)]">Professional-grade risk analysis</p>
                </div>
            </div>

            {/* Key Risk Ratios */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                    icon={<TrendingUp size={20} />}
                    label="Sharpe Ratio"
                    value={sharpeRatio === Infinity ? '∞' : sharpeRatio.toFixed(2)}
                    description="Return per unit of total risk"
                    rating={getSharpeRating(sharpeRatio)}
                />
                <MetricCard
                    icon={<TrendingDown size={20} />}
                    label="Sortino Ratio"
                    value={sortinoRatio === Infinity ? '∞' : sortinoRatio.toFixed(2)}
                    description="Return per unit of downside risk"
                    rating={getSortinoRating(sortinoRatio)}
                />
                <MetricCard
                    icon={<Shield size={20} />}
                    label="Calmar Ratio"
                    value={calmarRatio === Infinity ? '∞' : calmarRatio.toFixed(2)}
                    description="Annual return / max drawdown"
                    rating={getCalmarRating(calmarRatio)}
                />
                <MetricCard
                    icon={<Target size={20} />}
                    label="Expectancy"
                    value={`$${expectancy.toFixed(2)}`}
                    description="Average P&L per trade"
                    rating={getExpectancyRating(expectancy)}
                />
                <MetricCard
                    icon={<AlertTriangle size={20} />}
                    label="Risk of Ruin"
                    value={`${riskOfRuin.toFixed(1)}%`}
                    description="Probability of total loss"
                    rating={getRiskOfRuinRating(riskOfRuin)}
                />
                <MetricCard
                    icon={<Award size={20} />}
                    label="Sample Size"
                    value={trades.filter(t => t.status === 'CLOSED').length}
                    description="Closed trades analyzed"
                    rating={trades.length >= 100 ? 'excellent' : trades.length >= 30 ? 'good' : 'fair'}
                />
            </div>

            {/* Position Size Analysis */}
            {positionSizeMetrics.length > 0 && (
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                    <div className="mb-4">
                        <h4 className="text-lg font-bold">Win Rate by Position Size</h4>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                            Shows actual capital risked/deployed per trade. Options: Premium × Contracts × 100. Stocks: Price × Shares.
                        </p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={positionSizeMetrics} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                            <XAxis
                                dataKey="bucket"
                                stroke="var(--text-tertiary)"
                                fontSize={13}
                                angle={0}
                                textAnchor="middle"
                                height={60}
                                tick={{ fill: 'var(--text-secondary)' }}
                            />
                            <YAxis
                                stroke="var(--text-tertiary)"
                                fontSize={13}
                                tickFormatter={(val) => `${val}%`}
                                tick={{ fill: 'var(--text-secondary)' }}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload || !payload[0]) return null;
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded p-3 shadow-xl text-sm">
                                            <p className="font-bold mb-2 text-[var(--text-primary)]">{data.bucket}</p>
                                            <p className="text-green-500 font-semibold">Win Rate: {data.winRate.toFixed(1)}%</p>
                                            <p className="text-[var(--text-secondary)]">Total Trades: {data.trades}</p>
                                            <p className="text-[var(--text-secondary)]">Wins: {data.wins} / Losses: {data.losses}</p>
                                            <p className={`font-semibold ${data.avgPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                Avg P&L: ${data.avgPnL.toFixed(2)}
                                            </p>
                                        </div>
                                    );
                                }}
                            />
                            <Bar dataKey="winRate" radius={[6, 6, 0, 0]}>
                                {positionSizeMetrics.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.winRate >= 60 ? '#22c55e' : entry.winRate >= 50 ? '#3b82f6' : '#ef4444'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="text-sm text-[var(--text-secondary)] mt-3 text-center font-medium">
                        Higher win rates in larger position sizes suggest confidence and skill scaling
                    </p>
                </div>
            )}

            {/* R-Multiple Distribution */}
            {rMultiples.length > 0 && (
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
                    <h4 className="text-lg font-bold mb-4">R-Multiple Distribution</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={rMultiples}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                            <XAxis
                                dataKey="range"
                                stroke="var(--text-tertiary)"
                                fontSize={13}
                                tick={{ fill: 'var(--text-secondary)' }}
                            />
                            <YAxis
                                stroke="var(--text-tertiary)"
                                fontSize={13}
                                tickFormatter={(val) => `${val}%`}
                                tick={{ fill: 'var(--text-secondary)' }}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload || !payload[0]) return null;
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded p-3 shadow-xl text-sm">
                                            <p className="font-bold mb-1 text-[var(--text-primary)]">{data.range}</p>
                                            <p className="text-[var(--text-secondary)]">Count: {data.count} trades</p>
                                            <p className="text-[var(--accent-primary)]">{data.percentage.toFixed(1)}% of total</p>
                                        </div>
                                    );
                                }}
                            />
                            <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                                {rMultiples.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <p className="text-sm text-[var(--text-secondary)] mt-3 text-center font-medium">
                        Distribution of wins/losses in R-multiples (based on P&L %)
                    </p>
                </div>
            )}

            {/* Insights */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-base font-bold mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-blue-400" />
                    Risk Analysis Insights
                </h4>
                <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                    {sharpeRatio < 1 && <p>• Consider reducing position sizes to improve risk-adjusted returns</p>}
                    {calmarRatio < 1 && <p>• Focus on reducing maximum drawdown through better risk management</p>}
                    {riskOfRuin > 10 && <p>• ⚠️ High risk of ruin detected - reduce risk per trade immediately</p>}
                    {expectancy < 0 && <p>• ⚠️ Negative expectancy - your system is losing money on average</p>}
                    {expectancy > 50 && <p>• ✅ Strong positive expectancy - maintain current strategy</p>}
                </div>
            </div>
        </div>
    );
};

export default RiskMetricsDashboard;
