import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.status(200).json({
        message: 'MEXC Futures proxy is working!',
        method: req.method,
        url: req.url,
        headers: Object.keys(req.headers),
        query: req.query
    });
}
