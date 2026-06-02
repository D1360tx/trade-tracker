import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Refresh Schwab Access Token
 * 
 * POST /api/schwab/refresh
 * Body: { refreshToken: string }
 * 
 * Returns new access token using refresh token
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Missing refresh token' });
    }

    const clientId = process.env.SCHWAB_CLIENT_ID;
    const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Schwab API not configured' });
    }

    try {
        const tokenUrl = 'https://api.schwabapi.com/v1/oauth/token';
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Schwab token refresh failed:', errorText);

            const lowerError = errorText.toLowerCase();
            const clearlyInvalidRefreshToken = response.status === 401
                || lowerError.includes('invalid_grant')
                || lowerError.includes('refresh token expired')
                || lowerError.includes('invalid refresh');

            if (clearlyInvalidRefreshToken) {
                return res.status(401).json({
                    error: 'Refresh token expired',
                    message: 'Schwab requires reconnect before syncing again.',
                    requiresReauth: true
                });
            }

            return res.status(response.status).json({
                error: 'Token refresh failed',
                message: 'Schwab token refresh failed temporarily. Your connection was not cleared.',
                details: errorText,
                requiresReauth: false
            });
        }

        const tokens = await response.json();
        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        return res.status(200).json({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || refreshToken, // Some APIs return new refresh token
            expiresAt,
            refreshExpiresAt: tokens.refresh_token ? Date.now() + (7 * 24 * 60 * 60 * 1000) : undefined,
            tokenType: tokens.token_type
        });

    } catch (error: unknown) {
        console.error('Schwab refresh error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
