import { ChevronLeft, ChevronRight, Check, Play, Share2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Trade } from '../../../types';

interface TradeHeaderProps {
    trade: Trade;
    onPrevious?: () => void;
    onNext?: () => void;
    hasPrevious?: boolean;
    hasNext?: boolean;
}

const TradeHeader = ({
    trade,
    onPrevious,
    onNext,
    hasPrevious = false,
    hasNext = false,
}: TradeHeaderProps) => {
    const formattedDate = trade.exitDate
        ? format(parseISO(trade.exitDate), 'EEE, MMM d, yyyy')
        : '--';

    return (
        <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
            {/* Left: Navigation and Symbol */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrevious}
                        disabled={!hasPrevious}
                        className={`p-1.5 rounded transition-colors ${
                            hasPrevious
                                ? 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                : 'text-[var(--text-tertiary)] cursor-not-allowed'
                        }`}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={onNext}
                        disabled={!hasNext}
                        className={`p-1.5 rounded transition-colors ${
                            hasNext
                                ? 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                : 'text-[var(--text-tertiary)] cursor-not-allowed'
                        }`}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{trade.ticker}</h2>
                    <span className="text-sm text-[var(--text-secondary)]">{formattedDate}</span>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                    <Check size={14} />
                    Mark as reviewed
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--success)] rounded-lg hover:brightness-110 transition-all">
                    <Play size={14} />
                    Replay
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                    <Share2 size={14} />
                    Share
                </button>
            </div>
        </div>
    );
};

export default TradeHeader;
