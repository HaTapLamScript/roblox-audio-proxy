const https = require('https');
const http = require('http');

module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing ?url=' });
    }

    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, (proxyRes) => {
        const chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk));
        proxyRes.on('end', () => {
            const buffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
            res.setHeader('Content-Length', buffer.length);
            res.end(buffer);
        });
    });

    request.on('error', (err) => {
        console.error('Image proxy error:', err);
        res.status(500).json({ error: 'Failed to fetch image' });
    });

    // Timeout 5 giây
    request.setTimeout(5000, () => {
        request.destroy();
        res.status(504).json({ error: 'Timeout' });
    });
}; 
