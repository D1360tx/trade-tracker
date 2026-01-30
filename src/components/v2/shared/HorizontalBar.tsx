interface HorizontalBarProps {
    leftValue: number;
    leftLabel: string;
    leftColor?: string;
    rightValue: number;
    rightLabel: string;
    rightColor?: string;
    height?: number;
    showLabels?: boolean;
    formatValue?: (value: number) => string;
}

const HorizontalBar = ({
    leftValue,
    leftLabel,
    leftColor = 'var(--success)',
    rightValue,
    rightLabel,
    rightColor = 'var(--danger)',
    height = 8,
    showLabels = true,
    formatValue = (v) => `$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
}: HorizontalBarProps) => {
    const total = leftValue + rightValue;
    const leftPercent = total > 0 ? (leftValue / total) * 100 : 50;
    const rightPercent = total > 0 ? (rightValue / total) * 100 : 50;

    return (
        <div className="w-full">
            {showLabels && (
                <div className="flex justify-between mb-1">
                    <span style={{ color: leftColor }} className="text-xs font-medium">
                        {formatValue(leftValue)}
                    </span>
                    <span style={{ color: rightColor }} className="text-xs font-medium">
                        {formatValue(rightValue)}
                    </span>
                </div>
            )}
            <div
                className="w-full rounded-full overflow-hidden flex"
                style={{ height: `${height}px`, backgroundColor: 'var(--bg-tertiary)' }}
            >
                <div
                    className="transition-all duration-300 rounded-l-full"
                    style={{
                        width: `${leftPercent}%`,
                        backgroundColor: leftColor,
                    }}
                />
                <div
                    className="transition-all duration-300 rounded-r-full"
                    style={{
                        width: `${rightPercent}%`,
                        backgroundColor: rightColor,
                    }}
                />
            </div>
            {showLabels && (
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--text-tertiary)]">{leftLabel}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{rightLabel}</span>
                </div>
            )}
        </div>
    );
};

export default HorizontalBar;
