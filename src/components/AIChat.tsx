import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { useTrades } from '../context/TradeContext';
import { generateInsights } from '../utils/insightGenerator';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

import { sendMessageToAI } from '../utils/aiService';
import { buildTradeContext } from '../utils/aiContext';

const AIChat = () => {
    const { trades } = useTrades();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', text: "Hi! I'm your trading assistant. Ask me about your P&L, recent trades, or psychology tips.", sender: 'bot', timestamp: new Date() }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsThinking(true);

        const apiKey = localStorage.getItem('ai_api_key');

        if (apiKey) {
            // --- SMART AI MODE ---
            const context = buildTradeContext(trades);
            const aiResponse = await sendMessageToAI(userMsg.text, context, apiKey);

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: aiResponse,
                sender: 'bot',
                timestamp: new Date()
            }]);
            setIsThinking(false);
            return;
        }

        // --- LOCAL FALLBACK MODE ---
        setTimeout(() => {
            let responseText = "I'm not sure about that yet. Add a Gemini API Key in Settings for smarter answers!";
            const lowerInput = userMsg.text.toLowerCase();

            // Calculate live stats
            const { metrics, patterns } = generateInsights(trades);
            const totalPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
            const winRate = (trades.filter(t => t.pnl > 0).length / trades.filter(t => t.status === 'CLOSED' || t.pnl !== 0).length * 100) || 0;

            // Calculate Daily Stats
            const dailyPnL: Record<string, number> = {};
            trades.forEach(t => {
                const date = t.exitDate.split('T')[0];
                dailyPnL[date] = (dailyPnL[date] || 0) + t.pnl;
            });

            const days = Object.entries(dailyPnL);
            const bestDay = days.reduce((max, current) => current[1] > max[1] ? current : max, ['', -Infinity]);
            const worstDay = days.reduce((min, current) => current[1] < min[1] ? current : min, ['', Infinity]);

            // Intent Recognition
            if (lowerInput.includes('best day') || lowerInput.includes('most profitable day') || lowerInput.includes('biggest win day')) {
                if (bestDay[0]) {
                    responseText = `Your best trading day was ${bestDay[0]} with a profit of $${bestDay[1].toFixed(2)}.`;
                } else {
                    responseText = "You don't have enough trading history to determine your best day yet.";
                }
            } else if (lowerInput.includes('worst day') || lowerInput.includes('biggest loss day')) {
                if (worstDay[0]) {
                    responseText = `Your worst trading day was ${worstDay[0]} with a loss of $${Math.abs(worstDay[1]).toFixed(2)}.`;
                } else {
                    responseText = "You don't have enough trading history to determine your worst day yet.";
                }
            } else if (lowerInput.includes('p&l') || lowerInput.includes('money') || lowerInput.includes('profit')) {
                responseText = `You are currently ${totalPnL >= 0 ? 'up' : 'down'} $${Math.abs(totalPnL).toLocaleString()} total. Your win rate is ${winRate.toFixed(1)}%.`;
            } else if (lowerInput.includes('bad') || lowerInput.includes('loss') || lowerInput.includes('lose')) {
                const revenge = metrics.find(m => m.label === 'Revenge Risk');
                responseText = `Losses are part of the game. Your revenge trading risk is currently '${revenge?.value}'. ${revenge?.desc}`;
            } else if (lowerInput.includes('strategy') || lowerInput.includes('setup') || lowerInput.includes('best')) {
                const bestPattern = patterns.find(p => p.type === 'positive');
                if (bestPattern) {
                    responseText = `${bestPattern.title}: ${bestPattern.desc}`;
                } else {
                    responseText = "I see no clear 'best setup' yet. Keep logging trades!";
                }
            } else if (lowerInput.includes('worst') || lowerInput.includes('weakness')) {
                const worstPattern = patterns.find(p => p.type === 'negative');
                if (worstPattern) {
                    responseText = `Watch out for: ${worstPattern.desc}`;
                } else {
                    responseText = "You don't have any major glaring weaknesses detected yet. Good job!";
                }
            } else if (lowerInput.includes('streak')) {
                const streak = metrics.find(m => m.label === 'Best Win Streak');
                responseText = `Your best winning streak is ${streak?.value} trades in a row!`;
            }

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botMsg]);
            setIsThinking(false);
        }, 1000);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110
          ${isOpen ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rotate-90' : 'bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 text-white'}
        `}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>

            {/* Chat Window */}
            <div className={`
        fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] z-50 glass-panel rounded-2xl flex flex-col shadow-2xl border-[var(--border)]
        transition-all duration-300 origin-bottom-right
        ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'}
      `}>
                {/* Header */}
                <div className="p-4 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]/50 rounded-t-2xl">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Bot size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold">AI Assistant</h3>
                        <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                            <span className={`w-2 h-2 ${isThinking ? 'bg-yellow-500 animate-ping' : 'bg-green-500 animate-pulse'} rounded-full`}></span>
                            {isThinking ? 'Thinking...' : 'Online'}
                        </p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                        max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed
                        ${msg.sender === 'user'
                                    ? 'bg-[var(--accent-primary)] text-white rounded-tr-sm'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-tl-sm'
                                }
                    `}>
                                {msg.sender === 'user' ? (
                                    msg.text
                                ) : (
                                    <ReactMarkdown
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                                            li: ({ node, ...props }) => <li className="" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-bold text-[var(--text-primary)]" {...props} />,
                                            h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2 mt-3" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-1 mt-2" {...props} />,
                                            code: ({ node, ...props }) => <code className="bg-black/20 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                                            blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-[var(--accent-primary)] pl-3 italic my-2" {...props} />,
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]/50 rounded-b-2xl">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Ask about your trades..."
                            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-full px-4 py-2 text-sm outline-none focus:border-[var(--accent-primary)] transition-colors"
                        />
                        <button
                            onClick={handleSend}
                            className="p-2 bg-[var(--accent-primary)] text-white rounded-full hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!inputValue.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AIChat;
