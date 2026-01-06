import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * MEXC Futures API Proxy
 * Forwards requests to MEXC Futures API v1 with proper authentication
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
        // Extract the path after /api/mexc-futures/
        const path = (req.query.path as string[])?.join('/') || '';

        // MEXC Futures base URL
        const MEXC_FUTURES_BASE = 'https://contract.mexc.com';

        // Remove 'path' from query params before forwarding
        const { path: _, ...queryParams } = req.query;
        const queryString = new URLSearchParams(queryParams as Record<string, string>).toString();
        const targetUrl = `${MEXC_FUTURES_BASE}/${path}${queryString ? `?${queryString}` : ''}`;

        console.log('[MEXC Futures Proxy] Forwarding to:', targetUrl);

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

        console.log('[MEXC Futures Proxy] Headers:', { apiKey: !!apiKey, requestTime: !!requestTime, signature: !!signature });

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
            console.error('[MEXC Futures Proxy] Failed to parse JSON. Response:', text);
            return res.status(response.status).json({
                error: 'Invalid JSON response from MEXC',
                status: response.status,
                body: text
            });
        }

        console.log('[MEXC Futures Proxy] Response status:', response.status);

        if (!response.ok) {
            console.error('[MEXC Futures Proxy] API Error:', {
                status: response.status,
                data
            });
        }

        // Forward the response
        res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[MEXC Futures Proxy] Error:', error);
        res.status(500).json({
            error: 'Failed to fetch from MEXC Futures API',
            message: error.message,
        });
    }
}
