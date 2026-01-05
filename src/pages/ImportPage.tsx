import React, { useState, useEffect } from 'react';
import { useTrades } from '../context/TradeContext';
import { parseCSV } from '../utils/csvParsers';
import { parseTradeLockerPaste } from '../utils/tradeLockerParser';
import type { ExchangeName } from '../types';
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Link, Unlink, RefreshCw, ClipboardPaste } from 'lucide-react';
import { isConnectedToSchwab, connectSchwab, disconnectSchwab, fetchSchwabTransactions } from '../utils/schwabAuth';
import { mapSchwabTransactionsToTrades } from '../utils/schwabTransactions';
import TradeManagement from '../components/TradeManagement';

const EXCHANGES: ExchangeName[] = ['MEXC', 'ByBit', 'Binance', 'Coinbase', 'BloFin', 'Schwab', 'Interactive Brokers', 'HeroFX'];

const ImportPage = () => {
    const { addTrades, fetchTradesFromAPI, clearTrades, clearTradesByExchange, isLoading: isApiLoading } = useTrades();
    const [selectedExchange, setSelectedExchange] = useState<ExchangeName>('Binance');
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState<number | null>(null);

    // Quick Paste state
    const [pasteText, setPasteText] = useState('');
    const [isPasteParsing, setIsPasteParsing] = useState(false);

    // Schwab OAuth state
    const [schwabConnected, setSchwabConnected] = useState(false);
    const [isSyncingSchwab, setIsSyncingSchwab] = useState(false);
    const [isConnectingSchwab, setIsConnectingSchwab] = useState(false);

    useEffect(() => {
        // Check Schwab connection status on mount
        setSchwabConnected(isConnectedToSchwab());
    }, []);

    const handleConnectSchwab = async () => {
        setIsConnectingSchwab(true);
        setError(null);
        try {
            await connectSchwab();
            setSchwabConnected(true);
            setSuccessCount(null);
        } catch (err: any) {
            setError(`Schwab connection failed: ${err.message} `);
        } finally {
            setIsConnectingSchwab(false);
        }
    };

    const handleDisconnectSchwab = () => {
        if (confirm('Disconnect from Schwab? You will need to re-authenticate to sync trades.')) {
            disconnectSchwab();
            setSchwabConnected(false);
        }
    };

    const handleSyncSchwab = async () => {
        setIsSyncingSchwab(true);
        setError(null);
        setSuccessCount(null);

        try {
            // Fetch last 90 days of transactions
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const transactions = await fetchSchwabTransactions(startDate, endDate);
            const trades = mapSchwabTransactionsToTrades(transactions);

            if (trades.length === 0) {
                setError('No completed trades found in the last 90 days.');
            } else {
                addTrades(trades);
                setSuccessCount(trades.length);
            }
        } catch (err: any) {
            if (err.message.includes('reconnect')) {
                setSchwabConnected(false);
            }
            setError(`Schwab sync failed: ${err.message} `);
        } finally {
            setIsSyncingSchwab(false);
        }
    };

    const handleApiImport = async () => {
        setError(null);
        setSuccessCount(null);

        await fetchTradesFromAPI(selectedExchange);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccessCount(null);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsParsing(true);
        setError(null);

        try {
            const result = await parseCSV(file, selectedExchange);
            // Check if result has logs (new signature) or is just an array (old signature fallback check, though types say it's ParseResult now)
            const trades = 'trades' in result ? result.trades : result;
            const logs = 'logs' in result ? result.logs : [];

            if (trades.length === 0) {
                const logMessage = logs.length > 0 ? logs.join('\n') : 'No details available.';
                console.error("Import logs:", logs);
                setError(`No valid trades found.\n\nDiagnostic Logs: \n${logMessage} `);
            } else {
                addTrades(trades as any); // Typescript cast needed until context updated?
                setSuccessCount(trades.length);
                setFile(null);
                if (logs.length > 0) {
                    // Import logs available for debugging if needed
                }
            }
        } catch (err: any) {
            setError(`Failed to parse CSV file: ${err.message} `);
            console.error(err);
        } finally {
            setIsParsing(false);
        }
    };

    const handlePasteImport = async () => {
        if (!pasteText.trim()) {
            setError('Please paste trade data first');
            return;
        }

        setIsPasteParsing(true);
        setError(null);
        setSuccessCount(null);

        try {
            const result = parseTradeLockerPaste(pasteText);
            const { trades, logs } = result;

            // Always log to console for debugging
            console.log('========== PARSE LOGS ==========');
            logs.forEach(log => console.log(log));
            console.log('================================');

            if (trades.length === 0) {
                const logMessage = logs.join('\n');
                setError(`No valid trades found in pasted data.\n\nDiagnostic Logs:\n${logMessage}`);
            } else {
                addTrades(trades);
                setSuccessCount(trades.length);
                setPasteText(''); // Clear after successful import
                // Show success message with log summary
                console.log(`✅ Successfully imported ${trades.length} trade(s)`);
            }
        } catch (err: any) {
            setError(`Failed to parse pasted data: ${err.message}`);
            console.error(err);
        } finally {
            setIsPasteParsing(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 bg-clip-text text-transparent">Import Trades</h2>
                <p className="text-[var(--text-secondary)]">Upload your trade history CSV files from your exchange.</p>
            </div>

            {/* Quick Paste Import Section */}
            <div className="glass-panel p-6 rounded-xl space-y-4">
                <div className="flex items-center gap-2">
                    <ClipboardPaste size={20} className="text-[var(--accent-primary)]" />
                    <h3 className="text-lg font-bold">Quick Paste Import</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                    Copy trades from TradeLocker or similar platforms and paste them here for instant import.
                </p>

                <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste tab-separated trade data here...&#10;&#10;Example:&#10;Instrument    Entry Time    Type    Side    Amount    Entry Price    ...&#10;XAUUSD        2026/01/05 03:38:44    Market    Buy    0.01    4,405.62    ..."
                    className="w-full h-40 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm font-mono resize-vertical focus:border-[var(--accent-primary)] focus:outline-none"
                />

                <div className="flex gap-2">
                    <button
                        onClick={handlePasteImport}
                        disabled={!pasteText.trim() || isPasteParsing}
                        className="flex-1 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <ClipboardPaste size={18} />
                        {isPasteParsing ? 'Parsing...' : 'Import Pasted Data'}
                    </button>
                    {pasteText && (
                        <button
                            onClick={() => setPasteText('')}
                            className="px-4 py-2.5 border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            <div className="glass-panel p-8 rounded-xl space-y-6">
                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Select Exchange</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {EXCHANGES.map(ex => (
                            <button
                                key={ex}
                                onClick={() => setSelectedExchange(ex)}
                                className={`
px - 4 py - 2 rounded - lg text - sm border transition - all
                                    ${selectedExchange === ex
                                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)] font-medium'
                                        : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--text-secondary)]'
                                    }
`}
                            >
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>

                <div
                    className={`
                        border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors
                        ${file ? 'border-[var(--success)] bg-[var(--success)]/5' : 'border-[var(--border)] hover:border-[var(--text-secondary)]'}
                    `}
                >
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                        id="csv-upload"
                    />

                    {file ? (
                        <div className="space-y-2">
                            <FileText size={48} className="text-[var(--success)] mx-auto" />
                            <p className="text-[var(--text-primary)] font-medium">{file.name}</p>
                            <button
                                onClick={() => setFile(null)}
                                className="text-sm text-[var(--danger)] hover:underline"
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <label htmlFor="csv-upload" className="cursor-pointer space-y-2">
                            <Upload size={48} className="text-[var(--text-secondary)] mx-auto" />
                            <p className="text-[var(--text-primary)] font-medium">Click to upload CSV</p>
                            <p className="text-xs text-[var(--text-tertiary)]">Drag and drop supported</p>
                        </label>
                    )}
                </div>

                {error && (
                    <div className="p-4 bg-[var(--danger)]/10 text-[var(--danger)] rounded-lg flex items-start gap-2 whitespace-pre-wrap font-mono text-xs overflow-auto max-h-60">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {successCount !== null && (
                    <div className="p-4 bg-[var(--success)]/10 text-[var(--success)] rounded-lg flex items-center gap-2">
                        <CheckCircle size={18} />
                        Successfully imported {successCount} trades!
                    </div>
                )}

                <button
                    onClick={handleImport}
                    disabled={!file || isParsing}
                    className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                    {isParsing ? 'Parsing...' : 'Import CSV'}
                </button>

                {/* Schwab OAuth Section */}
                {selectedExchange === 'Schwab' && (
                    <div className="pt-6 border-t border-[var(--border)] space-y-4">
                        <h3 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                            <Link size={16} />
                            Connect Schwab Account
                        </h3>

                        {schwabConnected ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 p-3 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-lg">
                                    <CheckCircle size={18} className="text-[var(--success)]" />
                                    <span className="text-sm text-[var(--success)] font-medium">Connected to Schwab</span>
                                    <button
                                        onClick={handleDisconnectSchwab}
                                        className="ml-auto text-xs text-[var(--text-tertiary)] hover:text-[var(--danger)] flex items-center gap-1"
                                    >
                                        <Unlink size={14} />
                                        Disconnect
                                    </button>
                                </div>

                                <button
                                    onClick={handleSyncSchwab}
                                    disabled={isSyncingSchwab}
                                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={18} className={isSyncingSchwab ? 'animate-spin' : ''} />
                                    {isSyncingSchwab ? 'Syncing Trades...' : 'Sync Trades from Schwab'}
                                </button>
                                <p className="text-xs text-[var(--text-tertiary)] text-center">
                                    Fetches last 90 days of trade history
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={handleConnectSchwab}
                                    disabled={isConnectingSchwab}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Link size={18} />
                                    {isConnectingSchwab ? 'Connecting...' : 'Connect Schwab Account'}
                                </button>
                                <p className="text-xs text-[var(--text-tertiary)] text-center">
                                    Uses OAuth to securely access your Schwab account. <br />
                                    You'll be redirected to Schwab to login.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                            <div className="flex-1 h-px bg-[var(--border)]"></div>
                            <span className="text-xs text-[var(--text-tertiary)]">or upload CSV</span>
                            <div className="flex-1 h-px bg-[var(--border)]"></div>
                        </div>
                    </div>
                )}

                {/* Generic API Import Section (non-Schwab) */}
                {selectedExchange !== 'Schwab' && (
                    <div className="pt-6 border-t border-[var(--border)]">
                        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Or import directly from API</h3>
                        <button
                            onClick={handleApiImport}
                            disabled={isApiLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isApiLoading ? `Fetching from ${selectedExchange}...` : `Import from ${selectedExchange} API`}
                        </button>
                        <p className="text-xs text-[var(--text-tertiary)] mt-2 text-center">
                            Requires API Keys configured in <a href="/settings" className="underline hover:text-[var(--text-primary)]">Settings</a>.
                            {selectedExchange !== 'MEXC' && ' (Simulation Mode)'}
                        </p>
                    </div>
                )}

                <button
                    onClick={() => {
                        if (confirm(`Are you sure you want to remove ALL trades for ${selectedExchange} ? `)) {
                            clearTradesByExchange(selectedExchange);
                            alert(`Cleared all ${selectedExchange} data.`);
                        }
                    }}
                    className="mt-4 w-full py-2 border border-[var(--danger)]/50 text-[var(--danger)] hover:bg-[var(--danger)]/10 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={16} />
                    Clear {selectedExchange} Data
                </button>
            </div>

            <div className="pt-6 border-t border-[var(--border)]">
                <button
                    onClick={() => {
                        if (confirm('Are you sure you want to delete ALL trades? This cannot be undone.')) {
                            clearTrades();
                            alert('All trades cleared.');
                        }
                    }}
                    className="w-full py-3 border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} />
                    Clear All Data
                </button>
            </div>

            {/* Trade Management Section */}
            <TradeManagement />

            <div className="pt-6 border-t border-[var(--border)]">
                <button
                    onClick={() => {
                        if (confirm('Are you sure you want to delete ALL trades? This cannot be undone.')) {
                            clearTrades();
                            alert('All trades cleared.');
                        }
                    }}
                    className="w-full py-3 border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} />
                    Clear All Data
                </button>
            </div>
        </div>
    );
};

export default ImportPage;
