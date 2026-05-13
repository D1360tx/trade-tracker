import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTrades } from '../context/TradeContext';
import { parseCSV } from '../utils/csvParsers';
import { parseTradeLockerPaste } from '../utils/tradeLockerParser';
import type { ExchangeName, Trade } from '../types';
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ClipboardPaste,
    Database,
    FileText,
    Link,
    RefreshCw,
    ShieldCheck,
    Trash2,
    Unlink,
    Upload,
} from 'lucide-react';
import { isConnectedToSchwab, connectSchwab, disconnectSchwab, fetchSchwabTransactions } from '../utils/schwabAuth';
import { mapSchwabTransactionsToTrades } from '../utils/schwabTransactions';
import TradeManagement from '../components/TradeManagement';
import DemoAccountSeeder from '../components/DemoAccountSeeder';

const EXCHANGES: ExchangeName[] = ['MEXC', 'ByBit', 'Binance', 'Coinbase', 'BloFin', 'Schwab', 'Interactive Brokers', 'HeroFX'];
const ADVANCED_EXCHANGES = EXCHANGES.filter(exchange => exchange !== 'Schwab');

type ImportStatus = {
    type: 'success' | 'error' | 'info';
    title: string;
    message?: string;
    imported?: number;
    updated?: number;
    duplicates?: number;
    skipped?: number;
    diagnostics?: string[];
};

