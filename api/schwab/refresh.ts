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

    const maxRetries = 3;
    let lastErrorText = '';
    let lastStatus = 500;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

            lastStatus = response.status;

            if (!response.ok) {
                lastErrorText = await response.text();
                console.error(`Schwab token refresh failed (attempt ${attempt}/${maxRetries}):`, lastErrorText);

                const lowerError = lastErrorText.toLowerCase();
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

                // Transient error: retry unless last attempt
                if (attempt < maxRetries) {
                    const backoffMs = 500 * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
                    await new Promise(r => setTimeout(r, backoffMs));
                    continue;
                }

                return res.status(lastStatus).json({
                    error: 'Token refresh failed',
                    message: 'Schwab token refresh failed temporarily. Your connection was not cleared.',
                    details: lastErrorText,
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
            lastErrorText = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Schwab refresh error (attempt ${attempt}/${maxRetries}):`, lastErrorText);

            if (attempt < maxRetries) {
                const backoffMs = 500 * Math.pow(2, attempt - 1);
                await new Promise(r => setTimeout(r, backoffMs));
                continue;
            }
        }
    }

    return res.status(lastStatus || 500).json({
        error: 'Internal server error',
        message: lastErrorText || 'Unknown error after retries'
    });
}
