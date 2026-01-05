import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Generate Schwab OAuth Authorization URL
 * 
 * GET /api/schwab/auth-url
 * 
 * Returns the URL to redirect user to for Schwab login
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const clientId = process.env.SCHWAB_CLIENT_ID;
    const callbackUrl = process.env.SCHWAB_CALLBACK_URL || 'https://127.0.0.1';

    if (!clientId) {
        return res.status(500).json({
            error: 'Schwab API not configured',
            message: 'Please set SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET environment variables'
        });
    }

    // Schwab OAuth authorization endpoint
    const authUrl = new URL('https://api.schwabapi.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    // Request access to accounts and trading
    authUrl.searchParams.set('scope', 'readonly');

    return res.status(200).json({
        authUrl: authUrl.toString(),
        callbackUrl
    });
}
