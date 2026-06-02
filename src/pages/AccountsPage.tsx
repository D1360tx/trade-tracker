import { AlertTriangle, CheckCircle, Clock, Database, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTrades } from '../context/useTrades';
import { getSchwabConnectionHealth, type SchwabConnectionHealth } from '../utils/schwabAuth';
import { getDataQualityIssues } from '../utils/tradeAnalytics';
import { getTotalSchwabAccountBalance, getTotalSchwabCashBalance } from '../utils/schwabAccount';

const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never synced';
    return new Date(timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return formatLastSync(timestamp);
};

const DEFAULT_SCHWAB_HEALTH: SchwabConnectionHealth = {
    connected: false,
    status: 'disconnected',
    label: 'Not connected',
    message: 'Connect Schwab to sync trades and balances.',
    needsReconnectSoon: false,
};

const AccountsPage = () => {
    const { trades, lastUpdated, fetchTradesFromAPI, isLoading, schwabAccountSnapshot, schwabBalanceUpdatedAt } = useTrades();
    const [now] = useState(() => Date.now());
    const [schwabHealth, setSchwabHealth] = useState<SchwabConnectionHealth>(DEFAULT_SCHWAB_HEALTH);
    const schwabTrades = useMemo(() => trades.filter(trade => trade.exchange === 'Schwab'), [trades]);
    const issues = useMemo(() => getDataQualityIssues(trades, lastUpdated), [trades, lastUpdated]);
    const lastSyncAgeDays = lastUpdated ? Math.floor((now - lastUpdated) / (24 * 60 * 60 * 1000)) : null;
    const hasFreshData = lastUpdated !== null && (lastSyncAgeDays ?? 999) <= 2;
    const totalAccountBalance = useMemo(() => getTotalSchwabAccountBalance(schwabAccountSnapshot), [schwabAccountSnapshot]);
    const totalCashBalance = useMemo(() => getTotalSchwabCashBalance(schwabAccountSnapshot), [schwabAccountSnapshot]);

    useEffect(() => {
        getSchwabConnectionHealth().then(setSchwabHealth);
    }, []);

    const handleSyncSchwab = async () => {
        await fetchTradesFromAPI('Schwab');
        setSchwabHealth(await getSchwabConnectionHealth());
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
                    disabled={isLoading || !schwabHealth.connected}
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
                            <p className="font-semibold">{schwabHealth.label}</p>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-4">
                        {schwabHealth.message}
                    </p>
                </div>

                <div className="glass-panel rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${hasFreshData ? 'bg-green-500/15 text-[var(--success)]' : 'bg-yellow-500/15 text-[var(--warning)]'}`}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--text-secondary)]">Last successful sync</p>
                            <p className="font-semibold">{formatTimestamp(schwabHealth.lastSuccessfulSyncAt || lastUpdated || undefined)}</p>
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
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${schwabHealth.status === 'connected' ? 'bg-green-500/15 text-[var(--success)]' : 'bg-yellow-500/15 text-[var(--warning)]'}`}>
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <p className="font-semibold">Schwab token health</p>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Last refresh: {formatTimestamp(schwabHealth.lastRefreshedAt)}
                            {schwabHealth.refreshExpiresAt ? ` • Refresh access expires: ${formatTimestamp(schwabHealth.refreshExpiresAt)}` : ''}
                        </p>
                        {schwabHealth.lastError && (
                            <p className="mt-1 text-sm text-[var(--warning)]">{schwabHealth.lastError}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel rounded-xl p-5">
                    <p className="text-sm text-[var(--text-secondary)]">Current Schwab balance</p>
                    <p className="mt-2 text-2xl font-semibold">
                        {totalAccountBalance !== null ? `$${totalAccountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not synced'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">
                        Last balance sync: {formatLastSync(schwabBalanceUpdatedAt)}
                    </p>
                </div>

                <div className="glass-panel rounded-xl p-5">
                    <p className="text-sm text-[var(--text-secondary)]">Cash balance</p>
                    <p className="mt-2 text-2xl font-semibold">
                        {totalCashBalance !== null ? `$${totalCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not synced'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">
                        Uses Schwab current balances when available.
                    </p>
                </div>

                <div className="glass-panel rounded-xl p-5">
                    <p className="text-sm text-[var(--text-secondary)]">Schwab accounts</p>
                    <p className="mt-2 text-2xl font-semibold">
                        {schwabAccountSnapshot?.accounts.length ?? 0}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-2">
                        Account numbers are masked before reaching the browser.
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
