import { AlertTriangle, CheckCircle, Clock, Database, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTrades } from '../context/TradeContext';
import { isConnectedToSchwab } from '../utils/schwabAuth';
import { getDataQualityIssues } from '../utils/tradeAnalytics';

const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never synced';
    return new Date(timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const AccountsPage = () => {
    const { trades, lastUpdated, fetchTradesFromAPI, isLoading } = useTrades();
    const [now] = useState(() => Date.now());
    const schwabConnected = isConnectedToSchwab();
    const schwabTrades = useMemo(() => trades.filter(trade => trade.exchange === 'Schwab'), [trades]);
    const issues = useMemo(() => getDataQualityIssues(trades, lastUpdated), [trades, lastUpdated]);
    const lastSyncAgeDays = lastUpdated ? Math.floor((now - lastUpdated) / (24 * 60 * 60 * 1000)) : null;
    const hasFreshData = lastUpdated !== null && (lastSyncAgeDays ?? 999) <= 2;

    const handleSyncSchwab = async () => {
        await fetchTradesFromAPI('Schwab');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold">Accounts</h2>
                    <p className="text-[var(--text-secondary)] mt-1">
                        Connection health, data freshness, and Schwab reporting checks.
                    </p>
                </div>
                <button
                    onClick={handleSyncSchwab}
                    disabled={isLoading || !schwabConnected}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    {isLoading ? 'Syncing...' : 'Sync Schwab'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400">
                            <Wallet size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Schwab</p>
                            <p className="font-semibold">{schwabConnected ? 'Connected' : 'Not connected'}</p>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-4">
                        OAuth tokens are checked locally and loaded from Supabase when available.
                    </p>
                </div>

                <div className="glass-panel rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${hasFreshData ? 'bg-green-500/15 text-[var(--success)]' : 'bg-yellow-500/15 text-[var(--warning)]'}`}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Last successful sync</p>
                            <p className="font-semibold">{formatLastSync(lastUpdated)}</p>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-4">
                        Freshness warning starts after two days without a successful sync.
                    </p>
                </div>

                <div className="glass-panel rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400">
                            <Database size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Imported Schwab trades</p>
                            <p className="font-semibold">{schwabTrades.length.toLocaleString()}</p>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-4">
                        These trades drive the options-first dashboard and reporting surfaces.
                    </p>
                </div>
            </div>

            <div className="glass-panel rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck size={20} className="text-[var(--accent-primary)]" />
                    <h3 className="text-lg font-semibold">Data Quality</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {issues.map(issue => {
                        const Icon = issue.severity === 'danger' || issue.severity === 'warning' ? AlertTriangle : CheckCircle;
                        const color = issue.severity === 'danger'
                            ? 'text-[var(--danger)] bg-[var(--danger)]/10'
                            : issue.severity === 'warning'
                                ? 'text-[var(--warning)] bg-[var(--warning)]/10'
                                : 'text-[var(--success)] bg-[var(--success)]/10';

                        return (
                            <div key={issue.label} className="rounded-lg border border-[var(--border)] p-4 bg-[var(--bg-secondary)]/50">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${color}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div>
                                            <p className="font-medium">{issue.label}</p>
                                            <p className="text-xs text-[var(--text-tertiary)]">{issue.description}</p>
                                        </div>
                                    </div>
                                    <span className="font-semibold tabular-nums">{issue.count.toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AccountsPage;
