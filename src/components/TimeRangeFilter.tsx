import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { timeRangeOptions, type TimeRange } from '../utils/timeRanges';

interface TimeRangeFilterProps {
    selectedRange: TimeRange;
    onRangeChange: (range: TimeRange) => void;
    customStartDate?: string;
    customEndDate?: string;
    onCustomDateChange?: (start: string, end: string) => void;
}

const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({
    selectedRange,
    onRangeChange,
    customStartDate,
    customEndDate,
    onCustomDateChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = timeRangeOptions.find(opt => opt.value === selectedRange)?.label || 'Select Range';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
            >
                <Calendar size={16} className="text-[var(--text-secondary)]" />
                <span>{selectedLabel}</span>
                <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl z-50 py-1">
                    {timeRangeOptions.map(option => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onRangeChange(option.value);
                                if (option.value !== 'custom') {
                                    setIsOpen(false);
                                }
                            }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedRange === option.value
                                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}

                    {selectedRange === 'custom' && onCustomDateChange && (
                        <div className="px-3 py-2 border-t border-[var(--border)] space-y-2">
                            <input
                                type="date"
                                value={customStartDate || ''}
                                onChange={(e) => onCustomDateChange(e.target.value, customEndDate || '')}
                                className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)]"
                                style={{ colorScheme: 'dark' }}
                            />
                            <input
                                type="date"
                                value={customEndDate || ''}
                                onChange={(e) => onCustomDateChange(customStartDate || '', e.target.value)}
                                className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)]"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TimeRangeFilter;
