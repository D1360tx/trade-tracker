import { useMemo, useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bot, TrendingUp, Activity, DollarSign, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const BotDashboard = () => {
    const { trades, lastDebugData, fetchTradesFromAPI, isLoading, clearTrades } = useTrades();
    const [timeRange, setTimeRange] = useState<'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'ALL'>('TODAY');

    const botTrades = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();

        return trades
            .filter(t => t.isBot || t.type === 'SPOT') // Now checking isBot flag (Futures) or Spot
            .filter(t => {
                const tTime = new Date(t.exitDate).getTime();
                switch (timeRange) {
                    case 'TODAY': return tTime >= startOfToday;
                    case 'YESTERDAY': return tTime >= startOfYesterday && tTime < startOfToday;
                    case '7D': return tTime >= sevenDaysAgo;
                    case '30D': return tTime >= thirtyDaysAgo;
                    default: return true;
                }
            })
            .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime());
    }, [trades, timeRange]);

    const metrics = useMemo(() => {
        const totalTrades = botTrades.length;
        const totalPnL = botTrades.reduce((sum, t) => sum + t.pnl, 0);
        const winningTrades = botTrades.filter(t => t.pnl > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        // Active Pairs
        const uniqueTickers = new Set(botTrades.map(t => t.ticker)).size;

        return {
            totalTrades,
            totalPnL,
            winRate,
            activePairs: uniqueTickers
        };
    }, [botTrades]);

    const cumulativePnLData = useMemo(() => {
        let runningTotal = 0;
        return botTrades.map(t => {
            runningTotal += t.pnl;
            return {
                date: format(parseISO(t.exitDate), 'MMM dd HH:mm'),
                pnl: runningTotal,
                rawDate: t.exitDate
            };
        }); // Downsample if needed?
    }, [botTrades]);

    return (
        <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent">
                        Bot Performance
                    </h1>
                    <p className="text-[var(--text-tertiary)]">
                        {lastDebugData?.detectedBotPairs && lastDebugData.detectedBotPairs.length > 0
                            ? `Monitoring [${lastDebugData.detectedBotPairs.join(', ')}] Activity`
                            : 'Monitoring Spot Grid Activity'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    >
                        <option value="TODAY">Today</option>
                        <option value="YESTERDAY">Yesterday</option>
                        <option value="7D">Last 7 Days</option>
                        <option value="30D">Last 30 Days</option>
                        <option value="ALL">All Time</option>
                    </select>

                    <button
                        onClick={() => {
                            if (confirm('Are you sure? This will accept all new data from APIs.')) {
                                clearTrades();
                            }
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                    >
                        Reset Data
                    </button>
                    <button
                        onClick={async () => {
                            await Promise.all([
                                fetchTradesFromAPI('MEXC'),
                                fetchTradesFromAPI('ByBit')
                            ]);
                        }}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                        <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-6 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-sm text-[var(--text-tertiary)]">Total Bot P&L</p>
                        <p className={`text-2xl font-bold ${metrics.totalPnL >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            ${metrics.totalPnL.toFixed(2)}
                        </p>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)]">
                        <DollarSign size={20} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-sm text-[var(--text-tertiary)]">Grid Frequency</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                            {metrics.totalTrades} <span className="text-sm font-normal text-[var(--text-tertiary)]">executions</span>
                        </p>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)]">
                        <Activity size={20} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-sm text-[var(--text-tertiary)]">Win Rate</p>
                        <p className="text-2xl font-bold text-[var(--success)]">
                            {metrics.winRate.toFixed(1)}%
                        </p>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)]">
                        <TrendingUp size={20} />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-sm text-[var(--text-tertiary)]">Active Pairs</p>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                            {metrics.activePairs}
                        </p>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-secondary)]">
                        <Bot size={20} />
                    </div>
                </div>
            </div>



            {/* PnL Chart */}
            <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-6">Equity Growth (Spot)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cumulativePnLData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="var(--text-tertiary)"
                                tick={{ fontSize: 12 }}
                                minTickGap={50}
                            />
                            <YAxis
                                stroke="var(--text-tertiary)"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(val) => `$${val}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                itemStyle={{ color: 'var(--text-primary)' }}
                                formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Calculated Equity']}
                            />
                            <Line
                                type="monotone"
                                dataKey="pnl"
                                stroke="var(--accent-primary)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: 'var(--accent-primary)' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>





            {/* Debug / Scanned Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="text-lg font-semibold mb-2">Spot Scanner Diagnostics</h3>
                    <div className="text-xs text-[var(--text-secondary)] font-mono space-y-1 h-32 overflow-y-auto">
                        {lastDebugData?.spot?.scanned ? (
                            <>
                                <p><span className="text-[var(--text-tertiary)]">Pairs Scanned:</span> {lastDebugData.spot.scanned.join(', ') || 'None'}</p>
                                <p><span className="text-[var(--text-tertiary)]">Trades Found:</span> {lastDebugData.spot.found.join(', ') || 'None'}</p>
                            </>
                        ) : (
                            <p className="text-[var(--text-tertiary)]">No Spot scan data. Click 'Sync'.</p>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-xl">
                    <h3 className="text-lg font-semibold mb-2">Futures Raw Data (Last 5)</h3>
                    <div className="text-xs text-[var(--text-secondary)] font-mono space-y-1 h-32 overflow-y-auto whitespace-pre-wrap">
                        {lastDebugData?.futures ? (
                            JSON.stringify(lastDebugData.futures, null, 2)
                        ) : (
                            <p className="text-[var(--text-tertiary)]">No Futures data. Click 'Sync'.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Bot Activity Table */}
            <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-lg font-semibold mb-4">Recent Bot Activity</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-[var(--text-tertiary)] border-b border-[var(--border)]">
                                <th className="pb-3 pl-4">Time</th>
                                <th className="pb-3">Pair</th>
                                <th className="pb-3">Side</th>
                                <th className="pb-3 text-right">Price</th>
                                <th className="pb-3 text-right">Qty</th>
                                <th className="pb-3 text-right">P&L</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {[...botTrades].reverse().slice(0, 50).map((t) => (
                                <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                                    <td className="py-3 pl-4 text-[var(--text-secondary)] whitespace-nowrap">
                                        {format(parseISO(t.exitDate), 'MMM dd HH:mm:ss')}
                                    </td>
                                    <td className="py-3 font-medium text-[var(--text-primary)]">{t.ticker}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${t.direction === 'LONG'
                                            ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                            : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                                            }`}>
                                            {t.direction} {t.status === 'CLOSED' ? 'CLOSE' : 'OPEN'}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right text-[var(--text-secondary)]">${t.exitPrice.toFixed(4)}</td>
                                    <td className="py-3 text-right text-[var(--text-secondary)]">{t.quantity}</td>
                                    <td className={`py-3 text-right font-medium ${t.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                        ${t.pnl.toFixed(4)}
                                    </td>
                                </tr>
                            ))}
                            {botTrades.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-[var(--text-tertiary)]">
                                        No Spot/Bot trades found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BotDashboard;
