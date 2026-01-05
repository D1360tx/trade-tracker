import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Handle Schwab OAuth Callback
 * 
 * GET /api/schwab/callback?code=xxx
 * 
 * Exchanges authorization code for access + refresh tokens
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.query;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Missing authorization code' });
    }

    const clientId = process.env.SCHWAB_CLIENT_ID;
    const clientSecret = process.env.SCHWAB_CLIENT_SECRET;
    const callbackUrl = process.env.SCHWAB_CALLBACK_URL || 'https://127.0.0.1';

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Schwab API not configured' });
    }

    try {
        // Exchange authorization code for tokens
        const tokenUrl = 'https://api.schwabapi.com/v1/oauth/token';

        // Schwab uses Basic Auth with client_id:client_secret
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: callbackUrl
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Schwab token exchange failed:', errorText);
            return res.status(response.status).json({
                error: 'Token exchange failed',
                details: errorText
            });
        }

        const tokens = await response.json();

        // Calculate expiration timestamp (access token valid for 30 min)
        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Return tokens to frontend
        // In production, you might want to set HttpOnly cookies instead
        const tokenData = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt,
            tokenType: tokens.token_type,
            scope: tokens.scope
        };

        // Redirect to a page that will receive the tokens
        // We use a simple HTML page that posts message to parent window
        const html = `
            <!DOCTYPE html>
            <html>
            <head><title>Schwab Connected</title></head>
            <body>
                <h2>✅ Connected to Schwab!</h2>
                <p>You can close this window.</p>
                <script>
                    const tokenData = ${JSON.stringify(tokenData)};
                    // Send to opener window
                    if (window.opener) {
                        window.opener.postMessage({ type: 'SCHWAB_AUTH_SUCCESS', data: tokenData }, '*');
                        setTimeout(() => window.close(), 1500);
                    } else {
                        // Fallback: store in localStorage
                        localStorage.setItem('schwab_tokens', btoa(JSON.stringify(tokenData)));
                        setTimeout(() => {
                            window.location.href = '/import';
                        }, 1500);
                    }
                </script>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

    } catch (error: any) {
        console.error('Schwab callback error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
