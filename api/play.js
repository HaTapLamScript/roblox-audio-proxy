module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing ?url=' });

    const RENDER_URL = process.env.RENDER_URL;

    try {
        const r = await fetch(
            `${RENDER_URL}/play?url=${encodeURIComponent(url)}`,
            {
                signal: AbortSignal.timeout(35000),
                redirect: 'manual'
            }
        );

        if (r.status === 301 || r.status === 302) {
            return res.redirect(302, r.headers.get('location'));
        }

        const text = await r.text();
        try {
            const data = JSON.parse(text);
            return res.status(r.status).json(data);
        } catch {
            return res.status(r.status).json({ error: text.trim() });
        }

    } catch (error) {
        if (error.name === 'TimeoutError') {
            return res.status(503).json({
                error: 'Server đang khởi động, thử lại sau 10 giây'
            });
        }
        console.error('Lỗi:', error);
        return res.status(500).json({ error: error.message });
    }
};
