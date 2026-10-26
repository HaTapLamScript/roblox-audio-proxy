module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing ?url=' });

    try {
        // Lấy videoId từ URL YouTube
        let videoId;
        try {
            const parsed = new URL(url);
            videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
        } catch {
            return res.status(400).json({ error: 'URL không hợp lệ' });
        }

        if (!videoId) return res.status(400).json({ error: 'Không tìm thấy videoId' });

        // Gọi Piped API
        const r = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
        if (!r.ok) throw new Error(`Piped API lỗi: ${r.status}`);

        const data = await r.json();

        // Lấy audio stream bitrate cao nhất
        const audio = data.audioStreams
            ?.filter(s => s.url)
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (!audio?.url) {
            return res.status(404).json({ error: 'Không tìm thấy audio stream' });
        }

        return res.redirect(302, audio.url);

    } catch (error) {
        console.error('Lỗi:', error);
        return res.status(500).json({ error: error.message });
    }
};
