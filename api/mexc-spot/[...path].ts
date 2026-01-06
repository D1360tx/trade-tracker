import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * MEXC Spot API Proxy
 * Forwards requests to MEXC Spot API v3 with proper authentication
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-MEXC-APIKEY, ApiKey, Request-Time, Signature');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Extract the full request URL and parse it
        const reqUrl = new URL(req.url!, `https://${req.headers.host}`);

        // Get the path after /api/mexc-spot/
        const fullPath = reqUrl.pathname.replace('/api/mexc-spot/', '');

        // MEXC Spot base URL
        const MEXC_SPOT_BASE = 'https://api.mexc.com';

        // Forward query parameters
        const targetUrl = `${MEXC_SPOT_BASE}/${fullPath}${reqUrl.search}`;

        console.log('[MEXC Spot Proxy] Request URL:', reqUrl.href);
        console.log('[MEXC Spot Proxy] Forwarding to:', targetUrl);

        // Forward the request to MEXC with all authentication headers
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // Forward all MEXC authentication headers
        const apiKey = req.headers['apikey'];
        const requestTime = req.headers['request-time'];
        const signature = req.headers['signature'];
        const mexcApiKey = req.headers['x-mexc-apikey'];

        if (apiKey) headers['ApiKey'] = apiKey as string;
        if (requestTime) headers['Request-Time'] = requestTime as string;
        if (signature) headers['Signature'] = signature as string;
        if (mexcApiKey) headers['X-MEXC-APIKEY'] = mexcApiKey as string;

        console.log('[MEXC Spot Proxy] Headers:', { apiKey: !!apiKey, requestTime: !!requestTime, signature: !!signature });

        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();

        console.log('[MEXC Spot Proxy] Response status:', response.status);

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
