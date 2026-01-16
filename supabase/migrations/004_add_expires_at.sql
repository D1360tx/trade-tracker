-- Add expires_at column to api_credentials for OAuth token expiration tracking
-- Run this in Supabase SQL Editor

ALTER TABLE api_credentials 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add comment explaining the column
COMMENT ON COLUMN api_credentials.expires_at IS 'Token expiration time for OAuth-based integrations like Schwab';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Added expires_at column to api_credentials table';
END $$;