type DangerAction =
    | { type: 'disconnect-schwab'; label: string; description: string }
    | { type: 'clear-exchange'; exchange: ExchangeName; label: string; description: string }
    | { type: 'clear-all'; label: string; description: string };

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never synced';
    return new Date(timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const parseDiagnosticCounts = (logs: string[] = []) => {
    const text = logs.join('\n').toLowerCase();
    const skippedMatch = text.match(/(\d+)\s+(?:row|rows|trade|trades)?\s*(?:skipped|invalid|filtered)/);
    const duplicateMatch = text.match(/(\d+)\s+(?:duplicate|duplicates)/);
    const updatedMatch = text.match(/(\d+)\s+(?:updated|fixed)/);

    return {
        skipped: skippedMatch ? Number(skippedMatch[1]) : undefined,
        duplicates: duplicateMatch ? Number(duplicateMatch[1]) : undefined,
        updated: updatedMatch ? Number(updatedMatch[1]) : undefined,
    };
};

const ImportStatusMessage = ({ status }: { status: ImportStatus | null }) => {
    const [detailsOpen, setDetailsOpen] = useState(false);
    if (!status) return null;

    const color = status.type === 'success'
        ? 'bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]'
        : status.type === 'error'
            ? 'bg-[var(--danger)]/10 border-[var(--danger)]/30 text-[var(--danger)]'
            : 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]';
    const Icon = status.type === 'error' ? AlertCircle : CheckCircle;

    return (
        <div className={`rounded-lg border p-4 ${color}`}>
            <div className="flex items-start gap-3">
                <Icon size={18} className="shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold">{status.title}</p>
                    {status.message && <p className="mt-1 text-sm opacity-90 whitespace-pre-wrap">{status.message}</p>}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {status.imported !== undefined && <MetricPill label="Imported" value={status.imported} />}
                        {status.updated !== undefined && <MetricPill label="Updated" value={status.updated} />}
                        {status.duplicates !== undefined && <MetricPill label="Duplicates" value={status.duplicates} />}
                        {status.skipped !== undefined && <MetricPill label="Skipped" value={status.skipped} />}
                    </div>
                    {status.diagnostics && status.diagnostics.length > 0 && (
                        <div className="mt-3">
                            <button
                                onClick={() => setDetailsOpen(open => !open)}
                                className="inline-flex items-center gap-1 text-xs font-medium opacity-90 hover:opacity-100"
                            >
                                <ChevronDown size={14} className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                                {detailsOpen ? 'Hide details' : 'Show details'}
                            </button>
                            {detailsOpen && (
                                <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-black/20 p-3 text-xs whitespace-pre-wrap text-[var(--text-primary)]">
                                    {status.diagnostics.join('\n')}
                                </pre>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MetricPill = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-md bg-black/15 px-2 py-1">
        <span className="opacity-75">{label}</span>
        <span className="ml-1 font-semibold">{value.toLocaleString()}</span>
    </div>
);

const SectionHeader = ({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) => (
    <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">{eyebrow}</p>
        <h3 className="mt-1 text-xl font-bold">{title}</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
);

interface FileImportProps {
    id: string;
    title: string;
    description: string;
    helperText: string;
    exchange: ExchangeName;
    file: File | null;
    isParsing: boolean;
    onFileChange: (file: File | null) => void;
    onImport: () => void;
}

const CsvImportPanel = ({ id, title, description, helperText, exchange, file, isParsing, onFileChange, onImport }: FileImportProps) => (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/40 p-5 space-y-4">
        <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--accent-primary)]/10 p-2 text-[var(--accent-primary)]">
                <FileText size={20} />
            </div>
            <div>
                <h4 className="font-semibold">{title}</h4>
                <p className="text-sm text-[var(--text-secondary)]">{description}</p>
            </div>
        </div>

        <div className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${file ? 'border-[var(--success)] bg-[var(--success)]/5' : 'border-[var(--border)] hover:border-[var(--text-secondary)]'}`}>
            <input
                id={id}
                type="file"
                accept=".csv"
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
                className="hidden"
            />
            {file ? (
                <div className="space-y-2">
                    <FileText size={36} className="mx-auto text-[var(--success)]" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Ready to import as {exchange}</p>
                    <button onClick={() => onFileChange(null)} className="text-sm text-[var(--danger)] hover:underline">
                        Remove file
                    </button>
                </div>
            ) : (
                <label htmlFor={id} className="block cursor-pointer space-y-2">
                    <Upload size={36} className="mx-auto text-[var(--text-secondary)]" />
                    <p className="font-medium">Choose CSV file</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{helperText}</p>
                </label>
            )}
        </div>

        <button
            onClick={onImport}
            disabled={!file || isParsing}
            className="w-full rounded-lg bg-[var(--accent-primary)] py-3 font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
            {isParsing ? 'Importing...' : `Import ${exchange} CSV`}
        </button>
    </div>
);

const SchwabImportPanel = ({
    connected,
    isConnecting,
    isSyncing,
    lastUpdated,
    tradeCount,
    status,
    file,
    isParsing,
    onConnect,
    onSync,
    onDisconnect,
    onFileChange,
    onImportCsv,
}: {
    connected: boolean;
    isConnecting: boolean;
    isSyncing: boolean;
    lastUpdated: number | null;
    tradeCount: number;
    status: ImportStatus | null;
    file: File | null;
    isParsing: boolean;
    onConnect: () => void;
    onSync: () => void;
    onDisconnect: () => void;
    onFileChange: (file: File | null) => void;
    onImportCsv: () => void;
}) => (
    <section className="glass-panel rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <SectionHeader
                eyebrow="Primary"
                title="Schwab import command center"
                description="Connect Schwab for direct sync, or use Schwab realized gains CSVs when you need statement-level P&L."
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:min-w-[440px]">
                <StatusTile label="Connection" value={connected ? 'Connected' : 'Not connected'} tone={connected ? 'success' : 'warning'} />
                <StatusTile label="Last sync" value={formatLastSync(lastUpdated)} tone={lastUpdated ? 'success' : 'warning'} />
                <StatusTile label="Schwab trades" value={tradeCount.toLocaleString()} tone={tradeCount > 0 ? 'success' : 'neutral'} />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/40 p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[var(--success)]/10 p-2 text-[var(--success)]">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h4 className="font-semibold">Direct Schwab sync</h4>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Fetches recent transactions through OAuth and maps options to the app format.
                        </p>
                    </div>
                </div>

                {connected ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 p-3 text-[var(--success)]">
                            <CheckCircle size={18} />
                            <span className="text-sm font-medium">Schwab is connected</span>
                            <button onClick={onDisconnect} className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--danger)]">
                                <Unlink size={14} />
                                Disconnect
                            </button>
                        </div>
                        <button
                            onClick={onSync}
                            disabled={isSyncing}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Syncing trades...' : 'Sync Schwab trades'}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onConnect}
                        disabled={isConnecting}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Link size={18} />
                        {isConnecting ? 'Connecting...' : 'Connect Schwab'}
                    </button>
                )}
            </div>

            <CsvImportPanel
                id="schwab-csv-upload"
                title="Schwab realized gains CSV"
                description="Best for matching Schwab statement P&L or importing trades outside the API sync window."
                helperText="Use Schwab realized gains CSV exports"
                exchange="Schwab"
                file={file}
                isParsing={isParsing}
                onFileChange={onFileChange}
                onImport={onImportCsv}
            />
        </div>

        <ImportStatusMessage status={status} />
    </section>
);

const StatusTile = ({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'neutral' }) => {
    const toneClass = tone === 'success' ? 'text-[var(--success)]' : tone === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]';
    return (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]/50 p-3">
            <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</p>
        </div>
    );
};

const PasteImportPanel = ({
    pasteText,
    isParsing,
    status,
    onChange,
    onImport,
    onClear,
}: {
    pasteText: string;
    isParsing: boolean;
    status: ImportStatus | null;
    onChange: (value: string) => void;
    onImport: () => void;
    onClear: () => void;
}) => (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/40 p-5 space-y-4">
        <div className="flex items-start gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
                <ClipboardPaste size={20} />
            </div>
            <div>
                <h4 className="font-semibold">TradeLocker / HeroFX paste</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                    Paste copied rows from TradeLocker or similar platforms.
                </p>
            </div>
        </div>
        <textarea
            value={pasteText}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Paste tab-separated trade data here..."
            className="h-40 w-full resize-vertical rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[var(--accent-primary)]"
        />
        <div className="flex gap-2">
            <button
                onClick={onImport}
                disabled={!pasteText.trim() || isParsing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] py-2.5 font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
                <ClipboardPaste size={18} />
                {isParsing ? 'Parsing...' : 'Import pasted trades'}
            </button>
            {pasteText && (
                <button onClick={onClear} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)]">
                    Clear
                </button>
            )}
        </div>
        <ImportStatusMessage status={status} />
    </div>
);

const AdvancedImportPanel = ({
    selectedExchange,
    file,
    isParsing,
    isApiLoading,
    status,
    onExchangeChange,
    onFileChange,
    onImportCsv,
    onApiImport,
}: {
    selectedExchange: ExchangeName;
    file: File | null;
    isParsing: boolean;
    isApiLoading: boolean;
    status: ImportStatus | null;
    onExchangeChange: (exchange: ExchangeName) => void;
    onFileChange: (file: File | null) => void;
    onImportCsv: () => void;
    onApiImport: () => void;
}) => (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
                <h4 className="font-semibold">Other CSV and exchange API imports</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                    Use this for MEXC, ByBit, HeroFX, and other secondary sources.
                </p>
            </div>
            <select
                value={selectedExchange}
                onChange={(event) => onExchangeChange(event.target.value as ExchangeName)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
            >
                {ADVANCED_EXCHANGES.map(exchange => (
                    <option key={exchange} value={exchange}>{exchange}</option>
                ))}
            </select>
        </div>

        <CsvImportPanel
            id="advanced-csv-upload"
            title={`${selectedExchange} CSV`}
            description="Upload a CSV from the selected source. Schwab files belong in the primary panel above."
            helperText={`Use a ${selectedExchange} CSV export`}
            exchange={selectedExchange}
            file={file}
            isParsing={isParsing}
            onFileChange={onFileChange}
            onImport={onImportCsv}
        />

        <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <p className="font-medium">API import</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        Requires API keys in <RouterLink to="/settings" className="underline hover:text-[var(--text-primary)]">Settings</RouterLink>.
                        {selectedExchange !== 'MEXC' && ' This source may use simulation mode.'}
                    </p>
                </div>
                <button
                    onClick={onApiImport}
                    disabled={isApiLoading}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                    {isApiLoading ? `Fetching ${selectedExchange}...` : `Import ${selectedExchange} API`}
                </button>
            </div>
        </div>

        <ImportStatusMessage status={status} />
    </div>
);

const DangerZone = ({
    selectedExchange,
    onExchangeChange,
    pendingAction,
    onRequestAction,
    onCancel,
    onConfirm,
}: {
    selectedExchange: ExchangeName;
    onExchangeChange: (exchange: ExchangeName) => void;
    pendingAction: DangerAction | null;
    onRequestAction: (action: DangerAction) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) => (
    <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--danger)]/10 p-2 text-[var(--danger)]">
                <Trash2 size={20} />
            </div>
            <div>
                <h4 className="font-semibold text-[var(--danger)]">Data management</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                    Clear imported data only when you are fixing a bad import or rebuilding your dataset.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
            <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">Source to clear</span>
                <select
                    value={selectedExchange}
                    onChange={(event) => onExchangeChange(event.target.value as ExchangeName)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-3 text-sm outline-none focus:border-[var(--accent-primary)]"
                >
                    {EXCHANGES.map(exchange => (
                        <option key={exchange} value={exchange}>{exchange}</option>
                    ))}
                </select>
            </label>
            <button
                onClick={() => onRequestAction({
                    type: 'clear-exchange',
                    exchange: selectedExchange,
                    label: `Clear ${selectedExchange} data`,
                    description: `This removes all ${selectedExchange} trades from the local view.`,
                })}
                className="rounded-lg border border-[var(--danger)]/40 px-4 py-3 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
            >
                Clear selected source
            </button>
            <button
                onClick={() => onRequestAction({
                    type: 'clear-all',
                    label: 'Clear all trade data',
                    description: 'This removes every imported trade from the local view.',
                })}
                className="rounded-lg border border-[var(--danger)] px-4 py-3 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10"
            >
                Clear all data
            </button>
        </div>

        {pendingAction && (
            <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--bg-primary)] p-4">
                <p className="font-semibold text-[var(--danger)]">{pendingAction.label}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{pendingAction.description}</p>
                <div className="mt-4 flex gap-2">
                    <button onClick={onConfirm} className="rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white">
                        Confirm
                    </button>
                    <button onClick={onCancel} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                        Cancel
                    </button>
                </div>
            </div>
        )}
    </div>
);

const ImportPage = () => {
    const {
        addTrades,
        fetchTradesFromAPI,
        clearTrades,
        clearTradesByExchange,
        isLoading: isApiLoading,
        trades,
        lastUpdated,
    } = useTrades();

    const [advancedExchange, setAdvancedExchange] = useState<ExchangeName>('MEXC');
    const [schwabFile, setSchwabFile] = useState<File | null>(null);
    const [advancedFile, setAdvancedFile] = useState<File | null>(null);
    const [isSchwabCsvParsing, setIsSchwabCsvParsing] = useState(false);
    const [isAdvancedCsvParsing, setIsAdvancedCsvParsing] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [isPasteParsing, setIsPasteParsing] = useState(false);
    const [schwabConnected, setSchwabConnected] = useState(false);
    const [isSyncingSchwab, setIsSyncingSchwab] = useState(false);
    const [isConnectingSchwab, setIsConnectingSchwab] = useState(false);
    const [schwabStatus, setSchwabStatus] = useState<ImportStatus | null>(null);
    const [pasteStatus, setPasteStatus] = useState<ImportStatus | null>(null);
    const [advancedStatus, setAdvancedStatus] = useState<ImportStatus | null>(null);
    const [pendingDangerAction, setPendingDangerAction] = useState<DangerAction | null>(null);

    const schwabTradeCount = useMemo(
        () => trades.filter(trade => trade.exchange === 'Schwab').length,
        [trades]
    );

    useEffect(() => {
        setSchwabConnected(isConnectedToSchwab());
    }, []);

    const importCsvForExchange = async (
        file: File | null,
        exchange: ExchangeName,
        setParsing: (value: boolean) => void,
        setStatus: (status: ImportStatus | null) => void,
        onDone: () => void
    ) => {
        if (!file) return;

        setParsing(true);
        setStatus(null);

        try {
            const result = await parseCSV(file, exchange);
            const importedTrades = 'trades' in result ? result.trades : result;
            const logs = 'logs' in result ? result.logs : [];
            const counts = parseDiagnosticCounts(logs);

            if (importedTrades.length === 0) {
                setStatus({
                    type: 'error',
                    title: 'No valid trades found',
                    message: 'The file was read, but no importable trades were detected.',
                    diagnostics: logs.length ? logs : ['No parser diagnostics were returned.'],
                    ...counts,
                });
                return;
            }

            addTrades(importedTrades as Trade[]);
            setStatus({
                type: 'success',
                title: `${exchange} CSV imported`,
                imported: importedTrades.length,
                diagnostics: logs,
                ...counts,
            });
            onDone();
        } catch (error: unknown) {
            setStatus({
                type: 'error',
                title: `Failed to import ${exchange} CSV`,
                message: getErrorMessage(error),
            });
        } finally {
            setParsing(false);
        }
    };

    const handleConnectSchwab = async () => {
        setIsConnectingSchwab(true);
        setSchwabStatus(null);
        try {
            await connectSchwab();
            setSchwabConnected(true);
            setSchwabStatus({ type: 'success', title: 'Schwab connected', message: 'You can now sync trades directly from Schwab.' });
        } catch (error: unknown) {
            setSchwabStatus({ type: 'error', title: 'Schwab connection failed', message: getErrorMessage(error) });
        } finally {
            setIsConnectingSchwab(false);
        }
    };

    const handleSyncSchwab = async () => {
        setIsSyncingSchwab(true);
        setSchwabStatus(null);

        try {
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const transactions = await fetchSchwabTransactions(startDate, endDate);
            const importedTrades = mapSchwabTransactionsToTrades(transactions);

            if (importedTrades.length === 0) {
                setSchwabStatus({
                    type: 'info',
                    title: 'No completed Schwab trades found',
                    message: 'The sync finished, but Schwab did not return completed trades in the current window.',
                    imported: 0,
                });
                return;
            }

            addTrades(importedTrades);
            setSchwabStatus({
                type: 'success',
                title: 'Schwab sync complete',
                imported: importedTrades.length,
                message: 'Dashboard and reports will update from the imported Schwab trades.',
            });
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            if (message.includes('reconnect')) setSchwabConnected(false);
            setSchwabStatus({ type: 'error', title: 'Schwab sync failed', message });
        } finally {
            setIsSyncingSchwab(false);
        }
    };

    const handlePasteImport = async () => {
        if (!pasteText.trim()) {
            setPasteStatus({ type: 'error', title: 'Paste trade data first' });
            return;
        }

        setIsPasteParsing(true);
        setPasteStatus(null);

        try {
            const { trades: importedTrades, logs } = parseTradeLockerPaste(pasteText);
            const counts = parseDiagnosticCounts(logs);

            if (importedTrades.length === 0) {
                setPasteStatus({
                    type: 'error',
                    title: 'No valid pasted trades found',
                    diagnostics: logs,
                    ...counts,
                });
                return;
            }

            addTrades(importedTrades);
            setPasteText('');
            setPasteStatus({
                type: 'success',
                title: 'Pasted trades imported',
                imported: importedTrades.length,
                diagnostics: logs,
                ...counts,
            });
        } catch (error: unknown) {
            setPasteStatus({ type: 'error', title: 'Failed to parse pasted trades', message: getErrorMessage(error) });
        } finally {
            setIsPasteParsing(false);
        }
    };

    const handleApiImport = async () => {
        setAdvancedStatus(null);
        try {
            const count = await fetchTradesFromAPI(advancedExchange);
            setAdvancedStatus(count > 0
                ? { type: 'success', title: `${advancedExchange} API import complete`, imported: count }
                : { type: 'info', title: 'No new trades processed', message: `${advancedExchange} did not return new importable trades.` }
            );
        } catch (error: unknown) {
            setAdvancedStatus({ type: 'error', title: `${advancedExchange} API import failed`, message: getErrorMessage(error) });
        }
    };

    const handleConfirmDangerAction = () => {
        if (!pendingDangerAction) return;

        if (pendingDangerAction.type === 'disconnect-schwab') {
            disconnectSchwab();
            setSchwabConnected(false);
            setSchwabStatus({ type: 'info', title: 'Schwab disconnected', message: 'Reconnect Schwab when you are ready to sync again.' });
        } else if (pendingDangerAction.type === 'clear-exchange') {
            clearTradesByExchange(pendingDangerAction.exchange);
            setAdvancedStatus({ type: 'info', title: `${pendingDangerAction.exchange} data cleared` });
        } else {
            clearTrades();
            setAdvancedStatus({ type: 'info', title: 'All trade data cleared' });
        }

        setPendingDangerAction(null);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold">Import Trades</h2>
                    <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
                        Start with Schwab for options-first reporting, then use secondary import tools for paste, CSV, and exchange API workflows.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a href="#schwab-import" className="rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white">
                        Connect Schwab
                    </a>
                    <a href="#other-imports" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                        Paste trades
                    </a>
                    <a href="#data-management" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                        Manage data
                    </a>
                </div>
            </div>

            <DemoAccountSeeder />

            <div id="schwab-import">
                <SchwabImportPanel
                    connected={schwabConnected}
                    isConnecting={isConnectingSchwab}
                    isSyncing={isSyncingSchwab}
                    lastUpdated={lastUpdated}
                    tradeCount={schwabTradeCount}
                    status={schwabStatus}
                    file={schwabFile}
                    isParsing={isSchwabCsvParsing}
                    onConnect={handleConnectSchwab}
                    onSync={handleSyncSchwab}
                    onDisconnect={() => setPendingDangerAction({
                        type: 'disconnect-schwab',
                        label: 'Disconnect Schwab',
                        description: 'You will need to re-authenticate before syncing Schwab trades again.',
                    })}
                    onFileChange={setSchwabFile}
                    onImportCsv={() => importCsvForExchange(schwabFile, 'Schwab', setIsSchwabCsvParsing, setSchwabStatus, () => setSchwabFile(null))}
                />
            </div>

            <section id="other-imports" className="glass-panel rounded-xl p-6 space-y-5">
                <SectionHeader
                    eyebrow="Other imports"
                    title="Secondary sources"
                    description="Use these when you need TradeLocker/HeroFX paste, non-Schwab CSVs, or exchange API imports."
                />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <PasteImportPanel
                        pasteText={pasteText}
                        isParsing={isPasteParsing}
                        status={pasteStatus}
                        onChange={setPasteText}
                        onImport={handlePasteImport}
                        onClear={() => setPasteText('')}
                    />
                    <AdvancedImportPanel
                        selectedExchange={advancedExchange}
                        file={advancedFile}
                        isParsing={isAdvancedCsvParsing}
                        isApiLoading={isApiLoading}
                        status={advancedStatus}
                        onExchangeChange={setAdvancedExchange}
                        onFileChange={setAdvancedFile}
                        onImportCsv={() => importCsvForExchange(advancedFile, advancedExchange, setIsAdvancedCsvParsing, setAdvancedStatus, () => setAdvancedFile(null))}
                        onApiImport={handleApiImport}
                    />
                </div>
            </section>

            <section id="data-management" className="space-y-4">
                <div className="glass-panel rounded-xl p-6 space-y-5">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-[var(--accent-primary)]/10 p-2 text-[var(--accent-primary)]">
                            <Database size={20} />
                        </div>
                        <SectionHeader
                            eyebrow="Data management"
                            title="Review and clean imported trades"
                            description="Use trade management for targeted cleanup. Use destructive actions only when rebuilding an import."
                        />
                    </div>
                    <TradeManagement />
                    <DangerZone
                        selectedExchange={advancedExchange}
                        onExchangeChange={setAdvancedExchange}
                        pendingAction={pendingDangerAction && pendingDangerAction.type !== 'disconnect-schwab' ? pendingDangerAction : null}
                        onRequestAction={setPendingDangerAction}
                        onCancel={() => setPendingDangerAction(null)}
                        onConfirm={handleConfirmDangerAction}
                    />
                </div>
            </section>

            {pendingDangerAction?.type === 'disconnect-schwab' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 shadow-2xl">
                        <p className="text-lg font-semibold">{pendingDangerAction.label}</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{pendingDangerAction.description}</p>
                        <div className="mt-5 flex gap-2">
                            <button onClick={handleConfirmDangerAction} className="rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white">
                                Disconnect
                            </button>
                            <button onClick={() => setPendingDangerAction(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportPage;
