import { useMemo } from 'react';
import { useTrades } from '../context/TradeContext';
import { generateInsights } from '../utils/insightGenerator';
import { Brain, Zap, AlertTriangle, TrendingUp } from 'lucide-react';

const AIInsights = () => {
    const { trades } = useTrades();
    const { metrics, patterns } = useMemo(() => generateInsights(trades), [trades]);

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-xl shadow-lg shadow-purple-500/20">
                    <Brain className="text-white" size={24} />
                </div>
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">
                        AI Trading Coach
                    </h2>
                    <p className="text-[var(--text-secondary)]">Psychology analysis & pattern recognition</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {metrics.map(metric => (
                    <div key={metric.id} className="glass-panel p-6 rounded-xl relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-[var(--text-secondary)] font-medium">{metric.label}</span>
                            <Zap size={16} className="text-[var(--accent-primary)]" />
                        </div>
                        <h3 className={`text-3xl font-bold mb-2 ${metric.color}`}>{metric.value}</h3>
                        <p className="text-sm text-[var(--text-tertiary)]">{metric.desc}</p>
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-${metric.color.split('-')[1]}-500/10 to-transparent rounded-bl-full`}></div>
                    </div>
                ))}
            </div>

            <h3 className="text-xl font-bold mt-8 flex items-center gap-2">
                <TrendingUp className="text-[var(--accent-primary)]" size={20} />
                Detected Patterns
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {patterns.map(pattern => (
                    <div key={pattern.id} className="glass-panel p-6 rounded-xl border-l-4 border-l-[var(--accent-primary)] hover:translate-x-1 transition-transform">
                        <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${pattern.type === 'positive' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                {pattern.type === 'positive' ? <Zap size={20} /> : <AlertTriangle size={20} />}
                            </div>
                            <div>
                                <h4 className="font-bold text-lg mb-1">{pattern.title}</h4>
                                <p className="text-[var(--text-secondary)] leading-relaxed">
                                    {pattern.desc}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIInsights;
