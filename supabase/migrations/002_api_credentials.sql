-- API Credentials Table
-- Run this in Supabase SQL Editor after the initial schema

-- =====================================================
-- API CREDENTIALS TABLE  
-- =====================================================
CREATE TABLE IF NOT EXISTS api_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exchange TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, exchange)
);

-- RLS Policies for api_credentials
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API credentials"
    ON api_credentials FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API credentials"
    ON api_credentials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API credentials"
    ON api_credentials FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API credentials"
    ON api_credentials FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_api_credentials_updated_at
    BEFORE UPDATE ON api_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'API Credentials table created successfully!';
    RAISE NOTICE 'Note: Credentials are NOT encrypted at rest in this basic implementation';
    RAISE NOTICE 'For production, consider using Supabase Vault or encrypt before storing';
END $$;
