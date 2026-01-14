import { useMemo, useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import ExchangeFilter from '../components/ExchangeFilter';
import TimeRangeFilter, { getDateRangeForFilter } from '../components/TimeRangeFilter';
import type { TimeRange } from '../components/TimeRangeFilter';

const OverviewPage = () => {
    const { trades, isLoading } = useTrades();
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Calculate all statistics
    const stats = useMemo(() => {
        let closedTrades = trades.filter(t => t.status === 'CLOSED' && t.exitDate);

        // Filter by Exchange
        if (selectedExchanges.length > 0) {
            closedTrades = closedTrades.filter(t => selectedExchanges.includes(t.exchange));
        }

        // Filter by Time Range
        if (timeRange !== 'all') {
            const now = new Date();
            let dateRange: { start: Date; end: Date };

            if (timeRange === 'custom' && customStart) {
                dateRange = {
                    start: startOfDay(parseISO(customStart)),
                    end: customEnd ? endOfDay(parseISO(customEnd)) : now
                };
            } else {
                dateRange = getDateRangeForFilter(timeRange);
            }

            closedTrades = closedTrades.filter(t => {
                const tradeDate = parseISO(t.exitDate);
                return isAfter(tradeDate, dateRange.start) && isBefore(tradeDate, dateRange.end);
            });
        }

        if (closedTrades.length === 0) {
            return null;
        }

        // Sort by date
        const sorted = [...closedTrades].sort((a, b) =>
            new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
        );

        // Monthly aggregation
        const byMonth = new Map<string, number>();
        closedTrades.forEach(t => {
            const month = format(parseISO(t.exitDate), 'MMM yyyy');
            byMonth.set(month, (byMonth.get(month) || 0) + t.pnl);
        });

        const monthlyPnLs = Array.from(byMonth.values());
        const bestMonth = Math.max(...monthlyPnLs);
        const worstMonth = Math.min(...monthlyPnLs);
        const avgMonth = monthlyPnLs.reduce((a, b) => a + b, 0) / monthlyPnLs.length;

        // Daily aggregation
        const byDay = new Map<string, number>();
        closedTrades.forEach(t => {
            const day = format(parseISO(t.exitDate), 'yyyy-MM-dd');
            byDay.set(day, (byDay.get(day) || 0) + t.pnl);
        });

        const dailyPnLs = Array.from(byDay.values());
        const totalTradingDays = byDay.size;
        const winningDays = dailyPnLs.filter(p => p > 0).length;
        const losingDays = dailyPnLs.filter(p => p < 0).length;

        // Win/loss trade counts
        const winningTrades = closedTrades.filter(t => t.pnl > 0);
        const losingTrades = closedTrades.filter(t => t.pnl < 0);
        const scratchTrades = closedTrades.filter(t => Math.abs(t.pnl) <= 10);

        // Total P&L
        const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);

        // Average trades
        const avgWinningTrade = winningTrades.length > 0
            ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
            : 0;
        const avgLosingTrade = losingTrades.length > 0
            ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length
            : 0;

        // Consecutive streaks (trades)
        let maxWinStreak = 0, maxLossStreak = 0;
        let currentWinStreak = 0, currentLossStreak = 0;
        sorted.forEach(t => {
            if (t.pnl > 0) {
                currentWinStreak++;
                currentLossStreak = 0;
                maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
            } else if (t.pnl < 0) {
                currentLossStreak++;
                currentWinStreak = 0;
                maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
            }
        });

        // Consecutive days
        const sortedDays = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        let maxWinDayStreak = 0, maxLossDayStreak = 0;
        let currentWinDayStreak = 0, currentLossDayStreak = 0;
        sortedDays.forEach(([_, pnl]) => {
            if (pnl > 0) {
                currentWinDayStreak++;
                currentLossDayStreak = 0;
                maxWinDayStreak = Math.max(maxWinDayStreak, currentWinDayStreak);
            } else if (pnl < 0) {
                currentLossDayStreak++;
                currentWinDayStreak = 0;
                maxLossDayStreak = Math.max(maxLossDayStreak, currentLossDayStreak);
            }
        });

        // Largest profit/loss
        const largestProfit = Math.max(...closedTrades.map(t => t.pnl));
        const largestLoss = Math.min(...closedTrades.map(t => t.pnl));

        // Daily P&L stats
        const avgDailyPnL = dailyPnLs.reduce((a, b) => a + b, 0) / totalTradingDays;
        const avgWinningDay = winningDays > 0
            ? dailyPnLs.filter(p => p > 0).reduce((a, b) => a + b, 0) / winningDays
            : 0;
        const avgLosingDay = losingDays > 0
            ? dailyPnLs.filter(p => p < 0).reduce((a, b) => a + b, 0) / losingDays
            : 0;

        const largestProfitableDay = Math.max(...dailyPnLs);
        const largestLosingDay = Math.min(...dailyPnLs);

        // Hold time analysis
        const calculateHoldTime = (trades: typeof closedTrades) => {
            if (trades.length === 0) return 0;
            const durations = trades.map(t => {
                const start = new Date(t.entryDate).getTime();
                const end = new Date(t.exitDate).getTime();
                return (end - start) / (1000 * 60); // minutes
            });
            return durations.reduce((a, b) => a + b, 0) / durations.length;
        };

        const avgHoldTime = calculateHoldTime(closedTrades);
        const avgHoldTimeWinning = calculateHoldTime(winningTrades);
        const avgHoldTimeLosing = calculateHoldTime(losingTrades);
        const avgHoldTimeScratch = calculateHoldTime(scratchTrades);

        // Profit factor
        const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

        // Drawdown calculation
        let peak = 0;
        let maxDrawdown = 0;
        let maxDrawdownPct = 0;
        let cumulative = 0;
        const drawdowns: number[] = [];

        sorted.forEach(t => {
            cumulative += t.pnl;
            if (cumulative > peak) peak = cumulative;
            const dd = peak - cumulative;
            if (dd > 0) drawdowns.push(dd);
            if (dd > maxDrawdown) maxDrawdown = dd;
            if (peak > 0) {
                const ddPct = (dd / peak) * 100;
                if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
            }
        });

        const avgDrawdown = drawdowns.length > 0
            ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length
            : 0;
        const avgDrawdownPct = peak > 0 ? (avgDrawdown / peak) * 100 : 0;

        // Trade expectancy
        const tradeExpectancy = closedTrades.length > 0
            ? totalPnL / closedTrades.length
            : 0;

        return {
            bestMonth,
            worstMonth,
            avgMonth,
            bestMonthLabel: Array.from(byMonth.entries()).find(([_, v]) => v === bestMonth)?.[0] || '',
            worstMonthLabel: Array.from(byMonth.entries()).find(([_, v]) => v === worstMonth)?.[0] || '',
            totalPnL,
            avgDailyVolume: totalPnL / totalTradingDays,
            avgWinningTrade,
            avgLosingTrade,
            totalTrades: closedTrades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            maxWinStreak,
            maxLossStreak,
            largestProfit,
            largestLoss,
            avgHoldTime,
            avgHoldTimeWinning,
            avgHoldTimeLosing,
            avgHoldTimeScratch,
            avgTradePnL: totalPnL / closedTrades.length,
            profitFactor,
            openTrades: trades.filter(t => t.status !== 'CLOSED').length,
            totalTradingDays,
            winningDays,
            losingDays,
            maxWinDayStreak,
            maxLossDayStreak,
            avgDailyPnL,
            avgWinningDay,
            avgLosingDay,
            largestProfitableDay,
            largestLosingDay,
            tradeExpectancy,
            maxDrawdown,
            maxDrawdownPct,
            avgDrawdown,
            avgDrawdownPct
        };
    }, [trades, selectedExchanges, timeRange, customStart, customEnd]);

    // Chart data - uses filtered trades from stats calculation
    const chartData = useMemo(() => {
        // Apply same filters as stats
        let closedTrades = trades.filter(t => t.status === 'CLOSED' && t.exitDate);

        // Filter by Exchange
        if (selectedExchanges.length > 0) {
            closedTrades = closedTrades.filter(t => selectedExchanges.includes(t.exchange));
        }

        // Filter by Time Range
        if (timeRange !== 'all') {
            const now = new Date();
            let dateRange: { start: Date; end: Date };

            if (timeRange === 'custom' && customStart) {
                dateRange = {
                    start: startOfDay(parseISO(customStart)),
                    end: customEnd ? endOfDay(parseISO(customEnd)) : now
                };
            } else {
                dateRange = getDateRangeForFilter(timeRange);
            }

            closedTrades = closedTrades.filter(t => {
                const tradeDate = parseISO(t.exitDate);
                return isAfter(tradeDate, dateRange.start) && isBefore(tradeDate, dateRange.end);
            });
        }

        // Sort by date
        closedTrades = closedTrades.sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());

        // Cumulative P&L
        let cumulative = 0;
        const cumulativeData = closedTrades.map(t => {
            cumulative += t.pnl;
            return {
                date: format(parseISO(t.exitDate), 'MM/dd/yy'),
                pnl: cumulative
            };
        });

        // Daily P&L
        const byDay = new Map<string, number>();
        closedTrades.forEach(t => {
            const day = format(parseISO(t.exitDate), 'MM/dd/yy');
            byDay.set(day, (byDay.get(day) || 0) + t.pnl);
        });

        const dailyData = Array.from(byDay.entries())
            .map(([date, pnl]) => ({ date, pnl }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { cumulativeData, dailyData };
    }, [trades, selectedExchanges, timeRange, customStart, customEnd]);

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${Math.round(minutes)} min`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        const days = Math.floor(hours / 24);
        const h = hours % 24;
        return h > 0 ? `${days}d ${h}h` : `${days}d`;
    };

    // Show skeleton while loading
    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="h-10 w-48 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                    <div className="flex gap-2">
                        <div className="h-10 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                        <div className="h-10 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-xl">
                    <div className="h-6 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i}>
                                <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse mb-2" />
                                <div className="h-8 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse mb-1" />
                                <div className="h-3 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="glass-panel p-6 rounded-xl space-y-3">
                            {[...Array(8)].map((_, j) => (
                                <div key={j} className="h-6 bg-[var(--bg-tertiary)] rounded animate-pulse" />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2].map(i => (
                        <div key={i} className="glass-panel p-6 rounded-xl">
                            <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
                            <div className="h-[300px] bg-[var(--bg-tertiary)] rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Overview</h1>
                <div className="glass-panel p-12 rounded-xl text-center">
                    <p className="text-[var(--text-secondary)]">No closed trades found.</p>
                    <p className="text-sm text-[var(--text-tertiary)] mt-2">Start trading to see your statistics!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--accent-primary)] to-cyan-400 bg-clip-text text-transparent">
                    Overview
                </h1>
                <div className="flex items-center gap-2">
                    <ExchangeFilter
                        exchanges={Array.from(new Set(trades.map(t => t.exchange))).sort()}
                        selectedExchanges={selectedExchanges}
                        onSelectionChange={setSelectedExchanges}
                    />
                    <TimeRangeFilter
                        selectedRange={timeRange}
                        onRangeChange={setTimeRange}
                        customStartDate={customStart}
                        customEndDate={customEnd}
                        onCustomDateChange={(start, end) => {
                            setCustomStart(start);
                            setCustomEnd(end);
                        }}
                    />
                </div>
            </div>

            {/* YOUR STATS Section */}
            <div className="glass-panel p-6 rounded-xl">
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
                    YOUR STATS {timeRange !== 'all' ? `(${timeRange === 'custom' ? 'CUSTOM RANGE' : timeRange.toUpperCase().replace('_', ' ')})` : '(ALL DATES)'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <div className="text-xs text-[var(--text-tertiary)] mb-1">Best month</div>
                        <div className="text-2xl font-bold text-[var(--success)]">
                            ${stats.bestMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">{stats.bestMonthLabel}</div>
                    </div>
                    <div>
                        <div className="text-xs text-[var(--text-tertiary)] mb-1">Lowest month</div>
                        <div className="text-2xl font-bold text-[var(--danger)]">
                            ${stats.worstMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">{stats.worstMonthLabel}</div>
                    </div>
                    <div>
                        <div className="text-xs text-[var(--text-tertiary)] mb-1">Average</div>
                        <div className={`text-2xl font-bold ${stats.avgMonth >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            ${stats.avgMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="glass-panel p-6 rounded-xl space-y-3">
                    <StatRow label="Total P&L" value={`$${stats.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor={stats.totalPnL >= 0 ? 'success' : 'danger'} />
                    <StatRow label="Average daily volume" value={`$${Math.abs(stats.avgDailyVolume).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                    <StatRow label="Average winning trade" value={`$${stats.avgWinningTrade.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="success" />
                    <StatRow label="Average losing trade" value={`$${stats.avgLosingTrade.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="danger" />
                    <StatRow label="Total number of trades" value={stats.totalTrades.toString()} />
                    <StatRow label="Number of winning trades" value={stats.winningTrades.toString()} />
                    <StatRow label="Number of losing trades" value={stats.losingTrades.toString()} />
                    <StatRow label="Max consecutive wins" value={stats.maxWinStreak.toString()} />
                    <StatRow label="Max consecutive losses" value={stats.maxLossStreak.toString()} />
                    <StatRow label="Largest profit" value={`$${stats.largestProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="success" />
                    <StatRow label="Largest loss" value={`$${stats.largestLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="danger" />
                    <StatRow label="Average hold time (All trades)" value={formatDuration(stats.avgHoldTime)} />
                    <StatRow label="Average hold time (Winning trades)" value={formatDuration(stats.avgHoldTimeWinning)} />
                    <StatRow label="Average hold time (Losing trades)" value={formatDuration(stats.avgHoldTimeLosing)} />
                    <StatRow label="Average hold time (Scratch trades)" value={formatDuration(stats.avgHoldTimeScratch)} />
                    <StatRow label="Average trade P&L" value={`$${stats.avgTradePnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor={stats.avgTradePnL >= 0 ? 'success' : 'danger'} />
                    <StatRow label="Profit factor" value={stats.profitFactor.toFixed(2)} />
                    <StatRow label="Open trades" value={stats.openTrades.toString()} />
                </div>

                {/* Right Column */}
                <div className="glass-panel p-6 rounded-xl space-y-3">
                    <StatRow label="Total trading days" value={stats.totalTradingDays.toString()} />
                    <StatRow label="Winning days" value={stats.winningDays.toString()} />
                    <StatRow label="Losing days" value={stats.losingDays.toString()} />
                    <StatRow label="Max consecutive winning days" value={stats.maxWinDayStreak.toString()} />
                    <StatRow label="Max consecutive losing days" value={stats.maxLossDayStreak.toString()} />
                    <StatRow label="Average daily P&L" value={`$${stats.avgDailyPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor={stats.avgDailyPnL >= 0 ? 'success' : 'danger'} />
                    <StatRow label="Average winning day P&L" value={`$${stats.avgWinningDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="success" />
                    <StatRow label="Average losing day P&L" value={`$${stats.avgLosingDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="danger" />
                    <StatRow label="Largest profitable day (Profits)" value={`$${stats.largestProfitableDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="success" />
                    <StatRow label="Largest losing day (Profits)" value={`$${stats.largestLosingDay.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="danger" />
                    <StatRow label="Average planned R-Multiple" value="N/A" />
                    <StatRow label="Average realized R-Multiple" value="N/A" />
                    <StatRow label="Trade expectancy" value={`$${stats.tradeExpectancy.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor={stats.tradeExpectancy >= 0 ? 'success' : 'danger'} />
                    <StatRow label="Max drawdown" value={`$${stats.maxDrawdown.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="danger" />
                    <StatRow label="Max drawdown, %" value={`${stats.maxDrawdownPct.toFixed(1)}%`} valueColor="danger" />
                    <StatRow label="Average drawdown" value={`$${stats.avgDrawdown.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} valueColor="danger" />
                    <StatRow label="Average drawdown, %" value={`${stats.avgDrawdownPct.toFixed(1)}%`} valueColor="danger" />
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cumulative P&L */}
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4">
                        DAILY NET CUMULATIVE P&L {timeRange !== 'all' ? `(${timeRange === 'custom' ? 'CUSTOM' : timeRange.toUpperCase().replace('_', ' ')})` : '(ALL DATES)'}
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData.cumulativeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                            <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} tickFormatter={(val) => `$${val}`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                labelStyle={{ color: 'var(--text-primary)' }}
                                formatter={(val) => [`$${(val as number)?.toLocaleString() ?? 0}`, 'Cumulative P&L']}
                            />
                            <Area type="monotone" dataKey="pnl" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorPnl)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Daily P&L */}
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="text-lg font-bold mb-4">
                        NET DAILY P&L {timeRange !== 'all' ? `(${timeRange === 'custom' ? 'CUSTOM' : timeRange.toUpperCase().replace('_', ' ')})` : '(ALL DATES)'}
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData.dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                            <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
                            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} tickFormatter={(val) => `$${val}`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                labelStyle={{ color: 'var(--text-primary)' }}
                                formatter={(val) => [`$${(val as number)?.toLocaleString() ?? 0}`, 'Daily P&L']}
                            />
                            <Bar dataKey="pnl" fill="var(--accent-primary)">
                                {chartData.dailyData.map((entry, index) => (
                                    <rect key={`bar-${index}`} fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// Helper component for stat rows
const StatRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: 'success' | 'danger' }) => (
    <div className="flex justify-between items-center py-1 border-b border-[var(--border)]/30">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        <span className={`text-sm font-medium ${valueColor === 'success' ? 'text-[var(--success)]' :
            valueColor === 'danger' ? 'text-[var(--danger)]' :
                'text-[var(--text-primary)]'
            }`}>
            {value}
        </span>
    </div>
);

export default OverviewPage;
