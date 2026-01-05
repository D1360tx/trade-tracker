import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string;
    change?: number;
    icon?: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, change, icon, trend }) => {
    const isPositive = trend === 'up';
    const isNegative = trend === 'down';

    return (
        <div className="glass-panel p-6 rounded-xl relative overflow-hidden group hover:border-[var(--text-tertiary)] transition-colors">
            <div className="flex items-start justify-between mb-4">
                <span className="text-[var(--text-secondary)] text-sm font-medium">{label}</span>
                {icon && <div className="text-[var(--accent-primary)] p-2 bg-[var(--accent-primary)]/10 rounded-lg">{icon}</div>}
            </div>

            <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-[var(--text-primary)]">{value}</h3>
            </div>

            {change !== undefined && (
                <div className={`flex items-center gap-1 mt-2 text-sm ${isPositive ? 'text-[var(--success)]' : isNegative ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'}`}>
                    {isPositive ? <ArrowUpRight size={16} /> : isNegative ? <ArrowDownRight size={16} /> : null}
                    <span className="font-medium">{Math.abs(change)}%</span>
                    <span className="text-[var(--text-tertiary)] ml-1">vs last month</span>
                </div>
            )}

            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-tr from-[var(--accent-primary)]/20 to-transparent rounded-full blur-2xl group-hover:bg-[var(--accent-primary)]/30 transition-all duration-500"></div>
        </div>
    );
};

export default StatCard;
