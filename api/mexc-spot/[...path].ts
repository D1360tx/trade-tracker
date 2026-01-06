import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * MEXC Spot API Proxy
 * Forwards requests to MEXC Spot API v3 with proper authentication
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MEXC-APIKEY');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Extract the path after /api/mexc-spot/
        const path = (req.query.path as string[])?.join('/') || '';

        // MEXC Spot base URL
        const MEXC_SPOT_BASE = 'https://api.mexc.com';

        // Construct the full URL with query parameters
        const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
        const targetUrl = `${MEXC_SPOT_BASE}/${path}${queryString ? `?${queryString}` : ''}`;

        console.log('[MEXC Spot Proxy] Forwarding to:', targetUrl);

        // Forward the request to MEXC
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // Forward API key header if present
        const apiKey = req.headers['x-mexc-apikey'];
        if (apiKey) {
            headers['X-MEXC-APIKEY'] = apiKey as string;
        }

        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();

        // Forward the response
        res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[MEXC Spot Proxy] Error:', error);
        res.status(500).json({
            error: 'Failed to fetch from MEXC Spot API',
            message: error.message,
        });
    }
}
