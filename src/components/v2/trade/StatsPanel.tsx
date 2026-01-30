import { useState } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Star, ChevronDown } from 'lucide-react';
import SparklineChart from '../shared/SparklineChart';
import type { Trade } from '../../../types';
import type { Strategy } from '../../../types';
import type { Mistake } from '../../../types';

interface StatsPanelProps {
    trade: Trade;
    strategies?: Strategy[];
    mistakes?: Mistake[];
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

const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    }
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days}d ${hours}h`;
};

const StatsPanel = ({ trade, strategies = [], mistakes = [] }: StatsPanelProps) => {
    const [activeTab, setActiveTab] = useState<'stats' | 'strategy' | 'executions' | 'attachments'>('stats');
    const [notes, setNotes] = useState(trade.notes || '');

    // Calculate hold time
    const holdTimeMinutes = trade.entryDate && trade.exitDate
        ? differenceInMinutes(parseISO(trade.exitDate), parseISO(trade.entryDate))
        : 0;

    // Mock running P&L data (in real implementation, this would come from execution data)
    const runningPnLData = [
        { value: 0 },
        { value: trade.pnl * 0.3 },
        { value: trade.pnl * 0.5 },
        { value: trade.pnl * 0.7 },
        { value: trade.pnl * 0.6 },
        { value: trade.pnl * 0.8 },
        { value: trade.pnl },
    ];

    const selectedStrategy = strategies.find(s => s.id === trade.strategyId);
    const selectedMistakes = trade.mistakes
        ? mistakes.filter(m => trade.mistakes?.includes(m.id))
        : [];

    return (
        <div className="w-full lg:w-80 flex flex-col glass-panel rounded-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
                {(['stats', 'strategy', 'executions', 'attachments'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-2 py-3 text-xs font-medium capitalize transition-colors ${
                            activeTab === tab
                                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === 'stats' && (
                    <>
                        {/* Net P&L */}
                        <div>
                            <div className="text-xs text-[var(--text-tertiary)] mb-1">Net P&L</div>
                            <div className={`text-3xl font-bold ${trade.pnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                {formatCurrency(trade.pnl)}
                            </div>
                        </div>

                        {/* Side Badge */}
                        <div className="flex items-center gap-2">
                            <div className="text-xs text-[var(--text-tertiary)]">Side</div>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                trade.direction === 'LONG'
                                    ? 'bg-[var(--success)]/10 text-[var(--success)]'
                                    : 'bg-[var(--danger)]/10 text-[var(--danger)]'
                            }`}>
                                {trade.direction}
                            </span>
                        </div>

                        {/* Stats Grid */}
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-xs text-[var(--text-tertiary)]">Quantity</span>
                                <span className="text-xs text-[var(--text-primary)]">{trade.quantity}</span>
                            </div>

                            {trade.fees > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-xs text-[var(--text-tertiary)]">Commissions & Fees</span>
                                    <span className="text-xs text-[var(--text-primary)]">{formatCurrency(trade.fees)}</span>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <span className="text-xs text-[var(--text-tertiary)]">Net ROI</span>
                                <span className={`text-xs ${trade.pnlPercentage >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                    {trade.pnlPercentage.toFixed(2)}%
                                </span>
                            </div>

                            {trade.notional && (
                                <div className="flex justify-between">
                                    <span className="text-xs text-[var(--text-tertiary)]">Notional</span>
                                    <span className="text-xs text-[var(--text-primary)]">{formatCurrency(trade.notional)}</span>
                                </div>
                            )}

                            {trade.margin && (
                                <div className="flex justify-between">
                                    <span className="text-xs text-[var(--text-tertiary)]">Margin</span>
                                    <span className="text-xs text-[var(--text-primary)]">{formatCurrency(trade.margin)}</span>
                                </div>
                            )}

                            {trade.leverage && trade.leverage > 1 && (
                                <div className="flex justify-between">
                                    <span className="text-xs text-[var(--text-tertiary)]">Leverage</span>
                                    <span className="text-xs text-[var(--text-primary)]">{trade.leverage}x</span>
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[var(--border)]" />

                        {/* Strategy Dropdown */}
                        <div>
                            <div className="text-xs text-[var(--text-tertiary)] mb-1">Strategy</div>
                            <button className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg text-sm">
                                <span className={selectedStrategy ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>
                                    {selectedStrategy?.name || 'Select Strategy'}
                                </span>
                                <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>

                        {/* Running P&L Sparkline */}
                        <div>
                            <div className="text-xs text-[var(--text-tertiary)] mb-2">Running P&L</div>
                            <SparklineChart
                                data={runningPnLData}
                                height={40}
                                color="auto"
                            />
                        </div>

                        {/* Trade Rating */}
                        <div>
                            <div className="text-xs text-[var(--text-tertiary)] mb-1">Trade Rating</div>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} className="p-0.5">
                                        <Star
                                            size={18}
                                            className="text-[var(--text-tertiary)] hover:text-[var(--warning)]"
                                            fill="transparent"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[var(--border)]" />

                        {/* Entry/Exit Details */}
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-xs text-[var(--text-tertiary)]">Average Entry</span>
                                <span className="text-xs text-[var(--text-primary)]">${trade.entryPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-[var(--text-tertiary)]">Average Exit</span>
                                <span className="text-xs text-[var(--text-primary)]">${trade.exitPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-[var(--text-tertiary)]">Entry Time</span>
                                <span className="text-xs text-[var(--text-primary)]">
                                    {trade.entryDate ? format(parseISO(trade.entryDate), 'HH:mm:ss') : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-[var(--text-tertiary)]">Exit Time</span>
                                <span className="text-xs text-[var(--text-primary)]">
                                    {trade.exitDate ? format(parseISO(trade.exitDate), 'HH:mm:ss') : '--'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-[var(--text-tertiary)]">Hold Time</span>
                                <span className="text-xs text-[var(--text-primary)]">
                                    {holdTimeMinutes > 0 ? formatDuration(holdTimeMinutes) : '--'}
                                </span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[var(--border)]" />

                        {/* Mistakes */}
                        <div>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
                                <span className="text-[var(--warning)]">!</span>
                                Mistakes
                            </div>
                            <button className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg text-sm">
                                <span className={selectedMistakes.length > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>
                                    {selectedMistakes.length > 0
                                        ? selectedMistakes.map(m => m.name).join(', ')
                                        : 'Select tag'}
                                </span>
                                <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[var(--border)]" />

                        {/* Notes */}
                        <div>
                            <div className="text-xs text-[var(--text-tertiary)] mb-2">Notes</div>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add notes about this trade..."
                                className="w-full h-24 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>
                    </>
                )}

                {activeTab === 'strategy' && (
                    <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
                        Strategy details coming soon
                    </div>
                )}

                {activeTab === 'executions' && (
                    <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
                        Execution details coming soon
                    </div>
                )}

                {activeTab === 'attachments' && (
                    <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
                        Attachments coming soon
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsPanel;
