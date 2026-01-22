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

        // CRITICAL: Remove the 'path' parameter that Vercel adds during URL rewrite
        // This was corrupting our signature by adding unexpected query params!
        reqUrl.searchParams.delete('path');
        const cleanSearch = reqUrl.searchParams.toString();
        const queryString = cleanSearch ? `?${cleanSearch}` : '';

        // Construct target URL with cleaned query parameters
        const targetUrl = `${MEXC_SPOT_BASE}${mexcPath}${queryString}`;

        console.log('[MEXC Spot] Request:', reqUrl.pathname);
        console.log('[MEXC Spot] Forwarding to:', targetUrl);

        // Forward authentication headers (HTTP headers are case-insensitive, Node normalizes to lowercase)
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        // MEXC Spot V3 uses X-MEXC-APIKEY header (signature is in query string)
        const mexcApiKey = req.headers['x-mexc-apikey'] as string;

        // Also support Futures-style headers for compatibility
        const apiKey = req.headers['apikey'] as string;
        const requestTime = req.headers['request-time'] as string;
        const signature = req.headers['signature'] as string;

        // Forward Spot V3 header
        if (mexcApiKey) headers['X-MEXC-APIKEY'] = mexcApiKey;

        // Forward Futures-style headers (if present)
        if (apiKey) headers['ApiKey'] = apiKey;
        if (requestTime) headers['Request-Time'] = requestTime;
        if (signature) headers['Signature'] = signature;

        console.log('[MEXC Spot] Headers received:', {
            mexcApiKey: mexcApiKey ? `${mexcApiKey.substring(0, 8)}...` : 'missing',
            apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'missing',
            signatureInQuery: reqUrl.search.includes('signature')
        });
        console.log('[MEXC Spot] Query params:', reqUrl.search);

        // Forward request to MEXC
        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });

        let data;
        try {
            data = await response.json();
        } catch {
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
    } catch (error: unknown) {
        console.error('[MEXC Spot] Exception:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
