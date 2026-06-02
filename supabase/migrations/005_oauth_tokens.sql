-- Dedicated OAuth token storage for providers such as Schwab.
-- Keeps OAuth metadata separate from exchange API key credentials.

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    last_refreshed_at TIMESTAMPTZ,
    last_successful_sync_at TIMESTAMPTZ,
    last_error TEXT,
    status TEXT NOT NULL DEFAULT 'connected',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider),
    CONSTRAINT oauth_tokens_status_check CHECK (
        status IN ('connected', 'refresh_failed', 'reauth_required', 'disconnected')
    )
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OAuth tokens"
    ON oauth_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OAuth tokens"
    ON oauth_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OAuth tokens"
    ON oauth_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own OAuth tokens"
    ON oauth_tokens FOR DELETE
    USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON oauth_tokens;
CREATE TRIGGER update_oauth_tokens_updated_at
    BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Backfill existing Schwab OAuth rows from api_credentials.
INSERT INTO oauth_tokens (
    user_id,
    provider,
    access_token,
    refresh_token,
    access_expires_at,
    refresh_expires_at,
    last_refreshed_at,
    status
)
SELECT
    user_id,
    'schwab',
    api_key,
    api_secret,
    COALESCE(expires_at, NOW() + INTERVAL '30 minutes'),
    NOW() + INTERVAL '7 days',
    NOW(),
    'connected'
FROM api_credentials
WHERE exchange = 'Schwab'
  AND is_active = true
  AND api_key IS NOT NULL
  AND api_secret IS NOT NULL
ON CONFLICT (user_id, provider) DO NOTHING;
