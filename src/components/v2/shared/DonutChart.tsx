import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Segment {
    value: number;
    color: string;
    label?: string;
}

interface DonutChartProps {
    // Single value mode (progress toward max)
    value?: number;
    max?: number;
    color?: string;
    // Multi-segment mode
    segments?: Segment[];
    // Common props
    size?: 'sm' | 'md' | 'lg';
    showValue?: boolean;
    valueFormatter?: (value: number) => string;
    centerLabel?: string;
    thickness?: number;
}

const DonutChart = ({
    value,
    max = 100,
    color = 'var(--success)',
    segments,
    size = 'md',
    showValue = false,
    valueFormatter,
    centerLabel,
    thickness,
}: DonutChartProps) => {
    const sizeMap = {
        sm: { width: 48, height: 48, inner: 14, outer: 20 },
        md: { width: 64, height: 64, inner: 18, outer: 28 },
        lg: { width: 96, height: 96, inner: 28, outer: 42 },
    };

    const dimensions = sizeMap[size];
    const innerRadius = thickness ? dimensions.outer - thickness : dimensions.inner;

    // Generate chart data
    let chartData: { value: number; fill: string }[];

    if (segments && segments.length > 0) {
        // Multi-segment mode
        const total = segments.reduce((sum, s) => sum + s.value, 0);
        if (total === 0) {
            chartData = [{ value: 1, fill: 'var(--bg-tertiary)' }];
        } else {
            chartData = segments.map(s => ({
                value: s.value,
                fill: s.color,
            }));
        }
    } else {
        // Single value mode (progress)
        const normalizedValue = Math.min(Math.max(value || 0, 0), max);
        const remaining = max - normalizedValue;

        if (normalizedValue === 0) {
            chartData = [{ value: 1, fill: 'var(--bg-tertiary)' }];
        } else {
            chartData = [
                { value: normalizedValue, fill: color },
                { value: remaining, fill: 'var(--bg-tertiary)' },
            ];
        }
    }

    const displayValue = segments
        ? segments.reduce((sum, s) => sum + s.value, 0)
        : value || 0;

    return (
        <div className="relative" style={{ width: dimensions.width, height: dimensions.height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={dimensions.outer}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            {(showValue || centerLabel) && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                        {centerLabel || (valueFormatter ? valueFormatter(displayValue) : displayValue)}
                    </span>
                </div>
            )}
        </div>
    );
};

export default DonutChart;
