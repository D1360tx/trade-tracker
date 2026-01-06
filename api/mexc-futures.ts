import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * MEXC Futures API Proxy (Single File)
 * Handles all MEXC Futures API requests by parsing the URL path
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

        // Remove /api/mexc-futures from the path to get the MEXC API path
        const mexcPath = reqUrl.pathname.replace('/api/mexc-futures', '');

        // MEXC Futures base URL
        const MEXC_FUTURES_BASE = 'https://contract.mexc.com';

        // Construct target URL with original query parameters
        const targetUrl = `${MEXC_FUTURES_BASE}${mexcPath}${reqUrl.search}`;

        console.log('[MEXC Futures] Request:', reqUrl.pathname);
        console.log('[MEXC Futures] Forwarding to:', targetUrl);

        // Forward authentication headers (HTTP headers are case-insensitive, Node normalizes to lowercase)
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // Read headers (lowercase because Node.js normalizes them)
        const apiKey = req.headers['apikey'] as string;
        const requestTime = req.headers['request-time'] as string;
        const signature = req.headers['signature'] as string;

        // Forward with MEXC's expected casing
        if (apiKey) headers['ApiKey'] = apiKey;
        if (requestTime) headers['Request-Time'] = requestTime;
        if (signature) headers['Signature'] = signature;

        console.log('[MEXC Futures] Headers received:', {
            apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'missing',
            requestTime: requestTime || 'missing',
            signature: signature ? `${signature.substring(0, 16)}...` : 'missing'
        });
        console.log('[MEXC Futures] Query params:', reqUrl.search);

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
            console.error('[MEXC Futures] Failed to parse JSON:', text);
            return res.status(response.status).json({
                error: 'Invalid JSON from MEXC',
                status: response.status,
                body: text
            });
        }

        console.log('[MEXC Futures] Response:', response.status);

        if (!response.ok) {
            console.error('[MEXC Futures] Error:', data);
        }

        res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[MEXC Futures] Exception:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message,
        });
    }
}
