module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing ?url=' });

    try {
        // Lấy videoId
        let videoId;
        try {
            const parsed = new URL(url);
            videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
        } catch {
            return res.status(400).json({ error: 'URL không hợp lệ' });
        }
        if (!videoId) return res.status(400).json({ error: 'Không tìm thấy videoId' });

        // Lấy danh sách instance đang hoạt động (tự cập nhật)
        let instances = [
            'https://api.piped.private.coffee',
            'https://pipedapi.adminforge.de',
            'https://api.piped.yt',
            'https://piped-api.garudalinux.org',
        ];

        try {
            const listRes = await fetch(
                'https://raw.githubusercontent.com/jayxdcode/piped-instances/main/public/minimal.json',
                { signal: AbortSignal.timeout(3000) }
            );
            if (listRes.ok) {
                const listData = await listRes.json();
                const dynamic = listData.instances
                    ?.filter(i => i.api_url)
                    .map(i => i.api_url);
                if (dynamic?.length > 0) instances = dynamic;
            }
        } catch (_) { /* dùng fallback hardcode nếu fetch list lỗi */ }

        // Thử từng instance
        let audio = null;
        let lastError = null;

        for (const instance of instances) {
            try {
                const r = await fetch(`${instance}/streams/${videoId}`, {
                    signal: AbortSignal.timeout(5000)
                });
                if (!r.ok) { lastError = `${instance}: ${r.status}`; continue; }

                const data = await r.json();
                audio = data.audioStreams
                    ?.filter(s => s.url)
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

                if (audio?.url) break;
            } catch (e) {
                lastError = `${instance}: ${e.message}`;
                continue;
            }
        }

        if (!audio?.url) {
            return res.status(404).json({ error: 'Tất cả instance đều lỗi', detail: lastError });
        }

        return res.redirect(302, audio.url);

    } catch (error) {
        console.error('Lỗi:', error);
        return res.status(500).json({ error: error.message });
    }
};
