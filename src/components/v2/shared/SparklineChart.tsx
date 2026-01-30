import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineChartProps {
    data: { value: number }[];
    width?: number | string;
    height?: number;
    color?: string;
    strokeWidth?: number;
    showArea?: boolean;
    areaOpacity?: number;
}

const SparklineChart = ({
    data,
    width = '100%',
    height = 40,
    color = 'var(--success)',
    strokeWidth = 2,
    showArea = true,
    areaOpacity = 0.1,
}: SparklineChartProps) => {
    // Determine color based on final value (positive = green, negative = red)
    const finalValue = data.length > 0 ? data[data.length - 1].value : 0;
    const lineColor = finalValue >= 0 ? 'var(--success)' : 'var(--danger)';
    const actualColor = color === 'auto' ? lineColor : color;

    if (data.length === 0) {
        return (
            <div
                style={{ width: typeof width === 'number' ? `${width}px` : width, height }}
                className="flex items-center justify-center"
            >
                <span className="text-xs text-[var(--text-tertiary)]">No data</span>
            </div>
        );
    }

    return (
        <div style={{ width: typeof width === 'number' ? `${width}px` : width, height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                    <defs>
                        <linearGradient id={`sparklineGradient-${actualColor}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={actualColor} stopOpacity={areaOpacity} />
                            <stop offset="95%" stopColor={actualColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={actualColor}
                        strokeWidth={strokeWidth}
                        dot={false}
                        fill={showArea ? `url(#sparklineGradient-${actualColor})` : 'none'}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SparklineChart;
