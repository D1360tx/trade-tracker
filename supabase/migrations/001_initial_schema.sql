-- Trade Tracker Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/iwwalsauixbaupmvesna/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STRATEGIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- RLS Policies for strategies
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strategies"
    ON strategies FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategies"
    ON strategies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies"
    ON strategies FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategies"
    ON strategies FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- MISTAKES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS mistakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- RLS Policies for mistakes
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mistakes"
    ON mistakes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mistakes"
    ON mistakes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mistakes"
    ON mistakes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mistakes"
    ON mistakes FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- TRADES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL,
    direction TEXT NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_price NUMERIC NOT NULL,
    quantity NUMERIC NOT NULL,
    entry_date TIMESTAMPTZ NOT NULL,
    exit_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    pnl NUMERIC NOT NULL,
    pnl_percentage NUMERIC NOT NULL,
    fees NUMERIC NOT NULL,
    notes TEXT,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    mistakes UUID[],
    initial_risk NUMERIC,
    leverage NUMERIC,
    notional NUMERIC,
    margin NUMERIC,
    is_bot BOOLEAN DEFAULT false,
    external_oid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_exit_date ON trades(exit_date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_trades_exchange ON trades(exchange);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- RLS Policies for trades
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades"
    ON trades FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
    ON trades FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
    ON trades FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
    ON trades FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- USER SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    column_order JSONB,
    default_filters JSONB,
    notification_preferences JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
    ON user_settings FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_strategies_updated_at
    BEFORE UPDATE ON strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mistakes_updated_at
    BEFORE UPDATE ON mistakes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Trade Tracker database schema created successfully!';
    RAISE NOTICE 'Tables created: strategies, mistakes, trades, user_settings';
    RAISE NOTICE 'Row Level Security enabled on all tables';
    RAISE NOTICE 'Ready for authentication and data migration';
END $$;
