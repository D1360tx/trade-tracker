
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Calendar from './pages/Calendar';
import Analytics from './pages/Analytics';
import AIInsights from './pages/AIInsights';
import ImportPage from './pages/ImportPage';
import SettingsPage from './pages/SettingsPage';
import PlaybookPage from './pages/PlaybookPage';
import OverviewPage from './pages/OverviewPage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import { AuthProvider } from './context/AuthContext';
import { TradeProvider } from './context/TradeContext';
import { StrategyProvider } from './context/StrategyContext';
import { MistakeProvider } from './context/MistakeContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ReportsPage from './pages/ReportsPage';
import BotDashboard from './pages/BotDashboard';
import DashboardV2 from './pages/v2/DashboardV2';
import ReportsV2 from './pages/v2/ReportsV2';
import TradeViewV2 from './pages/v2/TradeViewV2';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />

          {/* Protected App Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TradeProvider>
                  <StrategyProvider>
                    <MistakeProvider>
                      <Layout />
                    </MistakeProvider>
                  </StrategyProvider>
                </TradeProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="journal" element={<Journal />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/playbook" element={<PlaybookPage />} />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="bots" element={<BotDashboard />} />
            <Route path="dashboard-v2" element={<DashboardV2 />} />
            <Route path="reports-v2" element={<ReportsV2 />} />
            <Route path="trade-v2/:id" element={<TradeViewV2 />} />
            <Route path="accounts" element={<div className="p-10 text-center text-[var(--text-tertiary)]">Accounts Placeholder</div>} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
