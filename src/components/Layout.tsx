import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Wallet, Settings, Menu, X, Bell, Calendar, Brain, Upload, BarChart2, FileText, ChevronLeft, ChevronRight, Bot, TrendingUp, LogOut, RefreshCw } from 'lucide-react';
import AIChat from './AIChat';
import { useTrades } from '../context/TradeContext';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
    const { lastUpdated, fetchTradesFromAPI, isLoading } = useTrades();
    const { user, signOut } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(() => {
        const saved = localStorage.getItem('sidebar_collapsed');
        return saved === 'true';
    });
    const sidebarRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        localStorage.setItem('sidebar_collapsed', String(isCollapsed));
    }, [isCollapsed]);

    // Close mobile menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isMobileMenuOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsMobileMenuOpen(false);
            }
        };

        if (isMobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMobileMenuOpen]);

    // Handle sync button click
    const handleSyncExchanges = async () => {
        const toSync: string[] = [];

        // Check for Schwab OAuth (stored in localStorage or context)
        const schwabTokens = localStorage.getItem('schwab_access_token');
        if (schwabTokens) {
            toSync.push('Schwab');
        }

        // Check for MEXC credentials
        const mexcKey = localStorage.getItem('mexc_api_key');
        if (mexcKey) {
            toSync.push('MEXC');
        }

        // Check for ByBit credentials
        const bybitKey = localStorage.getItem('bybit_api_key');
        if (bybitKey) {
            toSync.push('ByBit');
        }

        if (toSync.length === 0) {
            alert('No exchange API keys configured. Please add API keys in Settings or connect via OAuth.');
            return;
        }

        await Promise.all(toSync.map(ex => fetchTradesFromAPI(ex as any)));
    };

    const navItems = [
        { icon: TrendingUp, label: 'Overview', path: '/overview' },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: FileText, label: 'Journal', path: '/journal' },
        { icon: Calendar, label: 'Calendar', path: '/calendar' },

        { icon: BookOpen, label: 'Playbook', path: '/playbook' },
        { icon: BarChart2, label: 'Analytics', path: '/analytics' },
        { icon: FileText, label: 'Reports', path: '/reports' },
        { icon: Brain, label: 'AI Coach', path: '/ai-insights' },
        { icon: Bot, label: 'Bot Performance', path: '/bots' },
        { icon: Upload, label: 'Import Data', path: '/import' },
        { icon: Wallet, label: 'Accounts', path: '/accounts' }, // Placeholder
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
            {/* Mobile Menu Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                className={`
          fixed inset-y-0 left-0 z-50 bg-[var(--bg-secondary)] border-r border-[var(--border)]
          transform transition-all duration-300 ease-in-out flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'} md:relative
        `}
            >
                <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16`}>
                    {!isCollapsed && (
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--success)] to-[var(--accent-primary)] bg-clip-text text-transparent whitespace-nowrap overflow-hidden">
                            TradeTracker
                        </h1>
                    )}
                    {isCollapsed && (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--success)] flex-shrink-0"></div>
                    )}

                    <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            title={isCollapsed ? item.label : ''}
                            className={({ isActive }) => `
                flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 whitespace-nowrap
                ${isActive
                                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
                        >
                            <item.icon size={20} className="min-w-[20px]" />
                            <span className={`transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                                {item.label}
                            </span>
                        </NavLink>
                    ))}
                </nav>

                {/* Last Updated Footer */}
                <div className={`px-4 py-2 text-xs text-[var(--text-tertiary)] border-t border-[var(--border)] ${isCollapsed ? 'hidden' : 'block'}`}>
                    {lastUpdated ? (
                        <span>Last Synced: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : (
                        <span>Sync Active</span>
                    )}
                </div>

                {/* Collapse Toggle (Desktop Only) */}
                <div className="hidden md:flex p-4 border-t border-[var(--border)] justify-end">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-16 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="md:hidden text-[var(--text-primary)]"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="ml-auto flex items-center gap-4">
                        {user?.email && (
                            <span className="hidden sm:block text-sm text-[var(--text-secondary)]">
                                {user.email}
                            </span>
                        )}
                        <button
                            onClick={handleSyncExchanges}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 transition-colors"
                            title="Sync all connected exchanges"
                        >
                            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">{isLoading ? 'Syncing...' : 'Sync'}</span>
                        </button>
                        <button
                            onClick={() => signOut()}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            title="Sign out"
                        >
                            <LogOut size={18} />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                        <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] relative">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--danger)] rounded-full"></span>
                        </button>
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--success)]"></div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-6 scroll-smooth">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>

            <AIChat />
        </div>
    );
};

export default Layout;
