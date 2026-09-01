const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Thiếu tham số ?url=' });
    }

    const client = url.startsWith('https') ? https : http;

    client.get(url, (proxyRes) => {
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
        proxyRes.pipe(res);
    }).on('error', (err) => {
        console.error('Lỗi Proxy Ảnh:', err);
        res.status(500).json({ error: 'Không thể tải ảnh' });
    });
};

