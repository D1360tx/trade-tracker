import { useState, useEffect } from 'react';
import { Save, CheckCircle, Eye, EyeOff, ChevronRight, Bot, Sparkles, AlertCircle } from 'lucide-react';

const EXCHANGES = [
    { id: 'MEXC', name: 'MEXC Global', color: 'bg-blue-500' },
    { id: 'Binance', name: 'Binance', color: 'bg-yellow-500' },
    { id: 'ByBit', name: 'ByBit', color: 'bg-orange-500' },
    { id: 'Coinbase', name: 'Coinbase', color: 'bg-blue-600' },
    { id: 'BloFin', name: 'BloFin', color: 'bg-purple-600' },
    { id: 'Schwab', name: 'Charles Schwab', color: 'bg-blue-400' },
    { id: 'Interactive Brokers', name: 'Interactive Brokers', color: 'bg-red-500' },
];

import { sendMessageToAI } from '../utils/aiService';

const SettingsPage = () => {
    const [selectedExchange, setSelectedExchange] = useState('MEXC');
    const [keys, setKeys] = useState<Record<string, { key: string, secret: string }>>({});
    const [aiKey, setAiKey] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        // Load all keys
        const newKeys: Record<string, { key: string, secret: string }> = {};
        EXCHANGES.forEach(ex => {
            newKeys[ex.id] = {
                key: localStorage.getItem(`${ex.id.toLowerCase()}_api_key`) || '',
                secret: localStorage.getItem(`${ex.id.toLowerCase()}_api_secret`) || ''
            };
        });
        setKeys(newKeys);
        setAiKey(localStorage.getItem('ai_api_key') || '');
    }, []);

    const handleChange = (field: 'key' | 'secret', value: string) => {
        setKeys(prev => ({
            ...prev,
            [selectedExchange]: {
                ...prev[selectedExchange],
                [field]: value
            }
        }));
    };

    const handleSave = () => {
        setStatus('saving');

        // Save current exchange keys
        const current = keys[selectedExchange];
        localStorage.setItem(`${selectedExchange.toLowerCase()}_api_key`, current.key);
        localStorage.setItem(`${selectedExchange.toLowerCase()}_api_secret`, current.secret);

        // Save AI Key
        const trimmedKey = aiKey.trim();
        localStorage.setItem('ai_api_key', trimmedKey);
        setAiKey(trimmedKey);

        setTimeout(() => {
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 3000);
        }, 800);
    };

    const handleTestAI = async () => {
        if (!aiKey) {
            setTestMessage('Please enter an API Key first.');
            setStatus('error');
            return;
        }

        setStatus('testing');
        setTestMessage('');

        const response = await sendMessageToAI("Hello, are you online?", "User is testing connection.", aiKey);

        if (response.startsWith('Connection Error')) {
            setTestMessage(response);
            setStatus('error');
        } else {
            setTestMessage('Connection Successful! AI is ready.');
            setStatus('success');
        }
    };

    const currentExchange = EXCHANGES.find(e => e.id === selectedExchange) || EXCHANGES[0];

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 bg-clip-text text-transparent">Settings</h2>
                <p className="text-[var(--text-secondary)]">Manage API keys for your exchanges.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar */}
                <div className="glass-panel p-4 rounded-xl space-y-2 h-fit">
                    <h3 className="text-sm font-bold text-[var(--text-tertiary)] uppercase mb-4 px-2">Exchanges</h3>
                    {EXCHANGES.map(ex => (
                        <button
                            key={ex.id}
                            onClick={() => { setSelectedExchange(ex.id); setStatus('idle'); }}
                            className={`
                                w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all
                                ${selectedExchange === ex.id
                                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
                                    : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-transparent'
                                }
                           `}
                        >
                            <span className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${ex.color}`}></span>
                                {ex.name}
                            </span>
                            {selectedExchange === ex.id && <ChevronRight size={16} />}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="md:col-span-2 glass-panel p-8 rounded-xl space-y-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border)]">
                        <div className={`w-12 h-12 rounded-full ${currentExchange.color}/20 flex items-center justify-center`}>
                            <span className={`text-lg font-bold ${currentExchange.color.replace('bg-', 'text-')}`}>
                                {currentExchange.name[0]}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{currentExchange.name}</h3>
                            <p className="text-xs text-[var(--text-tertiary)]">Configure API access</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">API Key</label>
                            <input
                                type="text"
                                value={keys[selectedExchange]?.key || ''}
                                onChange={(e) => handleChange('key', e.target.value)}
                                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-3 outline-none focus:border-[var(--accent-primary)] transition-colors"
                                placeholder={`Enter ${currentExchange.name} API Key`}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Secret Key</label>
                            <div className="relative">
                                <input
                                    type={showSecret ? "text" : "password"}
                                    value={keys[selectedExchange]?.secret || ''}
                                    onChange={(e) => handleChange('secret', e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-3 outline-none focus:border-[var(--accent-primary)] transition-colors pr-12"
                                    placeholder={`Enter ${currentExchange.name} Secret Key`}
                                />
                                <button
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                >
                                    {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* AI Settings */}
                <div className="md:col-span-2 glass-panel p-8 rounded-xl space-y-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border)]">
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Bot className="text-purple-500" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">AI Assistant</h3>
                            <p className="text-xs text-[var(--text-tertiary)]">Configure LLM integration</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-[var(--text-secondary)]">Google Gemini API Key</label>
                                <span className="text-xs px-2 py-0.5 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-full flex items-center gap-1">
                                    <Sparkles size={10} /> Recommended
                                </span>
                            </div>
                            <div className="relative">
                                <input
                                    type={showSecret ? "text" : "password"}
                                    value={aiKey}
                                    onChange={(e) => setAiKey(e.target.value)}
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-4 py-3 outline-none focus:border-[var(--accent-primary)] transition-colors pr-12"
                                    placeholder="Enter your Gemini API Key"
                                />
                                <button
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                >
                                    {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <p className="text-xs text-[var(--text-tertiary)]">
                                    Don't have one? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline">Get a free key here</a>.
                                </p>
                                <button
                                    onClick={handleTestAI}
                                    disabled={status === 'testing' || !aiKey}
                                    className="px-3 py-1.5 text-xs font-medium bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {status === 'testing' ? <span className="animate-spin">⏳</span> : <Bot size={14} />}
                                    Test Connection
                                </button>
                            </div>

                            {/* Test Result Message */}
                            {testMessage && (
                                <div className={`mt-2 p-3 rounded-lg text-sm flex items-start gap-2 ${status === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                    {status === 'error' ? <AlertCircle size={16} className="mt-0.5" /> : <CheckCircle size={16} className="mt-0.5" />}
                                    <span>{testMessage}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="md:col-span-3 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={status === 'saving'}
                        className={`
                            flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-lg transition-all shadow-lg
                            ${status === 'saved'
                                ? 'bg-[var(--success)] text-white'
                                : 'bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 hover:scale-[1.02] text-white'}
                        `}
                    >
                        {status === 'saved' ? (
                            <>
                                <CheckCircle size={24} />
                                Settings Saved
                            </>
                        ) : (
                            <>
                                <Save size={24} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
