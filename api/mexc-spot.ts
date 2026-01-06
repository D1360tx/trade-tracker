import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * MEXC Spot API Proxy (Single File)
 * Handles all MEXC Spot API requests by parsing the URL path
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
        // Extract the full request URL
        const reqUrl = new URL(req.url!, `https://${req.headers.host}`);

        // Remove /api/mexc-spot from the path to get the MEXC API path
        const mexcPath = reqUrl.pathname.replace('/api/mexc-spot', '');

        // MEXC Spot base URL
        const MEXC_SPOT_BASE = 'https://api.mexc.com';

        // Construct target URL with original query parameters
        const targetUrl = `${MEXC_SPOT_BASE}${mexcPath}${reqUrl.search}`;

        console.log('[MEXC Spot] Request:', reqUrl.pathname);
        console.log('[MEXC Spot] Forwarding to:', targetUrl);

        // Forward authentication headers
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        const apiKey = req.headers['apikey'];
        const requestTime = req.headers['request-time'];
        const signature = req.headers['signature'];
        const mexcApiKey = req.headers['x-mexc-apikey'];

        if (apiKey) headers['ApiKey'] = apiKey as string;
        if (requestTime) headers['Request-Time'] = requestTime as string;
        if (signature) headers['Signature'] = signature as string;
        if (mexcApiKey) headers['X-MEXC-APIKEY'] = mexcApiKey as string;

        console.log('[MEXC Spot] Auth headers:', {
            apiKey: !!apiKey,
            requestTime: !!requestTime,
            signature: !!signature
        });

        // Forward request to MEXC
        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            const text = await response.text();
            console.error('[MEXC Spot] Failed to parse JSON:', text);
            return res.status(response.status).json({
                error: 'Invalid JSON from MEXC',
                status: response.status,
                body: text
            });
        }

        console.log('[MEXC Spot] Response:', response.status);

        if (!response.ok) {
            console.error('[MEXC Spot] Error:', data);
        }

        res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[MEXC Spot] Exception:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message,
        });
    }
}
